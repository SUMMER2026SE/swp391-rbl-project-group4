'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/quizzes
exports.list = async (req, res) => {
  const { course_id, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from('quizzes')
      .select('id,title,title_ja,description,type,time_limit,course_id,lesson_id,created_at', { count: 'exact' })
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (course_id) query = query.eq('course_id', course_id);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải quiz.' });
  }
};

// GET /api/quizzes/:id
exports.getOne = async (req, res) => {
  try {
    const { data: quiz, error } = await supabaseAdmin
      .from('quizzes').select('*').eq('id', req.params.id).single();
    if (error || !quiz) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    const { data: questions } = await supabaseAdmin
      .from('quiz_questions')
      .select('id,question,options,correct_answer,correct_answer_data,question_type,bank_question_id,explanation,order_index')
      .eq('quiz_id', req.params.id).order('order_index');

    res.json({ ...quiz, questions: questions || [] });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải quiz.' });
  }
};

// Chấm một câu theo question_type
function isCorrect(q, ans) {
  const type = q.question_type || 'single_choice';
  if (type === 'multiple_choice') {
    const correct = q.correct_answer_data;
    return Array.isArray(ans) && Array.isArray(correct) &&
      ans.length === correct.length && correct.every(c => ans.includes(c));
  }
  if (type === 'ordering') {
    const correct = q.correct_answer_data;
    return Array.isArray(ans) && Array.isArray(correct) &&
      ans.length === correct.length && correct.every((c, i) => ans[i] === c);
  }
  if (type === 'matching') {
    // options là mảng cặp {left, right} theo đúng thứ tự; answer là mảng right đã chọn
    const pairs = q.options || [];
    return Array.isArray(ans) && pairs.length > 0 &&
      ans.length === pairs.length && pairs.every((p, i) => ans[i] === p.right);
  }
  // single_choice / fill_blank / short_answer — so sánh chuỗi
  if (typeof ans === 'string' && typeof q.correct_answer === 'string')
    return ans.trim() === q.correct_answer.trim();
  return false;
}

// POST /api/quizzes/:id/attempt
exports.submitAttempt = async (req, res) => {
  const userId    = req.user.id;
  // proctor_events: [{type, at}], snapshots: [storagePath], violation_count: number
  const { answers, violation_count, proctor_events, snapshots } = req.body;

  try {
    const { data: quiz } = await supabaseAdmin.from('quizzes').select('mode').eq('id', req.params.id).single();

    const { data: questions } = await supabaseAdmin
      .from('quiz_questions')
      .select('id,question_type,options,correct_answer,correct_answer_data')
      .eq('quiz_id', req.params.id);
    if (!questions) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    let score = 0;
    questions.forEach(q => {
      if (isCorrect(q, answers[q.id])) score++;
    });

    const isProctored = quiz?.mode === 'proctored';
    const { data: attempt, error } = await supabaseAdmin.from('quiz_attempts').insert({
      quiz_id: req.params.id,
      user_id: userId,
      score,
      total_questions: questions.length,
      answers,
      mode: quiz?.mode || 'normal',
      violation_count: isProctored ? (Number(violation_count) || 0) : 0,
      proctor_events:  isProctored && Array.isArray(proctor_events) ? proctor_events : null,
      snapshots:       isProctored && Array.isArray(snapshots) ? snapshots : null,
    }).select().single();

    if (error) throw error;
    res.json({ score, total: questions.length, attempt_id: attempt.id });
  } catch (err) {
    console.error('Submit attempt error:', err);
    res.status(500).json({ error: 'Không thể lưu kết quả.' });
  }
};

// POST /api/quizzes/:id/proctor-snapshot — upload 1 ảnh webcam (base64) lúc đang thi
exports.uploadProctorSnapshot = async (req, res) => {
  const userId = req.user.id;
  const { image } = req.body; // data URL: "data:image/jpeg;base64,...."
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Thiếu ảnh.' });

  try {
    // Chỉ nhận khi quiz đúng là chế độ giám sát
    const { data: quiz } = await supabaseAdmin.from('quizzes').select('mode').eq('id', req.params.id).single();
    if (!quiz || quiz.mode !== 'proctored') return res.status(400).json({ error: 'Quiz không ở chế độ giám sát.' });

    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Ảnh quá lớn.' });

    const path = `${req.params.id}/${userId}/${Date.now()}.jpg`;
    const { error } = await supabaseAdmin.storage
      .from('proctor-snapshots')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;

    res.json({ path });
  } catch (err) {
    console.error('Proctor snapshot error:', err);
    res.status(500).json({ error: 'Không thể lưu ảnh giám sát.' });
  }
};

// GET /api/quizzes/:id/results
exports.getResults = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_attempts').select('*')
      .eq('quiz_id', req.params.id).eq('user_id', req.user.id)
      .order('completed_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải kết quả.' });
  }
};
