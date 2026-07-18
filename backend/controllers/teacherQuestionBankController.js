'use strict';

// Each teacher has a private question bank (teacher_question_bank) and private
// reading passages (teacher_reading_passages), scoped by teacher_id. Teachers
// can also browse the admin global bank (question_bank, read-only) and copy
// questions from it into their own bank. Mirrors adminController's question-bank
// handlers so the same frontend can drive both via an apiBase prop.

const { supabaseAdmin } = require('../config/supabase');
const { snapshotsForBankRows } = require('../utils/passageSnapshot');

// Embed teacher's own passages but expose them under the `reading_passages` key
// so the shared frontend (which reads item.reading_passages) works unchanged.
const QB_SELECT = '*, reading_passages:teacher_reading_passages(id, title)';

// ── Question bank ───────────────────────────────────────────────────────────
exports.listQuestionBank = async (req, res) => {
  const { level, skill, topic, difficulty, status, question_type, passage_id, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.schema('exam_module').from('teacher_question_bank')
      .select(QB_SELECT, { count: 'exact' })
      .eq('teacher_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)         query = query.eq('level', level);
    if (skill)         query = query.eq('skill', skill);
    if (topic)         query = query.ilike('topic', `%${topic}%`);
    if (difficulty)    query = query.eq('difficulty', difficulty);
    if (status)        query = query.eq('status', status);
    if (question_type) query = query.eq('question_type', question_type);
    if (passage_id)    query = query.eq('passage_id', passage_id);
    if (search)        query = query.ilike('question_text', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải câu hỏi.' });
  }
};

exports.questionBankStats = async (req, res) => {
  try {
    const [total, pending, byLevel] = await Promise.all([
      supabaseAdmin.schema('exam_module').from('teacher_question_bank').select('id', { count: 'exact', head: true }).eq('teacher_id', req.user.id),
      supabaseAdmin.schema('exam_module').from('teacher_question_bank').select('id', { count: 'exact', head: true }).eq('teacher_id', req.user.id).eq('status', 'pending'),
      supabaseAdmin.schema('exam_module').from('teacher_question_bank').select('level').eq('teacher_id', req.user.id).not('level', 'is', null),
    ]);
    const levelCounts = {};
    (byLevel.data || []).forEach(r => { levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });
    const topLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    res.json({ total: total.count || 0, pending: pending.count || 0, topLevel });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải thống kê.' });
  }
};

exports.createQuestionBank = async (req, res) => {
  const { question_text, options, correct_answer, explanation, level, skill, topic, difficulty, status, is_ai_generated, question_type, passage_id } = req.body;
  if (!question_text) return res.status(400).json({ error: 'Nội dung câu hỏi là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.schema('exam_module').from('teacher_question_bank')
      .insert({ teacher_id: req.user.id, question_text, options: options ?? [], correct_answer, explanation, level, skill, topic, difficulty: difficulty || 'medium', status: status || 'approved', is_ai_generated: !!is_ai_generated, question_type: question_type || 'single_choice', passage_id: passage_id || null })
      .select(QB_SELECT).single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestionBank = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.schema('exam_module').from('teacher_question_bank').select('teacher_id').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    const allowed = ['question_text','options','correct_answer','explanation','level','skill','topic','difficulty','status','is_ai_generated','question_type','passage_id'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if ('passage_id' in updates && !updates.passage_id) updates.passage_id = null;
    const { data, error } = await supabaseAdmin.schema('exam_module').from('teacher_question_bank').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.bulkCreateQuestionBank = async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'Danh sách câu hỏi không được rỗng.' });
  try {
    const rows = questions.map(q => ({
      teacher_id:     req.user.id,
      question_text:  q.question_text,
      question_type:  q.question_type || 'single_choice',
      options:        q.options ?? [],
      correct_answer: q.correct_answer ?? null,
      explanation:    q.explanation   || null,
      level:          q.level         || null,
      skill:          q.skill         || null,
      topic:          q.topic         || null,
      difficulty:     q.difficulty    || 'medium',
      status:         'approved',
      is_ai_generated: true,
      passage_id:     q.passage_id    || null,
    }));
    const { data, error } = await supabaseAdmin.schema('exam_module').from('teacher_question_bank').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { res.status(500).json({ error: 'Không thể lưu câu hỏi.' }); }
};

exports.aiGenerateQuestions = async (req, res) => {
  const { generateQuestions } = require('../utils/questionGen');
  const {
    passage_id, custom_content,
    question_types = ['single_choice'],
    count = 5, level, difficulty = 'medium', topic, skill,
  } = req.body;

  if (!passage_id && !custom_content)
    return res.status(400).json({ error: 'Cần cung cấp bài đọc hoặc nội dung tự do.' });
  if (!Array.isArray(question_types) || !question_types.length)
    return res.status(400).json({ error: 'Chọn ít nhất 1 loại câu hỏi.' });

  let contentText = custom_content || '';
  let passageTitle = '';

  if (passage_id) {
    const { data: passage, error } = await supabaseAdmin
        .schema('exam_module')
      .from('teacher_reading_passages').select('title, content, image_url, teacher_id').eq('id', passage_id).single();
    if (error || !passage) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    if (passage.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    passageTitle = passage.title || '';
    contentText  = passage.content || '';
    if (!contentText && passage.image_url)
      contentText = `[Bài đọc dạng hình ảnh: ${passageTitle}]`;
  }

  if (!contentText.trim())
    return res.status(400).json({ error: 'Nội dung bài đọc trống.' });

  try {
    const { questions, usage } = await generateQuestions({
      contentText, passageTitle, question_types, count, level, difficulty, topic, skill, passage_id,
    });
    res.json({ questions, count: questions.length, usage });
  } catch (err) {
    res.status(err.httpStatus || 502).json({ error: err.message, ...(err.raw ? { raw: err.raw } : {}) });
  }
};

exports.deleteQuestionBank = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.schema('exam_module').from('teacher_question_bank').select('teacher_id').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    await supabaseAdmin.schema('exam_module').from('teacher_question_bank').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Admin global bank (read-only) + import ────────────────────────────────────
exports.listGlobalBank = async (req, res) => {
  const { level, skill, topic, difficulty, question_type, passage_id, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.schema('exam_module').from('question_bank')
      .select('*, reading_passages(id, title)', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)         query = query.eq('level', level);
    if (skill)         query = query.eq('skill', skill);
    if (topic)         query = query.ilike('topic', `%${topic}%`);
    if (difficulty)    query = query.eq('difficulty', difficulty);
    if (question_type) query = query.eq('question_type', question_type);
    if (passage_id)    query = query.eq('passage_id', passage_id);
    if (search)        query = query.ilike('question_text', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải ngân hàng chung.' });
  }
};

// Copy selected admin questions into the teacher's private bank.
exports.importFromGlobal = async (req, res) => {
  const { question_ids } = req.body;
  if (!Array.isArray(question_ids) || !question_ids.length)
    return res.status(400).json({ error: 'Không có câu hỏi được chọn.' });
  try {
    const { data: bankRows, error: fetchErr } = await supabaseAdmin
        .schema('exam_module')
      .from('question_bank').select('*').in('id', question_ids).eq('status', 'approved');
    if (fetchErr) throw fetchErr;
    if (!bankRows || !bankRows.length) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });

    // Không link passage của admin (khác chủ sở hữu) — thay vào đó đóng băng snapshot.
    const getSnap = await snapshotsForBankRows(bankRows);

    const rows = bankRows.map(bq => ({
      teacher_id:      req.user.id,
      source_bank_id:  bq.id,
      question_text:   bq.question_text,
      question_type:   bq.question_type || 'single_choice',
      options:         bq.options ?? [],
      correct_answer:  bq.correct_answer ?? null,
      explanation:     bq.explanation || null,
      level:           bq.level || null,
      skill:           bq.skill || null,
      topic:           bq.topic || null,
      difficulty:      bq.difficulty || 'medium',
      status:          'approved',
      is_ai_generated: !!bq.is_ai_generated,
      passage_id:      null, // global passages belong to admin; don't link
      passage_snapshot: getSnap(bq),
    }));

    const { data, error } = await supabaseAdmin.schema('exam_module').from('teacher_question_bank').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { res.status(500).json({ error: 'Không thể nhập câu hỏi.' }); }
};

// ── Reading passages (private) ────────────────────────────────────────────────
exports.uploadPassageImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error } = await supabaseAdmin.storage
      .from('passage-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('passage-images').getPublicUrl(filename);
    res.json({ url: publicUrl });
  } catch (err) { res.status(500).json({ error: 'Không thể tải ảnh lên.' }); }
};

exports.listPassages = async (req, res) => {
  try {
    const { data: passages, error } = await supabaseAdmin
        .schema('exam_module')
      .from('teacher_reading_passages')
      .select('*')
      .eq('teacher_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: links } = await supabaseAdmin
      .from('teacher_question_bank')
      .select('passage_id')
      .eq('teacher_id', req.user.id)
      .not('passage_id', 'is', null);
    const countMap = {};
    (links || []).forEach(r => { countMap[r.passage_id] = (countMap[r.passage_id] || 0) + 1; });

    res.json((passages || []).map(p => ({ ...p, question_count: countMap[p.id] || 0 })));
  } catch (err) { res.status(500).json({ error: 'Không thể tải bài đọc.' }); }
};

exports.createPassage = async (req, res) => {
  const { title, content, image_url, level, topic, source } = req.body;
  if (!content?.trim() && !image_url) return res.status(400).json({ error: 'Bài đọc phải có nội dung text hoặc hình ảnh.' });
  try {
    const { data, error } = await supabaseAdmin.schema('exam_module').from('teacher_reading_passages')
      .insert({ teacher_id: req.user.id, title, content: content || null, image_url: image_url || null, level, topic, source })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, question_count: 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài đọc.' }); }
};

exports.updatePassage = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.schema('exam_module').from('teacher_reading_passages').select('teacher_id').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    const allowed = ['title', 'content', 'image_url', 'level', 'topic', 'source'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if ('image_url' in updates && !updates.image_url) updates.image_url = null;
    if ('content'   in updates && !updates.content)   updates.content   = null;
    const { data, error } = await supabaseAdmin.schema('exam_module').from('teacher_reading_passages')
        .schema('exam_module')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài đọc.' }); }
};

exports.deletePassage = async (req, res) => {
  try {
    const { data: p } = await supabaseAdmin.schema('exam_module').from('teacher_reading_passages').select('image_url, teacher_id').eq('id', req.params.id).single();
    if (!p || p.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    await supabaseAdmin.schema('exam_module').from('teacher_question_bank').update({ passage_id: null }).eq('passage_id', req.params.id);
    await supabaseAdmin.schema('exam_module').from('teacher_reading_passages').delete().eq('id', req.params.id);
    if (p?.image_url) {
      const filename = p.image_url.split('/').pop();
      await supabaseAdmin.storage.from('passage-images').remove([filename]);
    }
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài đọc.' }); }
};