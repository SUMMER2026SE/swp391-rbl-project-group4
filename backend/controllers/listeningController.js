'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { whisperTranscribe } = require('../config/ai');
const { incrementUsage, checkAccess } = require('../services/quotaService');
const { runVideoTranscription } = require('../services/lessonTranscribe');
const { synthesizeWithTimings } = require('../utils/ttsJa');
const { logContentUse } = require('../utils/usageTracker');

const BUCKET = 'listening-passages-audio';
const isAdmin = (u) => u?.user_metadata?.role === 'admin';
const SOURCE_TYPES = ['tts', 'audio', 'video', 'youtube'];

// Upload buffer → bucket, trả { publicUrl, storagePath }. Ném lỗi nếu upload hỏng.
async function uploadToBucket(userId, buffer, ext, contentType) {
  const storagePath = `content/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });
  if (error) { const e = new Error('Không thể tải file lên storage.'); e.httpStatus = 500; throw e; }
  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  return { publicUrl, storagePath };
}

// Chủ sở hữu (theo student_id) hoặc admin mới được sửa/xóa.
async function ownsContent(id, user) {
  const { data } = await supabaseAdmin.from('listening_user_audios')
    .select('student_id, storage_path, is_public').eq('id', id).single();
  if (!data) return null;
  if (data.student_id === user.id || isAdmin(user)) return data;
  return false;
}

// Tables are in public schema with listening_ prefix (schema exposure workaround)
const dlg   = () => supabaseAdmin.from('listening_dialogues');
const lines = () => supabaseAdmin.from('listening_dialogue_lines');
const uadb  = () => supabaseAdmin.from('listening_user_audios');

// ── Public: Dialogue list / detail ────────────────────────────────────────────

exports.list = async (req, res) => {
  let dq = dlg().select('id, title, title_vi, level, topic, thumbnail_icon').order('level').order('created_at');
  // Nội dung media công khai (admin tạo) hiển thị cạnh hội thoại kịch bản, theo cấp độ.
  let mq = uadb().select('id, title, title_vi, level, source_type, created_at')
    .eq('is_public', true).order('created_at', { ascending: false });
  if (req.query.level) { dq = dq.eq('level', req.query.level); mq = mq.eq('level', req.query.level); }

  const [{ data: dialogues, error: e1 }, { data: media, error: e2 }] = await Promise.all([dq, mq]);
  if (e1 || e2) return res.status(500).json({ error: 'Không tải được danh sách.' });

  const items = [
    ...(dialogues || []).map(d => ({ ...d, kind: 'dialogue' })),
    ...(media || []).map(m => ({ id: m.id, title: m.title, title_vi: m.title_vi, level: m.level,
      source_type: m.source_type, thumbnail_icon: 'graphic_eq', kind: 'media' })),
  ];
  res.json(items);
};

// ── Listening content (tts/audio/video/youtube) — admin công khai, học sinh riêng tư ──

// GET /listening/content/mine — nội dung riêng của người dùng
exports.listMyContent = async (req, res) => {
  const { data, error } = await uadb()
    .select('id, title, title_vi, level, source_type, audio_url, content_url, transcript, segments, is_public, created_at')
    .eq('student_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Không tải được.' });
  res.json(data || []);
};

// GET /listening/content/:id — mở 1 bài (công khai, hoặc của chính mình)
exports.getContent = async (req, res) => {
  const { data, error } = await uadb()
    .select('id, title, title_vi, level, source_type, audio_url, content_url, transcript, segments, is_public, student_id')
    .eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài nghe.' });
  if (!data.is_public && data.student_id !== req.user.id && !isAdmin(req.user))
    return res.status(403).json({ error: 'Không có quyền.' });
  logContentUse({ userId: req.user?.id, contentType: 'listening', contentId: data.id,
    creatorType: data.is_public ? 'admin' : 'student', ownerId: data.student_id });
  res.json(data);
};

// POST /listening/content — tạo nội dung. Học sinh bị giới hạn 2 bài/tháng (free);
// admin không giới hạn và nội dung công khai. multipart: field 'media' (audio/video).
exports.createContent = async (req, res) => {
  const admin = isAdmin(req.user);
  const source_type = req.body.source_type;
  if (!SOURCE_TYPES.includes(source_type))
    return res.status(400).json({ error: 'Nguồn không hợp lệ.' });

  // Quota chỉ áp cho học sinh (mọi bài tự tạo tính 1 lượt).
  if (!admin) {
    try {
      const access = await checkAccess(req.user.id, 'listening_create_monthly');
      if (!access.allowed) {
        return res.status(403).json({
          error: 'quota_exceeded',
          message: `Bạn đã tạo hết ${access.used}/${access.limit} bài nghe tháng này. ${access.resetInfo}`,
          feature: 'listening_create_monthly', used: access.used, limit: access.limit,
          tier: access.tier, resetInfo: access.resetInfo, upgradeRequired: access.tier === 'free',
        });
      }
    } catch (e) { /* fail-open như checkQuota */ }
  }

  const title    = (req.body.title || 'Bài nghe').trim();
  const title_vi = (req.body.title_vi || '').trim() || null;
  const level    = req.body.level || 'N5';

  const row = {
    student_id: req.user.id, creator_type: admin ? 'admin' : 'student', is_public: admin,
    title, title_vi, level, source_type,
    transcript: '', segments: [],
  };

  try {
    if (source_type === 'youtube') {
      const url = (req.body.content_url || '').trim();
      if (!/(?:youtube\.com|youtu\.be)\//i.test(url))
        return res.status(400).json({ error: 'Link YouTube không hợp lệ.' });
      row.content_url = url;
    } else if (source_type === 'tts') {
      const transcript = (req.body.transcript || '').trim();
      if (!transcript) return res.status(400).json({ error: 'Cần nội dung để đọc (TTS).' });
      const { buffer, segments } = await synthesizeWithTimings(transcript);
      const { publicUrl, storagePath } = await uploadToBucket(req.user.id, buffer, 'mp3', 'audio/mpeg');
      row.audio_url = publicUrl; row.storage_path = storagePath;
      row.transcript = transcript; row.segments = segments;
    } else { // audio | video
      if (!req.file) return res.status(400).json({ error: 'Chưa chọn file.' });
      const ext = (req.file.originalname.split('.').pop() || (source_type === 'audio' ? 'mp3' : 'mp4')).toLowerCase();
      const { publicUrl, storagePath } = await uploadToBucket(req.user.id, req.file.buffer, ext, req.file.mimetype);
      row.storage_path = storagePath;
      if (source_type === 'audio') row.audio_url = publicUrl; else row.content_url = publicUrl;
    }

    const { data, error } = await uadb().insert(row).select().single();
    if (error) throw error;
    if (!admin) incrementUsage(req.user.id, 'listening_create_monthly').catch(() => {});
    res.status(201).json(data);
  } catch (err) {
    console.error('createContent error:', err.message);
    res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : 'Không thể tạo bài nghe.' });
  }
};

// POST /listening/content/:id/transcribe — sinh transcript AI (bản nháp, KHÔNG tự lưu).
exports.transcribeContent = async (req, res) => {
  const owned = await ownsContent(req.params.id, req.user);
  if (owned === null) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (owned === false) return res.status(403).json({ error: 'Không có quyền.' });
  const { data: row } = await uadb().select('audio_url, content_url').eq('id', req.params.id).single();
  const url = row?.content_url || row?.audio_url;
  if (!url) return res.status(400).json({ error: 'Bài nghe chưa có nguồn audio/video.' });
  try {
    const { segments, transcript } = await runVideoTranscription(url);
    res.json({ segments, transcript, count: segments.length });
  } catch (err) {
    console.error('transcribeContent error:', err.message);
    res.status(502).json({ error: 'Không thể tạo transcript tự động. Hãy thử lại hoặc nhập tay.' });
  }
};

// PUT /listening/content/:id — sửa thông tin + transcript/segments (chủ sở hữu / admin).
exports.updateContent = async (req, res) => {
  const owned = await ownsContent(req.params.id, req.user);
  if (owned === null) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (owned === false) return res.status(403).json({ error: 'Không có quyền.' });
  const { title, title_vi, level, transcript, segments } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (title     !== undefined) updates.title     = String(title).trim() || 'Bài nghe';
  if (title_vi  !== undefined) updates.title_vi  = String(title_vi).trim() || null;
  if (level     !== undefined) updates.level     = level;
  if (transcript !== undefined) updates.transcript = transcript;
  if (segments  !== undefined) updates.segments  = Array.isArray(segments) ? segments : [];
  const { data, error } = await uadb().update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật.' });
  res.json(data);
};

// DELETE /listening/content/:id — chủ sở hữu / admin
exports.deleteContent = async (req, res) => {
  const owned = await ownsContent(req.params.id, req.user);
  if (owned === null) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (owned === false) return res.status(403).json({ error: 'Không có quyền.' });
  if (owned.storage_path) await supabaseAdmin.storage.from(BUCKET).remove([owned.storage_path]);
  const { error } = await uadb().delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Không thể xóa.' });
  res.json({ ok: true });
};

exports.getOne = async (req, res) => {
  const [{ data: dialogue, error: e1 }, { data: dlgLines, error: e2 }] = await Promise.all([
    dlg().select('*').eq('id', req.params.id).single(),
    lines().select('id, line_order, speaker, text_jp, text_plain, text_vi')
      .eq('dialogue_id', req.params.id).order('line_order'),
  ]);
  if (e1 || !dialogue) return res.status(404).json({ error: 'Không tìm thấy hội thoại.' });
  if (e2) return res.status(500).json({ error: 'Không tải được nội dung.' });
  logContentUse({ userId: req.user?.id, contentType: 'listening', contentId: dialogue.id,
    creatorType: dialogue.creator_type, ownerId: dialogue.created_by });
  res.json({ ...dialogue, lines: dlgLines });
};

// ── Public: Pronunciation scoring ─────────────────────────────────────────────

exports.scorePronunciation = async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm', target } = req.body || {};
  if (!audioBase64 || !target) return res.status(400).json({ error: 'Thiếu audio hoặc văn bản mục tiêu.' });

  let transcript = '';
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
    const result = await whisperTranscribe(buffer, `rec.${ext}`, mimeType, 'ja');
    transcript = result.text.trim();
  } catch (e) {
    console.error('Whisper error:', e.message);
    return res.status(502).json({ error: 'Lỗi nhận dạng giọng nói.' });
  }

  const score = pronunciationScore(transcript, target);
  const feedback = score >= 90 ? 'Tuyệt vời! Phát âm rất chuẩn.'
    : score >= 75 ? 'Tốt lắm! Phát âm khá tốt.'
    : score >= 60 ? 'Cần luyện thêm một chút nữa là ổn.'
    : 'Hãy nghe mẫu thêm và luyện tập lại nhé.';

  incrementUsage(req.user.id, 'listening_practice_monthly').catch(() => {});
  res.json({ score, transcript, feedback });
};

function pronunciationScore(a, b) {
  const norm = s => s.replace(/[。、！？\s「」『』・]/g, '');
  const na = norm(a), nb = norm(b);
  if (!nb) return 0;
  const dp = Array.from({ length: na.length + 1 }, (_, i) =>
    Array.from({ length: nb.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i-1] === nb[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return Math.max(0, Math.round((1 - dp[na.length][nb.length] / Math.max(na.length, nb.length)) * 100));
}

// ── User: Personal audio upload ───────────────────────────────────────────────

exports.listUserAudio = async (req, res) => {
  const { data, error } = await uadb()
    .select('id, title, level, audio_url, transcript, segments, created_at')
    .eq('student_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Không tải được.' });
  res.json(data || []);
};

exports.uploadAudio = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file âm thanh.' });
  const { title = 'Bài nghe', level = 'N5', language = 'ja' } = req.body;

  const ext = (req.file.originalname.split('.').pop() || 'mp3').toLowerCase();
  const storagePath = `user/${req.user.id}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('listening-passages-audio')
    .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (uploadErr) return res.status(500).json({ error: 'Không thể tải file lên storage.' });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('listening-passages-audio').getPublicUrl(storagePath);

  let transcript = '', segments = [];
  try {
    const result = await whisperTranscribe(req.file.buffer, `audio.${ext}`, req.file.mimetype, language || 'ja');
    transcript = result.text || '';
    segments = result.segments || [];
  } catch (e) {
    console.error('Whisper transcribe error:', e.message);
  }

  const { data, error: dbErr } = await uadb().insert({
    student_id:   req.user.id,
    title,
    level,
    audio_url:    publicUrl,
    storage_path: storagePath,
    transcript,
    segments: segments || [],
  }).select().single();

  if (dbErr) {
    await supabaseAdmin.storage.from('listening-passages-audio').remove([storagePath]);
    return res.status(500).json({ error: 'Không thể lưu thông tin.' });
  }

  res.json(data);
};

