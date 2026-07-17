'use strict';

// ─── Ngân hàng đề JLPT riêng (jlpt_module.jlpt_bank_*) ────────────────────────
// Kho câu hỏi theo cấp × dạng mondai, TÁCH BIỆT khỏi question_bank khóa học.
// Là nguồn cho chức năng import (copy snapshot) vào đề thi thử JLPT.
// - Câu đơn (từ vựng/ngữ pháp/nghe): group_id NULL.
// - Nhóm passage (7 dạng đọc): jlpt_bank_groups + các câu con.

const { supabaseAdmin } = require('../config/supabase');
const { MONDAI_TYPES, validateQuestionPayload } = require('../utils/jlptMock');

const jlptDb = supabaseAdmin.schema('jlpt_module');

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SOURCES = ['manual', 'ai', 'import'];
// Các dạng có passage dùng chung — chỉ những dạng này được tạo nhóm trong bank
const PASSAGE_TYPES = ['text_grammar', 'reading_short', 'reading_mid', 'reading_long',
  'integrated_reading', 'thematic_reading', 'info_retrieval'];

function handleError(res, err, fallback) {
  console.error(err);
  res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : fallback });
}

// Kiểm tra level + mondai_type hợp lệ, trả về meta của dạng mondai
function assertLevelType(level, mondaiType) {
  if (!LEVELS.includes(level)) { const e = new Error('Cấp độ JLPT không hợp lệ.'); e.httpStatus = 400; throw e; }
  const meta = MONDAI_TYPES[mondaiType];
  if (!meta) { const e = new Error('Loại mondai không hợp lệ.'); e.httpStatus = 400; throw e; }
  return meta;
}

// Chuẩn hóa 1 câu payload → row insert (score_category luôn suy từ dạng mondai)
function toRow(q, { level, mondaiType, meta, groupId, userId, source }) {
  return {
    group_id:            groupId || null,
    level,
    mondai_type:         mondaiType,
    score_category:      meta.category,
    question_text:       q.question_text?.trim() || null,
    image_url:           q.image_url || null,
    audio_url:           q.audio_url || null,
    audio_transcript:    q.audio_transcript?.trim() || null,
    options:             q.options.map(o => String(o).trim()),
    correct_index:       Number(q.correct_index),
    explanation:         q.explanation || null,
    translation_vi:      q.translation_vi || null,
    option_translations: q.option_translations || null,
    source:              SOURCES.includes(source) ? source : 'manual',
    created_by:          userId || null,
  };
}

// ─── Thống kê ─────────────────────────────────────────────────────────────────

// GET /api/admin/jlpt-bank/stats?level=N5 — đếm số câu trong bank theo mondai_type
exports.stats = async (req, res) => {
  const { level } = req.query;
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  try {
    const { data, error } = await jlptDb.from('jlpt_bank_questions')
      .select('mondai_type').eq('level', level);
    if (error) throw error;
    const counts = {};
    (data || []).forEach(r => { counts[r.mondai_type] = (counts[r.mondai_type] || 0) + 1; });
    res.json({ counts });
  } catch (err) { handleError(res, err, 'Không thể tải thống kê ngân hàng.'); }
};

// ─── Câu hỏi (jlpt_bank_questions) ────────────────────────────────────────────

