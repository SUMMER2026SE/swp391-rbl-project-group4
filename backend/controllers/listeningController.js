'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { whisperTranscribe } = require('../config/ai');

const db = () => supabaseAdmin.schema('listening_module');

// ── Public: Dialogue list / detail ────────────────────────────────────────────

exports.list = async (req, res) => {
  let q = db().from('dialogues').select('id, title, title_vi, level, topic, thumbnail_icon').order('level').order('created_at');
  if (req.query.level) q = q.eq('level', req.query.level);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: 'Không tải được danh sách.' });
  res.json(data);
};

exports.getOne = async (req, res) => {
  const [{ data: dlg, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    db().from('dialogues').select('*').eq('id', req.params.id).single(),
    db().from('dialogue_lines').select('id, line_order, speaker, text_jp, text_plain, text_vi')
      .eq('dialogue_id', req.params.id).order('line_order'),
  ]);
  if (e1 || !dlg) return res.status(404).json({ error: 'Không tìm thấy hội thoại.' });
  if (e2) return res.status(500).json({ error: 'Không tải được nội dung.' });
  res.json({ ...dlg, lines });
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
  const { data, error } = await db().from('user_audios')
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

  const { data, error: dbErr } = await db().from('user_audios').insert({
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
  const { data, error } = await db().from('user_audios')
    .select('storage_path').eq('id', req.params.id).eq('student_id', req.user.id).single();
  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (data.storage_path) {
    await supabaseAdmin.storage.from('listening-passages-audio').remove([data.storage_path]);
  }
  await db().from('user_audios').delete().eq('id', req.params.id);
  res.json({ ok: true });
};

// ── Admin: Dialogue CRUD ──────────────────────────────────────────────────────

exports.adminListDialogues = async (req, res) => {
  const { data, error } = await db().from('dialogues')
    .select('*, dialogue_lines(id, line_order, speaker, text_jp, text_plain, text_vi)')
    .order('level').order('created_at');
  if (error) return res.status(500).json({ error: 'Không tải được.' });
  (data || []).forEach(d => d.dialogue_lines?.sort((a, b) => a.line_order - b.line_order));
  res.json(data || []);
};

exports.adminCreateDialogue = async (req, res) => {
  const { title, title_vi, level, topic, thumbnail_icon } = req.body;
  if (!title || !level) return res.status(400).json({ error: 'Cần tiêu đề và cấp độ.' });
  const { data, error } = await db().from('dialogues')
    .insert({ title, title_vi, level, topic, thumbnail_icon: thumbnail_icon || 'headphones' })
    .select().single();
  if (error) return res.status(500).json({ error: 'Không thể tạo hội thoại.' });
  res.json({ ...data, dialogue_lines: [] });
};

exports.adminUpdateDialogue = async (req, res) => {
  const { title, title_vi, level, topic, thumbnail_icon } = req.body;
  const { data, error } = await db().from('dialogues')
    .update({ title, title_vi, level, topic, thumbnail_icon })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật.' });
  res.json(data);
};

exports.adminDeleteDialogue = async (req, res) => {
  const { error } = await db().from('dialogues').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Không thể xóa.' });
  res.json({ ok: true });
};

// ── Admin: Line CRUD ──────────────────────────────────────────────────────────

exports.adminAddLine = async (req, res) => {
  const { speaker, text_jp, text_plain, text_vi } = req.body;
  if (!text_jp || !text_plain) return res.status(400).json({ error: 'Cần nội dung câu.' });
  const { data: existing } = await db().from('dialogue_lines')
    .select('line_order').eq('dialogue_id', req.params.id)
    .order('line_order', { ascending: false }).limit(1);
  const order = (existing?.[0]?.line_order || 0) + 1;
  const { data, error } = await db().from('dialogue_lines')
    .insert({ dialogue_id: req.params.id, speaker: speaker || 'A', text_jp, text_plain, text_vi, line_order: order })
    .select().single();
  if (error) return res.status(500).json({ error: 'Không thể thêm câu.' });
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
  const { data, error } = await db().from('dialogue_lines')
    .update(updates).eq('id', req.params.lineId).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật câu.' });
  res.json(data);
};

exports.adminDeleteLine = async (req, res) => {
  const { error } = await db().from('dialogue_lines').delete().eq('id', req.params.lineId);
  if (error) return res.status(500).json({ error: 'Không thể xóa câu.' });
  res.json({ ok: true });
};