exports.deleteUserAudio = async (req, res) => {
  const { data, error } = await uadb()
    .select('storage_path').eq('id', req.params.id).eq('student_id', req.user.id).single();
  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (data.storage_path) {
    await supabaseAdmin.storage.from('listening-passages-audio').remove([data.storage_path]);
  }
  await uadb().delete().eq('id', req.params.id);
  res.json({ ok: true });
};

// ── Admin: Dialogue CRUD ──────────────────────────────────────────────────────

exports.adminListDialogues = async (req, res) => {
  const [{ data: dlgs, error: e1 }, { data: dlgLines, error: e2 }] = await Promise.all([
    dlg().select('*').order('level').order('created_at'),
    lines().select('id, dialogue_id, line_order, speaker, text_jp, text_plain, text_vi').order('line_order'),
  ]);
  if (e1) return res.status(500).json({ error: e1.message || 'Không tải được.' });
  if (e2) return res.status(500).json({ error: e2.message || 'Không tải được lines.' });
  const map = {};
  // Bảo vệ nội dung GV: trang quản lý của admin chỉ hiện hội thoại admin tạo (ẩn của giáo viên).
  (dlgs || []).filter(d => d.creator_type !== 'teacher').forEach(d => { map[d.id] = { ...d, dialogue_lines: [] }; });
  (dlgLines || []).forEach(l => { if (map[l.dialogue_id]) map[l.dialogue_id].dialogue_lines.push(l); });
  res.json(Object.values(map));
};