// GET /api/admin/jlpt-bank/questions?level=&mondai_type=&search=&page=&limit=
exports.listQuestions = async (req, res) => {
  const { level, mondai_type, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = jlptDb.from('jlpt_bank_questions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level)       query = query.eq('level', level);
    if (mondai_type) query = query.eq('mondai_type', mondai_type);
    if (search)      query = query.ilike('question_text', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: data || [], total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { handleError(res, err, 'Không thể tải câu hỏi trong ngân hàng.'); }
};

// POST /api/admin/jlpt-bank/questions — bulk, body { level, mondai_type, group_id?, source?, questions: [...] }
exports.createQuestions = async (req, res) => {
  const { level, mondai_type, group_id, source, questions } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'Danh sách câu hỏi không được rỗng.' });
  try {
    const meta = assertLevelType(level, mondai_type);
    for (let i = 0; i < questions.length; i++) {
      const msg = validateQuestionPayload(questions[i]);
      if (msg) return res.status(400).json({ error: `Câu ${i + 1}: ${msg}` });
    }
    // Gắn vào nhóm passage: nhóm phải tồn tại và khớp level + mondai_type
    if (group_id) {
      const { data: g } = await jlptDb.from('jlpt_bank_groups')
        .select('id, level, mondai_type').eq('id', group_id).single();
      if (!g) return res.status(404).json({ error: 'Không tìm thấy nhóm passage.' });
      if (g.level !== level || g.mondai_type !== mondai_type)
        return res.status(400).json({ error: 'Nhóm passage không khớp cấp độ/dạng mondai.' });
    }
    const rows = questions.map(q => toRow(q, { level, mondaiType: mondai_type, meta, groupId: group_id, userId: req.user?.id, source }));
    const { data, error } = await jlptDb.from('jlpt_bank_questions').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { handleError(res, err, 'Không thể thêm câu hỏi vào ngân hàng.'); }
};

// PUT /api/admin/jlpt-bank/questions/:id
exports.updateQuestion = async (req, res) => {
  const allowed = ['question_text', 'image_url', 'audio_url', 'audio_transcript',
    'options', 'correct_index', 'explanation', 'translation_vi', 'option_translations'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });
  try {
    const { data: q } = await jlptDb.from('jlpt_bank_questions').select('*').eq('id', req.params.id).single();
    if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });

    const merged = { ...q, ...updates };
    const msg = validateQuestionPayload(merged);
    if (msg) return res.status(400).json({ error: msg });

    const { data, error } = await jlptDb.from('jlpt_bank_questions')
      .update(updates).eq('id', q.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật câu hỏi.'); }
};

// DELETE /api/admin/jlpt-bank/questions/:id
exports.deleteQuestion = async (req, res) => {
  try {
    const { error } = await jlptDb.from('jlpt_bank_questions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa câu hỏi khỏi ngân hàng.' });
  } catch (err) { handleError(res, err, 'Không thể xóa câu hỏi.'); }
};

// ─── Nhóm passage (jlpt_bank_groups) ──────────────────────────────────────────

