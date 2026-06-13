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
exports.isCorrect = isCorrect;

// POST /api/quizzes/:id/attempt
exports.submitAttempt = async (req, res) => {
  const userId    = req.user.id;
  const { answers } = req.body; // { [questionId]: selectedAnswer }

  try {
    const { data: questions } = await supabaseAdmin
      .from('quiz_questions')
      .select('id,question_type,options,correct_answer,correct_answer_data')
      .eq('quiz_id', req.params.id);
    if (!questions) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    let score = 0;
    questions.forEach(q => {
      if (isCorrect(q, answers[q.id])) score++;
    });

    const { data: attempt, error } = await supabaseAdmin.from('quiz_attempts').insert({
      quiz_id: req.params.id,
      user_id: userId,
      score,
      total_questions: questions.length,
      answers,
    }).select().single();

    if (error) throw error;
    res.json({ score, total: questions.length, attempt_id: attempt.id });
  } catch (err) {
    console.error('Submit attempt error:', err);
    res.status(500).json({ error: 'Không thể lưu kết quả.' });
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