exports.adminCreateDialogue = async (req, res) => {
  const { title, title_vi, level, topic, thumbnail_icon } = req.body;
  if (!title || !level) return res.status(400).json({ error: 'Cần tiêu đề và cấp độ.' });
  const { data, error } = await dlg()
    .insert({ title, title_vi, level, topic, thumbnail_icon: thumbnail_icon || 'headphones', creator_type: 'admin' })
    .select().single();
  if (error) return res.status(500).json({ error: error.message || 'Không thể tạo hội thoại.' });
  res.json({ ...data, dialogue_lines: [] });
};

// Bảo vệ nội dung giáo viên: admin không được sửa/xóa hội thoại do GV tạo
// (creator_type='teacher'). Hội thoại admin tạo (creator_type 'admin' hoặc null cũ) thì
// mọi admin đều sửa được — giống quy tắc ở khóa học/bài đăng.
const TEACHER_DLG_MSG = 'Không thể sửa hội thoại do giáo viên tạo.';
async function isTeacherDialogue(id) {
  const { data } = await dlg().select('creator_type').eq('id', id).single();
  return data?.creator_type === 'teacher';
}
// Chặn thao tác line theo lineId; trả false + đã gửi response nếu không được phép.
async function guardAdminLineByLineId(lineId, res) {
  const { data: line } = await lines().select('dialogue_id').eq('id', lineId).single();
  if (!line) { res.status(404).json({ error: 'Không tìm thấy câu.' }); return false; }
  if (await isTeacherDialogue(line.dialogue_id)) { res.status(403).json({ error: TEACHER_DLG_MSG }); return false; }
  return true;
}