// GET /api/admin/jlpt-bank/groups?level=&mondai_type=&page=&limit= — kèm câu con
exports.listGroups = async (req, res) => {
  const { level, mondai_type, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = jlptDb.from('jlpt_bank_groups')
      .select('*, jlpt_bank_questions(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level)       query = query.eq('level', level);
    if (mondai_type) query = query.eq('mondai_type', mondai_type);

    const { data, error, count } = await query;
    if (error) throw error;
    const groups = (data || []).map(g => ({
      ...g,
      jlpt_bank_questions: (g.jlpt_bank_questions || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }));
    res.json({ data: groups, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { handleError(res, err, 'Không thể tải nhóm passage.'); }
};

// POST /api/admin/jlpt-bank/groups — body { level, mondai_type, title, passage_text, image_url, source?, questions?: [...] }
exports.createGroup = async (req, res) => {
  const { level, mondai_type, title, passage_text, image_url, source, questions } = req.body;
  try {
    const meta = assertLevelType(level, mondai_type);
    if (!PASSAGE_TYPES.includes(mondai_type))
      return res.status(400).json({ error: 'Chỉ các dạng đọc có passage mới tạo được nhóm.' });
    if (Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const msg = validateQuestionPayload(questions[i]);
        if (msg) return res.status(400).json({ error: `Câu ${i + 1}: ${msg}` });
      }
    }
    const { data: group, error } = await jlptDb.from('jlpt_bank_groups')
      .insert({
        level, mondai_type,
        title:        title?.trim() || null,
        passage_text: passage_text?.trim() || null,
        image_url:    image_url || null,
        created_by:   req.user?.id || null,
      }).select().single();
    if (error) throw error;

    let saved = [];
    if (Array.isArray(questions) && questions.length) {
      const rows = questions.map(q => toRow(q, { level, mondaiType: mondai_type, meta, groupId: group.id, userId: req.user?.id, source }));
      const { data, error: qErr } = await jlptDb.from('jlpt_bank_questions').insert(rows).select();
      if (qErr) throw qErr;
      saved = data;
    }
    res.status(201).json({ ...group, jlpt_bank_questions: saved });
  } catch (err) { handleError(res, err, 'Không thể tạo nhóm passage.'); }
};

// PUT /api/admin/jlpt-bank/groups/:id
exports.updateGroup = async (req, res) => {
  const allowed = ['title', 'passage_text', 'image_url'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });
  try {
    const { data, error } = await jlptDb.from('jlpt_bank_groups')
      .update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy nhóm passage.' });
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật nhóm passage.'); }
};

// DELETE /api/admin/jlpt-bank/groups/:id — cascade xóa câu con
exports.deleteGroup = async (req, res) => {
  try {
    const { error } = await jlptDb.from('jlpt_bank_groups').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa nhóm passage (kèm các câu con).' });
  } catch (err) { handleError(res, err, 'Không thể xóa nhóm passage.'); }
};

// ─── AI sinh nháp vào bank ────────────────────────────────────────────────────

// POST /api/admin/jlpt-bank/ai-generate — body { level, mondai_type, count, topic, instruction, passage_text }
// Trả NHÁP để admin duyệt/sửa — KHÔNG ghi DB. Câu đã có trong bank (cùng cấp + dạng)
// được đưa vào prompt chống trùng lặp.
exports.aiGenerate = async (req, res) => {
  const { level, mondai_type, topic, instruction, passage_text } = req.body;
  const count = Math.min(Math.max(Number(req.body.count) || 5, 1), 15);
  try {
    assertLevelType(level, mondai_type);
    const { data: existing } = await jlptDb.from('jlpt_bank_questions')
      .select('question_text, options, correct_index, audio_transcript')
      .eq('level', level).eq('mondai_type', mondai_type)
      .order('created_at', { ascending: false }).limit(100);
    const summaries = (existing || []).map(q => {
      const answer = Array.isArray(q.options) ? q.options[q.correct_index] : '';
      const text = q.question_text || (q.audio_transcript ? String(q.audio_transcript).slice(0, 80) : '');
      return `${text}${answer ? ` → ${answer}` : ''}`;
    }).filter(Boolean);

    const { generateMondaiQuestions } = require('../utils/jlptQuestionGen');
    const result = await generateMondaiQuestions({
      level,
      mondaiType:        mondai_type,
      count,
      passageText:       passage_text || '',
      topic:             topic || '',
      instruction:       instruction || '',
      existingQuestions: summaries,
    });
    res.json(result);
  } catch (err) { handleError(res, err, 'Không thể sinh câu hỏi bằng AI.'); }
};

// ─── TTS cho câu nghe trong bank ──────────────────────────────────────────────

// POST /api/admin/jlpt-bank/questions/:id/tts — đọc audio_transcript → mp3 → gán audio_url
exports.generateQuestionAudio = async (req, res) => {
  try {
    const { data: q } = await jlptDb.from('jlpt_bank_questions')
      .select('id, audio_transcript').eq('id', req.params.id).single();
    if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });

    const { synthesizeTranscript } = require('../utils/ttsJa');
    let buffer;
    try {
      buffer = await synthesizeTranscript(q.audio_transcript);
    } catch (err) {
      if (!err.httpStatus) { err.httpStatus = 502; err.message = 'Dịch vụ tạo giọng đọc không phản hồi. Hãy thử lại hoặc tải file thu âm lên.'; }
      throw err;
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('mock-exam-audio')
      .upload(filename, buffer, { contentType: 'audio/mpeg', upsert: false });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('mock-exam-audio').getPublicUrl(filename);

    const { data, error } = await jlptDb.from('jlpt_bank_questions')
      .update({ audio_url: publicUrl }).eq('id', q.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể tạo audio từ transcript.'); }
};
