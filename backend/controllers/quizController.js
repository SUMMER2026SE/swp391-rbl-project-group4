'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Bảng quiz đã chuyển sang schema exam_module (question_bank/users vẫn ở public)
const examDb = supabaseAdmin.schema('exam_module');

// Strict fullscreen: thoát fullscreen quá N lần → khóa thi tạm thời
const MAX_FULLSCREEN_VIOLATIONS = 5;
const LOCKOUT_MINUTES = 20;

// Trả về lockout đang còn hiệu lực của (quiz, user), hoặc null
async function getActiveLockout(quizId, userId) {
  const { data: lock } = await examDb.from('quiz_lockouts')
    .select('violation_count,locked_until')
    .eq('quiz_id', quizId).eq('user_id', userId).maybeSingle();
  if (lock?.locked_until && new Date(lock.locked_until) > new Date()) return lock;
  return null;
}

// GET /api/quizzes
exports.list = async (req, res) => {
  const { course_id, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = examDb.from('quizzes')
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
    const { data: quiz, error } = await examDb
      .from('quizzes').select('*').eq('id', req.params.id).single();
    if (error || !quiz) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    // Strict fullscreen: đang bị khóa thì không trả câu hỏi
    if (quiz.strict_fullscreen) {
      const lock = await getActiveLockout(req.params.id, req.user.id);
      if (lock) {
        return res.status(403).json({
          error: 'Bạn đã thoát toàn màn hình quá nhiều lần, bài thi đang bị khóa.',
          lockedUntil: lock.locked_until,
        });
      }
    }

    const { data: questions } = await examDb
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
  // proctor_events: [{type, at}], snapshots: [storagePath], violation_count: number
  const { answers, violation_count, proctor_events, snapshots } = req.body;

  try {
    const { data: quiz } = await examDb.from('quizzes')
      .select('mode,strict_fullscreen').eq('id', req.params.id).single();

    // Strict fullscreen: đang bị khóa thì không cho nộp bài
    if (quiz?.strict_fullscreen) {
      const lock = await getActiveLockout(req.params.id, userId);
      if (lock) {
        return res.status(403).json({
          error: 'Bài thi đã bị khóa do thoát toàn màn hình quá nhiều lần.',
          lockedUntil: lock.locked_until,
        });
      }
    }

    const { data: questions } = await examDb
      .from('quiz_questions')
      .select('id,question_type,options,correct_answer,correct_answer_data')
      .eq('quiz_id', req.params.id);
    if (!questions) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    let score = 0;
    questions.forEach(q => {
      if (isCorrect(q, answers[q.id])) score++;
    });

    const isProctored = quiz?.mode === 'proctored';
    const { data: attempt, error } = await examDb.from('quiz_attempts').insert({
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

// POST /api/quizzes/:id/fullscreen-violation — ghi nhận 1 lần thoát fullscreen (server-side,
// tránh gian lận reload). Đạt MAX_FULLSCREEN_VIOLATIONS lần → khóa thi LOCKOUT_MINUTES phút.
exports.fullscreenViolation = async (req, res) => {
  const userId = req.user.id;

  try {
    const { data: quiz } = await examDb.from('quizzes')
      .select('strict_fullscreen').eq('id', req.params.id).single();
    if (!quiz) return res.status(404).json({ error: 'Không tìm thấy quiz.' });
    if (!quiz.strict_fullscreen)
      return res.status(400).json({ error: 'Quiz không bật chế độ toàn màn hình nghiêm ngặt.' });

    const { data: existing } = await examDb.from('quiz_lockouts')
      .select('violation_count,locked_until')
      .eq('quiz_id', req.params.id).eq('user_id', userId).maybeSingle();

    // Đang trong thời gian khóa → không tăng đếm nữa
    if (existing?.locked_until && new Date(existing.locked_until) > new Date())
      return res.status(200).json({ locked: true, lockedUntil: existing.locked_until });

    // Lần khóa trước đã hết hạn → đếm lại từ đầu
    const prevCount = existing?.locked_until ? 0 : (existing?.violation_count || 0);
    const violationCount = prevCount + 1;
    const locked = violationCount >= MAX_FULLSCREEN_VIOLATIONS;
    const lockedUntil = locked
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;

    const { error } = await examDb.from('quiz_lockouts').upsert({
      quiz_id: req.params.id,
      user_id: userId,
      violation_count: violationCount,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'quiz_id,user_id' });
    if (error) throw error;

    if (locked) return res.json({ locked: true, lockedUntil });
    res.json({ locked: false, violationCount });
  } catch (err) {
    console.error('Fullscreen violation error:', err);
    res.status(500).json({ error: 'Không thể ghi nhận vi phạm.' });
  }
};

// POST /api/quizzes/:id/proctor-snapshot — upload 1 ảnh webcam (base64) lúc đang thi
exports.uploadProctorSnapshot = async (req, res) => {
  const userId = req.user.id;
  const { image } = req.body; // data URL: "data:image/jpeg;base64,...."
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Thiếu ảnh.' });

  try {
    // Chỉ nhận khi quiz đúng là chế độ giám sát
    const { data: quiz } = await examDb.from('quizzes').select('mode').eq('id', req.params.id).single();
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
    const { data, error } = await examDb
      .from('quiz_attempts').select('*')
      .eq('quiz_id', req.params.id).eq('user_id', req.user.id)
      .order('completed_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải kết quả.' });
  }
};
