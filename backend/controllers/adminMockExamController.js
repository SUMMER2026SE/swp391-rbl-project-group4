'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { BLUEPRINTS, MONDAI_TYPES, SCORE_COLUMNS } = require('../utils/jlptMock');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Đề đã publish là snapshot bất biến — chặn mọi sửa đổi nội dung.
// Trả về exam row nếu còn sửa được, ném lỗi 400 nếu đã publish.
async function assertEditableExam(examId) {
  const { data: exam, error } = await supabaseAdmin
    .from('mock_exams').select('id, level, is_published').eq('id', examId).single();
  if (error || !exam) { const e = new Error('Không tìm thấy đề thi.'); e.httpStatus = 404; throw e; }
  if (exam.is_published) {
    const e = new Error('Đề đã xuất bản là bất biến. Hãy gỡ xuất bản trước khi sửa nội dung.');
    e.httpStatus = 400; throw e;
  }
  return exam;
}

async function examIdOfSection(sectionId) {
  const { data, error } = await supabaseAdmin
    .from('mock_exam_sections').select('id, exam_id').eq('id', sectionId).single();
  if (error || !data) { const e = new Error('Không tìm thấy phần thi.'); e.httpStatus = 404; throw e; }
  return data.exam_id;
}

async function groupWithExamId(groupId) {
  const { data: group, error } = await supabaseAdmin
    .from('mock_question_groups').select('*').eq('id', groupId).single();
  if (error || !group) { const e = new Error('Không tìm thấy mondai.'); e.httpStatus = 404; throw e; }
  const examId = await examIdOfSection(group.section_id);
  return { group, examId };
}

async function examIdOfQuestion(questionId) {
  const { data, error } = await supabaseAdmin
    .from('mock_questions').select('id, group_id').eq('id', questionId).single();
  if (error || !data) { const e = new Error('Không tìm thấy câu hỏi.'); e.httpStatus = 404; throw e; }
  const { examId } = await groupWithExamId(data.group_id);
  return examId;
}

// Validate payload 1 câu hỏi mock (trắc nghiệm 3–4 lựa chọn theo chuẩn JLPT)
function validateQuestionPayload(q) {
  if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 4)
    return 'Mỗi câu phải có 3 hoặc 4 lựa chọn.';
  if (q.options.some(o => typeof o !== 'string' || !o.trim()))
    return 'Lựa chọn không được để trống.';
  const ci = Number(q.correct_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= q.options.length)
    return 'Đáp án đúng (correct_index) không hợp lệ.';
  return null;
}

function handleError(res, err, fallback) {
  console.error(err);
  res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : fallback });
}

// Cấu trúc đề (phần thi + mondai) cố định theo blueprint JLPT chuẩn — chặn mọi
// thao tác thêm/xóa/sắp xếp lại. Chỉ số câu trong mỗi mondai là linh hoạt.
const STRUCTURE_LOCKED = 'Cấu trúc đề cố định theo format JLPT chuẩn, không thể thêm/xóa phần thi hoặc mondai.';

// ─── Đề thi (mock_exams) ──────────────────────────────────────────────────────