exports.adminUpdateDialogue = async (req, res) => {
  if (await isTeacherDialogue(req.params.id)) return res.status(403).json({ error: TEACHER_DLG_MSG });
  const { title, title_vi, level, topic, thumbnail_icon } = req.body;
  const { data, error } = await dlg()
    .update({ title, title_vi, level, topic, thumbnail_icon })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message || 'Không thể cập nhật.' });
  res.json(data);
};

exports.adminDeleteDialogue = async (req, res) => {
  if (await isTeacherDialogue(req.params.id)) return res.status(403).json({ error: TEACHER_DLG_MSG });
  const { error } = await dlg().delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message || 'Không thể xóa.' });
  res.json({ ok: true });
};

// ── Admin: Line CRUD ──────────────────────────────────────────────────────────

exports.adminAddLine = async (req, res) => {
  const { speaker, text_jp, text_plain, text_vi } = req.body;
  if (!text_jp || !text_plain) return res.status(400).json({ error: 'Cần nội dung câu.' });
  const { data: existing } = await lines()
    .select('line_order').eq('dialogue_id', req.params.id)
    .order('line_order', { ascending: false }).limit(1);
  const order = (existing?.[0]?.line_order || 0) + 1;
  const { data, error } = await lines()
    .insert({ dialogue_id: req.params.id, speaker: speaker || 'A', text_jp, text_plain, text_vi, line_order: order })
    .select().single();
  if (error) return res.status(500).json({ error: error.message || 'Không thể thêm câu.' });
  res.json(data);
};

exports.adminUpdateLine = async (req, res) => {
  const { speaker, text_jp, text_plain, text_vi, line_order } = req.body;
  const updates = {};
  if (speaker    !== undefined) updates.speaker    = speaker;
  if (text_jp    !== undefined) updates.text_jp    = text_jp;
  if (text_plain !== undefined) updates.text_plain = text_plain;
  if (text_vi    !== undefined) updates.text_vi    = text_vi;
  if (line_order !== undefined) updates.line_order = line_order;
  const { data, error } = await lines()
    .update(updates).eq('id', req.params.lineId).select().single();
  if (error) return res.status(500).json({ error: error.message || 'Không thể cập nhật câu.' });
  res.json(data);
};

