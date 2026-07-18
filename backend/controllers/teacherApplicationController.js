'use strict';

const { supabaseAdmin, updateUserMetadata } = require('../config/supabase');
const { extractAllDocs, reviewApplication } = require('../utils/teacherDocReview');

const BUCKET = 'teacher-documents';
const DOC_TYPES = ['cv', 'degree', 'certificate', 'other'];

// Idempotently ensure the private documents bucket exists.
async function ensureBucket() {
  try {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
  } catch (e) {
    // ignore "already exists"
    if (!/exist/i.test(e.message || '')) console.error('ensureBucket:', e.message);
  }
}

const roleOf = (u) => u?.user_metadata?.role || 'student';

// ── Applicant: submit an application ──────────────────────────────────────────
exports.submitApplication = async (req, res) => {
  const userId = req.user.id;
  const files  = req.files || [];

  if (roleOf(req.user) !== 'student') {
    return res.status(400).json({ error: 'Tài khoản của bạn đã là giáo viên hoặc quản trị viên.' });
  }
  if (!files.length) {
    return res.status(400).json({ error: 'Vui lòng tải lên ít nhất một tài liệu (CV, bằng cấp hoặc chứng chỉ).' });
  }

  // Block duplicate pending applications.
  const { data: existing } = await supabaseAdmin
    .from('teacher_applications').select('id').eq('user_id', userId).eq('status', 'pending').maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'Bạn đang có một đơn đăng ký chờ duyệt.' });
  }

  // Parse per-file document types (parallel array sent by the client).
  let docTypes = [];
  try { docTypes = JSON.parse(req.body.doc_types || '[]'); } catch { docTypes = []; }

  try {
    await ensureBucket();

    // Upload each document to the private bucket.
    const documents = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const type = DOC_TYPES.includes(docTypes[i]) ? docTypes[i] : 'other';
      const safe = f.originalname.replace(/[^\w.\-]/g, '_');
      const path = `${userId}/${Date.now()}_${i}_${safe}`;
      const { error: upErr } = await supabaseAdmin.storage.from(BUCKET)
        .upload(path, f.buffer, { contentType: f.mimetype, upsert: false });
      if (upErr) throw upErr;
      documents.push({ type, name: f.originalname, path, mime: f.mimetype, size: f.size });
    }

    const fields = {
      phone:                 req.body.phone || null,
      highest_qualification: req.body.highest_qualification || null,
      specialization:        req.body.specialization || null,
      years_experience:      req.body.years_experience ? Number(req.body.years_experience) : null,
      education:             req.body.education || null,
      bio:                   req.body.bio || null,
    };

    // Extract text from every document and run the AI review.
    const { combined, anyReadable } = await extractAllDocs(files);
    const review = await reviewApplication({
      fields: {
        ...fields,
        doc_count: documents.length,
        doc_types: documents.map(d => d.type).join(', '),
      },
      docsText: combined,
      anyReadable,
    });

    // Strict auto-approve guard — anything short of confident + complete → admin review.
    const hasCredential = documents.some(d => d.type === 'degree' || d.type === 'certificate');
    const autoApprove =
      review.verdict === 'approve' &&
      review.confidence >= 80 &&
      review.missing.length === 0 &&
      review.anomalies.length === 0 &&
      hasCredential &&
      anyReadable;

    const status = autoApprove ? 'approved' : 'pending';

    if (autoApprove) {
      await updateUserMetadata(userId, { role: 'teacher' });
    }

    const { data: appRow, error: insErr } = await supabaseAdmin.from('teacher_applications').insert({
      user_id: userId,
      status,
      decided_by: autoApprove ? 'ai' : null,
      ...fields,
      documents,
      ai_verdict:    review.verdict,
      ai_summary:    review.summary,
      ai_flags:      { missing: review.missing, anomalies: review.anomalies },
      ai_confidence: review.confidence,
      ai_model:      review.ai_model,
      reviewed_at:   autoApprove ? new Date().toISOString() : null,
    }).select().single();
    if (insErr) throw insErr;

    res.status(201).json({
      status,
      granted: autoApprove,
      ai_summary: review.summary,
      ai_flags: appRow.ai_flags,
    });
  } catch (err) {
    console.error('submitApplication error:', err);
    res.status(500).json({ error: 'Không thể gửi đơn đăng ký. Vui lòng thử lại.' });
  }
};

// ── Applicant: my latest application ──────────────────────────────────────────
exports.getMyApplication = async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('teacher_applications')
      .select('id, status, decided_by, ai_summary, ai_flags, ai_confidence, admin_note, created_at, reviewed_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    res.json({ application: data || null });
  } catch (err) {
    console.error('getMyApplication error:', err);
    res.status(500).json({ error: 'Không thể tải đơn đăng ký.' });
  }
};

// ── Admin: list applications (with signed document URLs) ──────────────────────
exports.adminListApplications = async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    let q = supabaseAdmin.from('teacher_applications').select('*').order('updated_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Enrich with applicant info.
    const userIds = [...new Set((rows || []).map(r => r.user_id))];
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email').in('id', userIds);
    const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));

    // Attach short-lived signed URLs for each document.
    const out = [];
    for (const r of (rows || [])) {
      const docs = Array.isArray(r.documents) ? r.documents : [];
      const signed = await Promise.all(docs.map(async (d) => {
        try {
          const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(d.path, 3600);
          return { ...d, url: data?.signedUrl || null };
        } catch { return { ...d, url: null }; }
      }));
      out.push({ ...r, documents: signed, applicant: uMap[r.user_id] || { email: r.user_id } });
    }

    res.json(out);
  } catch (err) {
    console.error('adminListApplications error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách đơn.' });
  }
};

// ── Admin: approve / reject / revoke ──────────────────────────────────────────
exports.adminReviewApplication = async (req, res) => {
  const { action, note } = req.body; // 'approve' | 'reject' | 'revoke'
  if (!['approve', 'reject', 'revoke'].includes(action)) {
    return res.status(400).json({ error: 'action phải là approve, reject hoặc revoke.' });
  }
  try {
    const { data: row, error: fErr } = await supabaseAdmin
      .from('teacher_applications').select('*').eq('id', req.params.id).single();
    if (fErr || !row) return res.status(404).json({ error: 'Không tìm thấy đơn.' });

    const base = {
      admin_note: note || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      decided_by: 'admin',
      updated_at: new Date().toISOString(),
    };

    if (action === 'approve') {
      await updateUserMetadata(row.user_id, { role: 'teacher' });
      await supabaseAdmin.from('teacher_applications').update({ ...base, status: 'approved' }).eq('id', row.id);
      return res.json({ message: 'Đã duyệt và cấp quyền giáo viên.' });
    }

    // reject or revoke → ensure the account is (or stays) a student.
    await updateUserMetadata(row.user_id, { role: 'student' });
    await supabaseAdmin.from('teacher_applications').update({ ...base, status: 'rejected' }).eq('id', row.id);
    return res.json({ message: action === 'revoke' ? 'Đã thu hồi quyền giáo viên.' : 'Đã từ chối đơn.' });
  } catch (err) {
    console.error('adminReviewApplication error:', err);
    res.status(500).json({ error: 'Không thể xử lý đơn.' });
  }
};