// GET /api/admin/mock-exams
exports.listExams = async (req, res) => {
  const { level, is_published, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.from('mock_exams')
      .select('id, level, title, description, is_published, is_free, created_at, published_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level)                      query = query.eq('level', level);
    if (is_published !== undefined && is_published !== '') query = query.eq('is_published', is_published === 'true');
    if (search)                     query = query.ilike('title', `%${search}%`);

    const { data: exams, error, count } = await query;
    if (error) throw error;

    // Đếm số câu + số lượt làm cho từng đề trong trang
    const examIds = (exams || []).map(e => e.id);
    const counts = {};
    examIds.forEach(id => { counts[id] = { questions: 0, attempts: 0 }; });
    if (examIds.length) {
      const { data: sections } = await supabaseAdmin
        .from('mock_exam_sections').select('id, exam_id').in('exam_id', examIds);
      const sectionToExam = {};
      (sections || []).forEach(s => { sectionToExam[s.id] = s.exam_id; });
      const sectionIds = Object.keys(sectionToExam);
      if (sectionIds.length) {
        const { data: groups } = await supabaseAdmin
          .from('mock_question_groups').select('id, section_id').in('section_id', sectionIds);
        const groupToExam = {};
        (groups || []).forEach(g => { groupToExam[g.id] = sectionToExam[g.section_id]; });
        const groupIds = Object.keys(groupToExam);
        if (groupIds.length) {
          const { data: qs } = await supabaseAdmin
            .from('mock_questions').select('group_id').in('group_id', groupIds);
          (qs || []).forEach(q => { counts[groupToExam[q.group_id]].questions += 1; });
        }
      }
      const { data: attempts } = await supabaseAdmin
        .from('mock_attempts').select('exam_id').in('exam_id', examIds);
      (attempts || []).forEach(a => { counts[a.exam_id].attempts += 1; });
    }

    res.json({
      data: (exams || []).map(e => ({ ...e, question_count: counts[e.id].questions, attempt_count: counts[e.id].attempts })),
      total: count, page: Number(page), limit: Number(limit),
    });
  } catch (err) { handleError(res, err, 'Không thể tải danh sách đề thi.'); }
};

// POST /api/admin/mock-exams
// Đề luôn tạo từ blueprint chuẩn JLPT — cấu trúc phần thi/mondai cố định.
exports.createExam = async (req, res) => {
  const { level, title, description } = req.body;
  if (!level || !BLUEPRINTS[level]) return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  if (!title?.trim())               return res.status(400).json({ error: 'Tên đề thi là bắt buộc.' });
  try {
    const { data: exam, error } = await supabaseAdmin.from('mock_exams')
      .insert({ level, title: title.trim(), description: description || null, created_by: req.user?.id })
      .select().single();
    if (error) throw error;

    // Tạo khung đề chuẩn: sections + groups (chưa có câu hỏi)
    const bp = BLUEPRINTS[level];
    for (let si = 0; si < bp.sections.length; si++) {
      const s = bp.sections[si];
      const { data: section, error: sErr } = await supabaseAdmin.from('mock_exam_sections')
        .insert({ exam_id: exam.id, position: si + 1, section_type: s.section_type, title: s.title, time_limit_minutes: s.time_limit_minutes })
        .select('id').single();
      if (sErr) throw sErr;
      // Câu chỉ dẫn (instruction) KHÔNG lưu DB — là hằng số chuẩn JLPT, FE render từ mockExamConstants.
      const groupRows = s.groups.map((g, gi) => ({
        section_id:       section.id,
        position:         gi + 1,
        mondai_number:    gi + 1,
        mondai_type:      g.mondai_type,
        score_category:   g.score_category,
      }));
      const { error: gErr } = await supabaseAdmin.from('mock_question_groups').insert(groupRows);
      if (gErr) throw gErr;
    }
    res.status(201).json(exam);
  } catch (err) { handleError(res, err, 'Không thể tạo đề thi.'); }
};

// GET /api/admin/mock-exams/:id — full tree kèm đáp án (admin được xem)
exports.getExam = async (req, res) => {
  try {
    const { data: exam, error } = await supabaseAdmin
      .from('mock_exams').select('*').eq('id', req.params.id).single();
    if (error || !exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

    const { data: sections, error: sErr } = await supabaseAdmin
      .from('mock_exam_sections').select('*').eq('exam_id', exam.id).order('position');
    if (sErr) throw sErr;

    const sectionIds = (sections || []).map(s => s.id);
    let groups = [], questions = [];
    if (sectionIds.length) {
      const { data: g, error: gErr } = await supabaseAdmin
        .from('mock_question_groups').select('*').in('section_id', sectionIds).order('position');
      if (gErr) throw gErr;
      groups = g || [];
      const groupIds = groups.map(x => x.id);
      if (groupIds.length) {
        const { data: q, error: qErr } = await supabaseAdmin
          .from('mock_questions').select('*').in('group_id', groupIds).order('position');
        if (qErr) throw qErr;
        questions = q || [];
      }
    }

    const tree = {
      ...exam,
      sections: (sections || []).map(s => ({
        ...s,
        groups: groups.filter(g => g.section_id === s.id).map(g => ({
          ...g,
          questions: questions.filter(q => q.group_id === g.id),
        })),
      })),
    };
    res.json(tree);
  } catch (err) { handleError(res, err, 'Không thể tải đề thi.'); }
};

// PUT /api/admin/mock-exams/:id — sửa meta (title/description/level)
exports.updateExam = async (req, res) => {
  const allowed = ['title', 'description', 'level', 'is_free'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });
  if ('is_free' in updates) updates.is_free = !!updates.is_free;
  if (updates.level && !BLUEPRINTS[updates.level]) return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  try {
    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, is_published, level').eq('id', req.params.id).single();
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
    if (exam.is_published && (updates.level && updates.level !== exam.level))
      return res.status(400).json({ error: 'Không thể đổi cấp độ của đề đã xuất bản.' });

    const { data, error } = await supabaseAdmin.from('mock_exams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật đề thi.'); }
};

// PATCH /api/admin/mock-exams/:id/publish — body { publish: boolean }
exports.publishExam = async (req, res) => {
  const publish = !!req.body.publish;
  try {
    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, level, is_published').eq('id', req.params.id).single();
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

    if (!publish) {
      const { count } = await supabaseAdmin.from('mock_attempts')
        .select('id', { count: 'exact', head: true }).eq('exam_id', exam.id);
      const { data, error } = await supabaseAdmin.from('mock_exams')
        .update({ is_published: false, updated_at: new Date().toISOString() })
        .eq('id', exam.id).select().single();
      if (error) throw error;
      return res.json({
        ...data,
        warning: count > 0 ? `Đề đã có ${count} lượt làm — nếu sửa nội dung, kết quả/review cũ có thể lệch với đề mới.` : undefined,
      });
    }

    // ── Validate trước khi publish ──
    const errors = [];
    const { data: sections } = await supabaseAdmin
      .from('mock_exam_sections').select('id, title, position').eq('exam_id', exam.id).order('position');
    if (!sections?.length) errors.push('Đề chưa có phần thi nào.');

    const sectionIds = (sections || []).map(s => s.id);
    let groups = [], questions = [];
    if (sectionIds.length) {
      ({ data: groups } = await supabaseAdmin.from('mock_question_groups')
        .select('id, section_id, mondai_number, mondai_type, score_category, audio_url').in('section_id', sectionIds));
      groups = groups || [];
      const groupIds = groups.map(g => g.id);
      if (groupIds.length) {
        ({ data: questions } = await supabaseAdmin.from('mock_questions')
          .select('id, group_id, question_text, audio_url, options, correct_index').in('group_id', groupIds));
        questions = questions || [];
      }
    }

    const sectionLabel = {};
    (sections || []).forEach(s => { sectionLabel[s.id] = s.title || `Phần ${s.position}`; });

    for (const s of sections || []) {
      if (!groups.some(g => g.section_id === s.id))
        errors.push(`Phần "${sectionLabel[s.id]}" chưa có mondai nào.`);
    }
    for (const g of groups) {
      const label = `${sectionLabel[g.section_id]} › 問題${g.mondai_number} (${MONDAI_TYPES[g.mondai_type]?.ja || g.mondai_type})`;
      const gQuestions = questions.filter(q => q.group_id === g.id);
      if (!gQuestions.length) { errors.push(`${label}: chưa có câu hỏi.`); continue; }
      if (g.score_category === 'listening' && !g.audio_url && !gQuestions.every(q => q.audio_url))
        errors.push(`${label}: phần nghe phải có audio (cho cả mondai hoặc từng câu).`);
      gQuestions.forEach((q, i) => {
        const msg = validateQuestionPayload(q);
        if (msg) errors.push(`${label} câu ${i + 1}: ${msg}`);
        if (g.score_category !== 'listening' && !q.question_text?.trim())
          errors.push(`${label} câu ${i + 1}: thiếu nội dung câu hỏi.`);
      });
    }

    // Mỗi cột chấm điểm của cấp độ phải có ít nhất 1 câu
    const columns = SCORE_COLUMNS[exam.level] || [];
    const catToCol = {};
    columns.forEach(col => col.cats.forEach(cat => { catToCol[cat] = col.key; }));
    const covered = new Set();
    for (const g of groups) {
      if (questions.some(q => q.group_id === g.id) && catToCol[g.score_category])
        covered.add(catToCol[g.score_category]);
    }
    for (const col of columns) {
      if (!covered.has(col.key))
        errors.push(`Cột điểm "${col.key}" chưa có câu hỏi nào — đề ${exam.level} cần đủ các cột: ${columns.map(c => c.key).join(', ')}.`);
    }

    if (errors.length) return res.status(400).json({ error: 'Đề chưa đủ điều kiện xuất bản.', details: errors });

    // ── Cảnh báo (không chặn): số câu mỗi mondai lệch so với chuẩn blueprint ──
    // Điểm tính theo tỷ lệ đúng nên lệch số câu không phá thang điểm — chỉ nhắc admin.
    const warnings = [];
    const bp = BLUEPRINTS[exam.level];
    const sectionPos = {};
    (sections || []).forEach(s => { sectionPos[s.id] = s.position; });
    // Map "vị trí phần : mondai_type" → số câu chuẩn
    const stdCount = {};
    (bp?.sections || []).forEach((s, si) => {
      s.groups.forEach(bg => { stdCount[`${si + 1}:${bg.mondai_type}`] = bg.question_count; });
    });
    for (const gr of groups) {
      const std = stdCount[`${sectionPos[gr.section_id]}:${gr.mondai_type}`];
      const actual = questions.filter(q => q.group_id === gr.id).length;
      if (std != null && actual !== std)
        warnings.push(`${sectionLabel[gr.section_id]} › 問題${gr.mondai_number} (${MONDAI_TYPES[gr.mondai_type]?.ja || gr.mondai_type}): ${actual} câu — chuẩn JLPT là ${std} câu.`);
    }

    const { data, error } = await supabaseAdmin.from('mock_exams')
      .update({ is_published: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', exam.id).select().single();
    if (error) throw error;
    res.json({ ...data, warnings: warnings.length ? warnings : undefined });
  } catch (err) { handleError(res, err, 'Không thể xuất bản đề thi.'); }
};

// DELETE /api/admin/mock-exams/:id
exports.deleteExam = async (req, res) => {
  try {
    const { count } = await supabaseAdmin.from('mock_attempts')
      .select('id', { count: 'exact', head: true }).eq('exam_id', req.params.id);
    if (count > 0)
      return res.status(409).json({ error: `Đề đã có ${count} lượt làm, không thể xóa. Hãy gỡ xuất bản để ẩn đề.` });
    const { error } = await supabaseAdmin.from('mock_exams').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa đề thi.' });
  } catch (err) { handleError(res, err, 'Không thể xóa đề thi.'); }
};

// GET /api/admin/mock-exams/:id/attempts — thống kê lượt làm cho admin
exports.listExamAttempts = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { data, error, count } = await supabaseAdmin.from('mock_attempts')
      .select('id, user_id, attempt_number, status, scores, total_score, passed, duration_seconds, started_at, submitted_at', { count: 'exact' })
      .eq('exam_id', req.params.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (error) throw error;

    const userIds = [...new Set((data || []).map(a => a.user_id))];
    let userMap = {};
    if (userIds.length) {
      const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email').in('id', userIds);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }
    res.json({
      data: (data || []).map(a => ({ ...a, user: userMap[a.user_id] || null })),
      total: count, page: Number(page), limit: Number(limit),
    });
  } catch (err) { handleError(res, err, 'Không thể tải danh sách lượt làm.'); }
};

// ─── Phần thi (mock_exam_sections) ────────────────────────────────────────────

// POST /api/admin/mock-exams/:examId/sections — CHẶN: cấu trúc cố định theo blueprint
exports.createSection = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PUT /api/admin/mock-sections/:id
exports.updateSection = async (req, res) => {
  const allowed = ['title', 'time_limit_minutes'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const examId = await examIdOfSection(req.params.id);
    await assertEditableExam(examId);
    const { data, error } = await supabaseAdmin.from('mock_exam_sections')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật phần thi.'); }
};

// DELETE /api/admin/mock-sections/:id — CHẶN: cấu trúc cố định theo blueprint
exports.deleteSection = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PATCH /api/admin/mock-sections/reorder — CHẶN: cấu trúc cố định theo blueprint
exports.reorderSections = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// ─── Mondai (mock_question_groups) ────────────────────────────────────────────

// POST /api/admin/mock-sections/:sectionId/groups — CHẶN: cấu trúc cố định theo blueprint
exports.createGroup = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PUT /api/admin/mock-groups/:id
// Cấu trúc mondai cố định (mondai_number/type/score_category theo blueprint) — chỉ sửa nội dung/media.
exports.updateGroup = async (req, res) => {
  try {
    const { group, examId } = await groupWithExamId(req.params.id);
    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, is_published').eq('id', examId).single();
    // Đề đã publish: chỉ cho sửa typo transcript (không đổi nội dung thi)
    const allowed = exam?.is_published
      ? ['audio_transcript']
      : ['passage_text', 'image_url', 'audio_url', 'audio_transcript'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length)
      return res.status(400).json({ error: exam?.is_published ? 'Đề đã xuất bản: chỉ được sửa transcript.' : 'Không có trường nào để cập nhật.' });

    const { data, error } = await supabaseAdmin.from('mock_question_groups')
      .update(updates).eq('id', group.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật mondai.'); }
};

// DELETE /api/admin/mock-groups/:id — CHẶN: cấu trúc cố định theo blueprint
exports.deleteGroup = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PATCH /api/admin/mock-groups/reorder — CHẶN: cấu trúc cố định theo blueprint
exports.reorderGroups = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// ─── Câu hỏi (mock_questions) ─────────────────────────────────────────────────

// POST /api/admin/mock-groups/:groupId/questions — bulk (dùng cho cả tạo tay lẫn lưu nháp AI)
exports.createQuestions = async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'Danh sách câu hỏi không được rỗng.' });
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    await assertEditableExam(examId);
    for (let i = 0; i < questions.length; i++) {
      const msg = validateQuestionPayload(questions[i]);
      if (msg) return res.status(400).json({ error: `Câu ${i + 1}: ${msg}` });
    }
    const { data: last } = await supabaseAdmin.from('mock_questions')
      .select('position').eq('group_id', group.id).order('position', { ascending: false }).limit(1);
    const base = last?.[0]?.position || 0;
    const rows = questions.map((q, i) => ({
      group_id:      group.id,
      position:      base + i + 1,
      question_text: q.question_text?.trim() || null,
      image_url:     q.image_url || null,
      audio_url:     q.audio_url || null,
      options:       q.options.map(o => String(o).trim()),
      correct_index: Number(q.correct_index),
      explanation:   q.explanation || null,
      translation_vi: q.translation_vi || null,
    }));
    const { data, error } = await supabaseAdmin.from('mock_questions').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { handleError(res, err, 'Không thể tạo câu hỏi.'); }
};

// PUT /api/admin/mock-questions/:id
exports.updateQuestion = async (req, res) => {
  try {
    const { data: q } = await supabaseAdmin.from('mock_questions').select('*').eq('id', req.params.id).single();
    if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
    const { examId } = await groupWithExamId(q.group_id);
    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, is_published').eq('id', examId).single();
    // Đề đã publish: chỉ cho sửa giải thích (không đổi nội dung/đáp án)
    const allowed = exam?.is_published
      ? ['explanation', 'translation_vi']
      : ['question_text', 'image_url', 'audio_url', 'options', 'correct_index', 'explanation', 'translation_vi'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length)
      return res.status(400).json({ error: exam?.is_published ? 'Đề đã xuất bản: chỉ được sửa giải thích và bản dịch.' : 'Không có trường nào để cập nhật.' });

    const merged = { ...q, ...updates };
    const msg = validateQuestionPayload(merged);
    if (msg) return res.status(400).json({ error: msg });

    const { data, error } = await supabaseAdmin.from('mock_questions')
      .update(updates).eq('id', q.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật câu hỏi.'); }
};

// DELETE /api/admin/mock-questions/:id
exports.deleteQuestion = async (req, res) => {
  try {
    const examId = await examIdOfQuestion(req.params.id);
    await assertEditableExam(examId);
    const { error } = await supabaseAdmin.from('mock_questions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa câu hỏi.' });
  } catch (err) { handleError(res, err, 'Không thể xóa câu hỏi.'); }
};

// PATCH /api/admin/mock-questions/reorder — body { ids: [...] }
exports.reorderQuestions = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Danh sách ids không hợp lệ.' });
  try {
    const examId = await examIdOfQuestion(ids[0]);
    await assertEditableExam(examId);
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabaseAdmin.from('mock_questions').update({ position: i + 1 }).eq('id', ids[i]);
      if (error) throw error;
    }
    res.json({ message: 'Đã sắp xếp lại.' });
  } catch (err) { handleError(res, err, 'Không thể sắp xếp câu hỏi.'); }
};

// ─── Import từ ngân hàng câu hỏi (copy snapshot, không reference) ─────────────

// POST /api/admin/mock-groups/:groupId/import-from-bank — body { question_ids: [...] }
exports.importFromBank = async (req, res) => {
  const { question_ids } = req.body;
  if (!Array.isArray(question_ids) || !question_ids.length)
    return res.status(400).json({ error: 'Chọn ít nhất 1 câu hỏi để import.' });
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    await assertEditableExam(examId);

    const { data: bankQs, error } = await supabaseAdmin.from('question_bank')
      .select('id, question_text, question_type, options, correct_answer, explanation')
      .in('id', question_ids);
    if (error) throw error;

    const skipped = [];
    const rows = [];
    for (const bq of bankQs || []) {
      if (bq.question_type !== 'single_choice') {
        skipped.push({ id: bq.id, reason: `Loại "${bq.question_type}" không dùng được cho đề JLPT (chỉ single_choice).` });
        continue;
      }
      const options = (Array.isArray(bq.options) ? bq.options : []).map(o => String(o).trim());
      const correctIndex = options.findIndex(o => o === String(bq.correct_answer || '').trim());
      if (options.length < 3 || options.length > 4 || correctIndex < 0) {
        skipped.push({ id: bq.id, reason: 'Options/đáp án không khớp định dạng 3–4 lựa chọn.' });
        continue;
      }
      rows.push({
        question_text: bq.question_text,
        options,
        correct_index: correctIndex,
        explanation:   bq.explanation || null,
      });
    }
    (question_ids.filter(id => !(bankQs || []).some(b => b.id === id)))
      .forEach(id => skipped.push({ id, reason: 'Không tìm thấy trong ngân hàng.' }));

    let saved = [];
    if (rows.length) {
      const { data: last } = await supabaseAdmin.from('mock_questions')
        .select('position').eq('group_id', group.id).order('position', { ascending: false }).limit(1);
      const base = last?.[0]?.position || 0;
      const { data, error: insErr } = await supabaseAdmin.from('mock_questions')
        .insert(rows.map((r, i) => ({ ...r, group_id: group.id, position: base + i + 1 }))).select();
      if (insErr) throw insErr;
      saved = data;
    }
    res.json({ saved: saved.length, skipped, data: saved });
  } catch (err) { handleError(res, err, 'Không thể import câu hỏi.'); }
};

// ─── AI sinh nháp câu hỏi theo mondai ─────────────────────────────────────────

// POST /api/admin/mock-groups/:groupId/ai-generate — body { count } → trả NHÁP, không ghi DB
exports.aiGenerateDrafts = async (req, res) => {
  const count = Math.min(Math.max(Number(req.body.count) || 5, 1), 15);
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, level').eq('id', examId).single();
    const { generateMondaiQuestions } = require('../utils/questionGen');
    const result = await generateMondaiQuestions({
      level:       exam.level,
      mondaiType:  group.mondai_type,
      count,
      passageText: group.passage_text || '',
      topic:       req.body.topic || '',
    });
    res.json(result);
  } catch (err) { handleError(res, err, 'Không thể sinh câu hỏi bằng AI.'); }
};

