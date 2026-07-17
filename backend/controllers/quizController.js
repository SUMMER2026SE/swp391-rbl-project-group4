'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { checkCourseContentAccess } = require('../services/courseAccess');
const { chatCompletion } = require('../config/ai');
const { computePassed } = require('../services/passThreshold');

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

    // Paywall: quiz thuộc khóa có phí → phải enroll mới trả câu hỏi
    const denied = await checkCourseContentAccess(quiz.course_id, req.user);
    if (denied) return res.status(403).json(denied);

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
      .select('id,question,options,correct_answer,correct_answer_data,question_type,bank_question_id,explanation,passage_snapshot,order_index')
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

// So khớp chính xác cho short_answer: trim + không phân biệt hoa/thường
// (để tiết kiệm gọi AI khi đáp án khớp hoàn toàn).
function shortAnswerExactMatch(q, ans) {
  return typeof ans === 'string' && typeof q.correct_answer === 'string'
    && ans.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
}

// Chấm short_answer bằng AI khi không khớp chuỗi chính xác: đánh giá câu trả lời
// có ĐÚNG VỀ NGHĨA so với đáp án mẫu không. Lỗi/parse thất bại → coi là SAI (an toàn).
async function gradeShortAnswerAI(q, ans) {
  const prompt =
`Bạn là giáo viên chấm câu trả lời ngắn của học viên tiếng Nhật.

CÂU HỎI: 「${q.question || ''}」
ĐÁP ÁN MẪU: 「${q.correct_answer || ''}」
CÂU TRẢ LỜI CỦA HỌC VIÊN: 「${ans.trim()}」

Hãy đánh giá xem câu trả lời của học viên có ĐÚNG VỀ NGHĨA so với đáp án mẫu hay không.
Chấp nhận khác biệt nhỏ về chính tả, dấu câu, cách diễn đạt nếu vẫn đúng nghĩa.

Trả về JSON THUẦN (không markdown):
{ "correct": true/false, "comment": "<nhận xét ngắn 1 câu tiếng Việt>" }`;

  try {
    const r = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { model: process.env.FPT_AI_MODEL || 'gemma-4-31B-it', temperature: 0, max_tokens: 300 }
    );
    const txt = r.choices?.[0]?.message?.content || '';
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : txt);
    return {
      correct: parsed.correct === true,
      ai_used: true,
      comment: typeof parsed.comment === 'string' ? parsed.comment.slice(0, 500) : '',
    };
  } catch (e) {
    console.error('AI short_answer grade error:', e.message);
    return { correct: false, ai_used: false, comment: '' };
  }
}

// POST /api/quizzes/:id/attempt
exports.submitAttempt = async (req, res) => {
  const userId    = req.user.id;
  // proctor_events: [{type, at}], snapshots: [storagePath], violation_count: number
  const { answers, violation_count, proctor_events, snapshots } = req.body;

  try {
    const { data: quiz } = await examDb.from('quizzes')
      .select('mode,strict_fullscreen,passing_type,passing_value').eq('id', req.params.id).single();

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
      .select('id,question,question_type,options,correct_answer,correct_answer_data')
      .eq('quiz_id', req.params.id);
    if (!questions) return res.status(404).json({ error: 'Không tìm thấy quiz.' });

    let score = 0;
    const aiFeedback = {};   // question_id -> { correct, ai_used, comment }
    const aiTasks   = [];    // short_answer chưa khớp chính xác → cần AI

    questions.forEach(q => {
      const ans = answers[q.id];
      if ((q.question_type || 'single_choice') === 'short_answer') {
        // Ưu tiên so khớp chính xác để tiết kiệm gọi AI
        if (shortAnswerExactMatch(q, ans)) {
          score++;
        } else if (typeof ans === 'string' && ans.trim() !== '') {
          aiTasks.push(q);   // để AI chấm theo nghĩa
        }
        // Câu bỏ trống → tính sai, không gọi AI
      } else if (isCorrect(q, ans)) {
        score++;
      }
    });

    // Gọi AI song song cho tất cả short_answer cần chấm theo nghĩa
    const aiResults = await Promise.all(aiTasks.map(q => gradeShortAnswerAI(q, answers[q.id])));
    aiTasks.forEach((q, i) => {
      aiFeedback[q.id] = aiResults[i];
      if (aiResults[i].correct) score++;
    });

    const isProctored = quiz?.mode === 'proctored';
    const passed = computePassed(quiz?.passing_type, quiz?.passing_value, score, questions.length);
    const { data: attempt, error } = await examDb.from('quiz_attempts').insert({
      quiz_id: req.params.id,
      user_id: userId,
      score,
      total_questions: questions.length,
      answers,
      passed,
      mode: quiz?.mode || 'normal',
      violation_count: isProctored ? (Number(violation_count) || 0) : 0,
      proctor_events:  isProctored && Array.isArray(proctor_events) ? proctor_events : null,
      snapshots:       isProctored && Array.isArray(snapshots) ? snapshots : null,
      ai_feedback:     Object.keys(aiFeedback).length ? aiFeedback : null,
    }).select().single();

    if (error) throw error;
    res.json({ score, total: questions.length, attempt_id: attempt.id, passed, ai_feedback: aiFeedback });
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

// GET /api/quizzes/history — lịch sử làm quiz của học sinh (mọi quiz), kèm nhãn đạt/không đạt đã lưu
exports.history = async (req, res) => {
  try {
    const { data: attempts, error } = await examDb.from('quiz_attempts')
      .select('id,quiz_id,score,total_questions,passed,completed_at')
      .eq('user_id', req.user.id)
      .order('completed_at', { ascending: false });
    if (error) throw error;

    const quizIds = [...new Set((attempts || []).map(a => a.quiz_id))];
    let titles = {};
    if (quizIds.length) {
      const { data: quizzes } = await examDb.from('quizzes').select('id,title').in('id', quizIds);
      titles = Object.fromEntries((quizzes || []).map(q => [q.id, q.title]));
    }
    res.json((attempts || []).map(a => ({ ...a, quiz_title: titles[a.quiz_id] || null })));
  } catch (err) {
    console.error('Quiz history error:', err);
    res.status(500).json({ error: 'Không thể tải lịch sử bài thi.' });
  }
};
