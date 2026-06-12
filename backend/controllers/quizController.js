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

// POST /api/quizzes/:id/attempt
exports.submitAttempt = async (req, res) => {
  const userId    = req.user.id;
  const { answers } = req.body; // { [questionId]: selectedAnswer }

  try {
    const { data: questions } = await supabaseAdmin
      .from('quiz_questions').select('id,correct_answer').eq('quiz_id', req.params.id);
    if (!questions) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) score++;
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