// ─── Upload media ─────────────────────────────────────────────────────────────

async function uploadBuffer(bucket, buffer, contentType, ext) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filename, buffer, { contentType, upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename);
  return publicUrl;
}

async function uploadToBucket(req, res, bucket, fallbackExt, errMsg) {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || fallbackExt).toLowerCase();
  try {
    const url = await uploadBuffer(bucket, req.file.buffer, req.file.mimetype, ext);
    res.json({ url });
  } catch (err) { console.error(err); res.status(500).json({ error: errMsg }); }
}

// POST /api/admin/mock-exams/upload-audio
exports.uploadAudio = (req, res) => uploadToBucket(req, res, 'mock-exam-audio', 'mp3', 'Không thể tải file âm thanh lên.');

// POST /api/admin/mock-exams/upload-image
exports.uploadImage = (req, res) => uploadToBucket(req, res, 'passage-images', 'jpg', 'Không thể tải ảnh lên.');

// ─── TTS: sinh audio phần nghe từ transcript ──────────────────────────────────

// POST /api/admin/mock-groups/:id/tts — đọc audio_transcript → mp3 → gán audio_url
exports.generateGroupAudio = async (req, res) => {
  try {
    const { group, examId } = await groupWithExamId(req.params.id);
    await assertEditableExam(examId);

    const { synthesizeTranscript } = require('../utils/ttsJa');
    let buffer;
    try {
      buffer = await synthesizeTranscript(group.audio_transcript);
    } catch (err) {
      // Transcript rỗng/quá dài đã kèm httpStatus 400; còn lại là lỗi dịch vụ TTS
      if (!err.httpStatus) { err.httpStatus = 502; err.message = 'Dịch vụ tạo giọng đọc không phản hồi. Hãy thử lại hoặc tải file thu âm lên.'; }
      throw err;
    }

    const url = await uploadBuffer('mock-exam-audio', buffer, 'audio/mpeg', 'mp3');
    const { data, error } = await supabaseAdmin.from('mock_question_groups')
      .update({ audio_url: url }).eq('id', group.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể tạo audio từ transcript.'); }
};