exports.adminDeleteLine = async (req, res) => {
  const { error } = await lines().delete().eq('id', req.params.lineId);
  if (error) return res.status(500).json({ error: error.message || 'Không thể xóa câu.' });
  res.json({ ok: true });
};

// Route admin thêm/sửa/xóa câu: chặn hội thoại của giáo viên trước khi tái dùng core.
// (Core adminAddLine/adminUpdateLine/adminDeleteLine còn được teacher tái dùng nên
// không gắn guard trực tiếp vào đó.)
exports.adminAddLineGuarded = async (req, res) => {
  if (await isTeacherDialogue(req.params.id)) return res.status(403).json({ error: TEACHER_DLG_MSG });
  return exports.adminAddLine(req, res);
};
exports.adminUpdateLineGuarded = async (req, res) => {
  if (!(await guardAdminLineByLineId(req.params.lineId, res))) return;
  return exports.adminUpdateLine(req, res);
};
exports.adminDeleteLineGuarded = async (req, res) => {
  if (!(await guardAdminLineByLineId(req.params.lineId, res))) return;
  return exports.adminDeleteLine(req, res);
};

// ── Teacher: own dialogue CRUD (created_by scoped) ────────────────────────────

// Ensure the dialogue belongs to the requesting teacher (admins bypass).
async function ownsDialogue(id, user) {
  const { data } = await dlg().select('created_by').eq('id', id).single();
  if (!data) return false;
  return data.created_by === user.id || user.user_metadata?.role === 'admin';
}

exports.listMyDialogues = async (req, res) => {
  const [{ data: dlgs, error: e1 }, { data: dlgLines, error: e2 }] = await Promise.all([
    dlg().select('*').eq('created_by', req.user.id).order('created_at', { ascending: false }),
    lines().select('id, dialogue_id, line_order, speaker, text_jp, text_plain, text_vi').order('line_order'),
  ]);
  if (e1) return res.status(500).json({ error: e1.message || 'Không tải được.' });
  if (e2) return res.status(500).json({ error: e2.message || 'Không tải được lines.' });
  const map = {};
  (dlgs || []).forEach(d => { map[d.id] = { ...d, dialogue_lines: [] }; });
  (dlgLines || []).forEach(l => { if (map[l.dialogue_id]) map[l.dialogue_id].dialogue_lines.push(l); });
  res.json(Object.values(map));
};

exports.createMyDialogue = async (req, res) => {
  const { title, title_vi, level, topic, thumbnail_icon } = req.body;
  if (!title || !level) return res.status(400).json({ error: 'Cần tiêu đề và cấp độ.' });
  const { data, error } = await dlg()
    .insert({ title, title_vi, level, topic, thumbnail_icon: thumbnail_icon || 'headphones',
      created_by: req.user.id, creator_type: 'teacher', is_published: true })
    .select().single();
  if (error) return res.status(500).json({ error: error.message || 'Không thể tạo hội thoại.' });
  res.json({ ...data, dialogue_lines: [] });
};

exports.updateMyDialogue = async (req, res) => {
  if (!(await ownsDialogue(req.params.id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  const { title, title_vi, level, topic, thumbnail_icon } = req.body;
  const { data, error } = await dlg()
    .update({ title, title_vi, level, topic, thumbnail_icon, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message || 'Không thể cập nhật.' });
  res.json(data);
};

exports.deleteMyDialogue = async (req, res) => {
  if (!(await ownsDialogue(req.params.id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  const { error } = await dlg().delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message || 'Không thể xóa.' });
  res.json({ ok: true });
};

exports.addMyLine = async (req, res) => {
  if (!(await ownsDialogue(req.params.id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  return exports.adminAddLine(req, res);
};

exports.updateMyLine = async (req, res) => {
  const { data: line } = await lines().select('dialogue_id').eq('id', req.params.lineId).single();
  if (!line || !(await ownsDialogue(line.dialogue_id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  return exports.adminUpdateLine(req, res);
};

exports.deleteMyLine = async (req, res) => {
  const { data: line } = await lines().select('dialogue_id').eq('id', req.params.lineId).single();
  if (!line || !(await ownsDialogue(line.dialogue_id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  return exports.adminDeleteLine(req, res);
};
