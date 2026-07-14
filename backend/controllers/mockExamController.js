'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { computeJlptScores, SCORE_COLUMNS, PASS_TOTAL } = require('../utils/jlptMock');
const { getUserTier } = require('../services/quotaService');

// Grace 10s cho độ trễ mạng khi auto-submit lúc hết giờ
const GRACE_MS = 10 * 1000;

// Whitelist cột trả cho student — TUYỆT ĐỐI KHÔNG gồm correct_index/explanation/audio_transcript
const QUESTION_PUBLIC = 'id, group_id, position, question_text, image_url, audio_url, options';
const GROUP_PUBLIC = 'id, section_id, position, mondai_number, mondai_type, instruction_text, passage_text, image_url, audio_url, score_category';

function handleError(res, err, fallback) {
  console.error(err);
  res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : fallback });
}

// Nạp toàn bộ câu hỏi (kèm đáp án — server-side) để chấm điểm
async function loadExamQuestionsForScoring(examId) {
  const { data: sections } = await supabaseAdmin
    .from('mock_exam_sections').select('id').eq('exam_id', examId);
  const sectionIds = (sections || []).map(s => s.id);
  if (!sectionIds.length) return [];
  const { data: groups } = await supabaseAdmin
    .from('mock_question_groups').select('id, score_category').in('section_id', sectionIds);
  const groupCat = {};
  (groups || []).forEach(g => { groupCat[g.id] = g.score_category; });
  const groupIds = Object.keys(groupCat);
  if (!groupIds.length) return [];
  const { data: questions } = await supabaseAdmin
    .from('mock_questions').select('id, group_id, correct_index').in('group_id', groupIds);
  return (questions || []).map(q => ({ id: q.id, correct_index: q.correct_index, score_category: groupCat[q.group_id] }));
}

// Lấy các câu hỏi (sanitized) của 1 section theo position
async function loadSectionForAttempt(examId, position) {
  const { data: section } = await supabaseAdmin
    .from('mock_exam_sections').select('id, position, section_type, title, time_limit_minutes')
    .eq('exam_id', examId).eq('position', position).single();
  if (!section) return null;

  const { data: groups } = await supabaseAdmin
    .from('mock_question_groups').select(GROUP_PUBLIC).eq('section_id', section.id).order('position');
  const groupIds = (groups || []).map(g => g.id);
  let questions = [];
  if (groupIds.length) {
    const { data: q } = await supabaseAdmin
      .from('mock_questions').select(QUESTION_PUBLIC).in('group_id', groupIds).order('position');
    questions = q || [];
  }
  return {
    ...section,
    groups: (groups || []).map(g => ({ ...g, questions: questions.filter(q => q.group_id === g.id) })),
  };
}

// Chốt điểm toàn bài + đánh dấu is_correct cho từng câu đã trả lời
async function finalizeAttempt(attempt) {
  const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, level').eq('id', attempt.exam_id).single();
  const questions = await loadExamQuestionsForScoring(attempt.exam_id);
  const { data: answers } = await supabaseAdmin
    .from('mock_attempt_answers').select('question_id, selected_index').eq('attempt_id', attempt.id);
  const answersMap = {};
  (answers || []).forEach(a => { answersMap[a.question_id] = a.selected_index; });

  const { scores, total_score, passed, perQuestion } = computeJlptScores(questions, answersMap, exam.level);

  // cập nhật is_correct cho các câu đã trả lời
  const correctById = {};
  perQuestion.forEach(p => { correctById[p.question_id] = p.is_correct; });
  for (const a of answers || []) {
    await supabaseAdmin.from('mock_attempt_answers')
      .update({ is_correct: !!correctById[a.question_id] })
      .eq('attempt_id', attempt.id).eq('question_id', a.question_id);
  }

  const duration = Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000));
  const { data: updated } = await supabaseAdmin.from('mock_attempts')
    .update({
      status: 'submitted', scores, total_score, passed,
      duration_seconds: duration, submitted_at: new Date().toISOString(),
      section_deadline_at: null,
    })
    .eq('id', attempt.id).select().single();
  return updated;
}

// Nếu attempt in_progress đã quá deadline: tự chốt section hiện tại và tiến tới.
// Trả về attempt (đã cập nhật nếu có thay đổi).
async function advanceIfExpired(attempt) {
  if (attempt.status !== 'in_progress' || !attempt.section_deadline_at) return attempt;
  if (Date.now() <= new Date(attempt.section_deadline_at).getTime() + GRACE_MS) return attempt;

  // Hết giờ: có section kế tiếp?
  const { data: nextSection } = await supabaseAdmin
    .from('mock_exam_sections').select('position, time_limit_minutes')
    .eq('exam_id', attempt.exam_id).eq('position', attempt.current_section_position + 1).single();

  if (nextSection) {
    const deadline = new Date(Date.now() + nextSection.time_limit_minutes * 60 * 1000).toISOString();
    const { data: updated } = await supabaseAdmin.from('mock_attempts')
      .update({ current_section_position: nextSection.position, section_deadline_at: deadline })
      .eq('id', attempt.id).select().single();
    return advanceIfExpired(updated); // section kế cũng có thể đã quá hạn (attempt bỏ lâu)
  }
  // Không còn section → chấm toàn bài
  return finalizeAttempt(attempt);
}

// remaining_seconds tính từ server (tránh lệch đồng hồ client)
function remainingSeconds(attempt) {
  if (!attempt.section_deadline_at) return 0;
  return Math.max(0, Math.round((new Date(attempt.section_deadline_at).getTime() - Date.now()) / 1000));
}

// ─── Danh sách & meta đề ──────────────────────────────────────────────────────

// GET /api/mock-exams
exports.listExams = async (req, res) => {
  const { level, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.from('mock_exams')
      .select('id, level, title, description, published_at, is_free', { count: 'exact' })
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level) query = query.eq('level', level);
    const { data: exams, error, count } = await query;
    if (error) throw error;

    // Đề premium bị khóa với tài khoản free (chỉ chặn làm bài mới — xem lại vẫn được)
    const tier = await getUserTier(req.user.id);

    const examIds = (exams || []).map(e => e.id);
    const meta = {};
    examIds.forEach(id => { meta[id] = { total_minutes: 0, question_count: 0, attempt_count: 0, best_score: null, active_attempt_id: null }; });

    if (examIds.length) {
      // thời gian + số câu
      const { data: sections } = await supabaseAdmin
        .from('mock_exam_sections').select('id, exam_id, time_limit_minutes').in('exam_id', examIds);
      const sectionToExam = {};
      (sections || []).forEach(s => { sectionToExam[s.id] = s.exam_id; meta[s.exam_id].total_minutes += s.time_limit_minutes; });
      const sectionIds = Object.keys(sectionToExam);
      if (sectionIds.length) {
        const { data: groups } = await supabaseAdmin.from('mock_question_groups').select('id, section_id').in('section_id', sectionIds);
        const groupToExam = {};
        (groups || []).forEach(g => { groupToExam[g.id] = sectionToExam[g.section_id]; });
        const groupIds = Object.keys(groupToExam);
        if (groupIds.length) {
          const { data: qs } = await supabaseAdmin.from('mock_questions').select('group_id').in('group_id', groupIds);
          (qs || []).forEach(q => { meta[groupToExam[q.group_id]].question_count += 1; });
        }
      }
      // lượt làm + best score + attempt đang dở của user
      const { data: myAttempts } = await supabaseAdmin.from('mock_attempts')
        .select('id, exam_id, status, total_score').eq('user_id', req.user.id).in('exam_id', examIds);
      (myAttempts || []).forEach(a => {
        if (a.status === 'submitted' && a.total_score != null)
          meta[a.exam_id].best_score = Math.max(meta[a.exam_id].best_score ?? 0, a.total_score);
        if (a.status === 'in_progress') meta[a.exam_id].active_attempt_id = a.id;
      });
      // tổng lượt làm (mọi user) — đếm số attempt submitted
      const { data: allAttempts } = await supabaseAdmin.from('mock_attempts')
        .select('exam_id').eq('status', 'submitted').in('exam_id', examIds);
      (allAttempts || []).forEach(a => { meta[a.exam_id].attempt_count += 1; });
    }

    res.json({
      data: (exams || []).map(e => ({ ...e, ...meta[e.id], locked: !e.is_free && tier !== 'premium' })),
      total: count, page: Number(page), limit: Number(limit),
    });
  } catch (err) { handleError(res, err, 'Không thể tải danh sách đề thi.'); }
};

// GET /api/mock-exams/:id — meta + cấu trúc phần thi (không câu hỏi)
exports.getExamMeta = async (req, res) => {
  try {
    const { data: exam } = await supabaseAdmin
      .from('mock_exams').select('id, level, title, description, is_published, is_free').eq('id', req.params.id).single();
    if (!exam || !exam.is_published) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

    const tier = await getUserTier(req.user.id);
    const locked = !exam.is_free && tier !== 'premium';

    // User từng nộp bài đề này chưa (để FE hiện "chỉ xem lại được" khi bị khóa)
    const { count: submittedCount } = await supabaseAdmin.from('mock_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('exam_id', exam.id).eq('status', 'submitted');

    const { data: sections } = await supabaseAdmin
      .from('mock_exam_sections').select('id, position, section_type, title, time_limit_minutes')
      .eq('exam_id', exam.id).order('position');

    const sectionIds = (sections || []).map(s => s.id);
    const groupsBySection = {};
    let questionCountBySection = {};
    if (sectionIds.length) {
      const { data: groups } = await supabaseAdmin
        .from('mock_question_groups').select('id, section_id, mondai_number, mondai_type').in('section_id', sectionIds).order('position');
      (groups || []).forEach(g => {
        (groupsBySection[g.section_id] ||= []).push({ mondai_number: g.mondai_number, mondai_type: g.mondai_type });
      });
      const groupIds = (groups || []).map(g => g.id);
      const groupToSection = {};
      (groups || []).forEach(g => { groupToSection[g.id] = g.section_id; });
      if (groupIds.length) {
        const { data: qs } = await supabaseAdmin.from('mock_questions').select('group_id').in('group_id', groupIds);
        (qs || []).forEach(q => {
          const sid = groupToSection[q.group_id];
          questionCountBySection[sid] = (questionCountBySection[sid] || 0) + 1;
        });
      }
    }

    // attempt đang dở
    const { data: active } = await supabaseAdmin.from('mock_attempts')
      .select('id').eq('user_id', req.user.id).eq('exam_id', exam.id).eq('status', 'in_progress').maybeSingle();

    res.json({
      ...exam,
      locked,
      submitted_attempts: submittedCount || 0,
      pass_total: PASS_TOTAL[exam.level],
      score_columns: SCORE_COLUMNS[exam.level],
      active_attempt_id: active?.id || null,
      sections: (sections || []).map(s => ({
        ...s,
        question_count: questionCountBySection[s.id] || 0,
        mondai: groupsBySection[s.id] || [],
      })),
    });
  } catch (err) { handleError(res, err, 'Không thể tải đề thi.'); }
};

// ─── Làm bài ──────────────────────────────────────────────────────────────────

async function getOwnedAttempt(attemptId, userId) {
  const { data: attempt } = await supabaseAdmin.from('mock_attempts').select('*').eq('id', attemptId).single();
  if (!attempt) { const e = new Error('Không tìm thấy bài làm.'); e.httpStatus = 404; throw e; }
  if (attempt.user_id !== userId) { const e = new Error('Bạn không có quyền truy cập bài làm này.'); e.httpStatus = 403; throw e; }
  return attempt;
}

// POST /api/mock-exams/:id/attempts — bắt đầu (hoặc trả lại attempt đang dở)
exports.startAttempt = async (req, res) => {
  try {
    const { data: exam } = await supabaseAdmin
      .from('mock_exams').select('id, is_published, is_free').eq('id', req.params.id).single();
    if (!exam || !exam.is_published) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

    // Đang có attempt dở → trả lại (resume tự nhiên — được phép kể cả khi hết premium)
    const { data: existing } = await supabaseAdmin.from('mock_attempts')
      .select('*').eq('user_id', req.user.id).eq('exam_id', exam.id).eq('status', 'in_progress').maybeSingle();
    let attempt = existing;

    if (!attempt) {
      // Đề premium: tài khoản free không được BẮT ĐẦU attempt mới
      if (!exam.is_free) {
        const tier = await getUserTier(req.user.id);
        if (tier !== 'premium') {
          return res.status(403).json({
            error: 'Đề này dành cho tài khoản Premium. Nâng cấp để làm bài, hoặc xem lại kết quả các lần thi trước.',
            code: 'premium_required',
          });
        }
      }

      const { data: firstSection } = await supabaseAdmin
        .from('mock_exam_sections').select('position, time_limit_minutes')
        .eq('exam_id', exam.id).order('position').limit(1).maybeSingle();
      if (!firstSection) return res.status(400).json({ error: 'Đề thi chưa có phần thi nào.' });

      const { count } = await supabaseAdmin.from('mock_attempts')
        .select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('exam_id', exam.id);
      const deadline = new Date(Date.now() + firstSection.time_limit_minutes * 60 * 1000).toISOString();
      const { data: created, error } = await supabaseAdmin.from('mock_attempts')
        .insert({
          exam_id: exam.id, user_id: req.user.id, attempt_number: (count || 0) + 1,
          current_section_position: firstSection.position, section_deadline_at: deadline,
        })
        .select().single();
      // Race double-click: partial unique index → lấy lại attempt dở
      if (error) {
        const { data: retry } = await supabaseAdmin.from('mock_attempts')
          .select('*').eq('user_id', req.user.id).eq('exam_id', exam.id).eq('status', 'in_progress').maybeSingle();
        if (!retry) throw error;
        attempt = retry;
      } else {
        attempt = created;
      }
    }

    attempt = await advanceIfExpired(attempt);
    if (attempt.status === 'submitted') return res.json({ attempt, finished: true });

    const section = await loadSectionForAttempt(attempt.exam_id, attempt.current_section_position);
    res.json({ attempt, section, remaining_seconds: remainingSeconds(attempt) });
  } catch (err) { handleError(res, err, 'Không thể bắt đầu bài làm.'); }
};

// GET /api/mock-exams/attempts/:attemptId/current — khôi phục section + đáp án đã lưu
exports.getCurrent = async (req, res) => {
  try {
    let attempt = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (attempt.status !== 'in_progress') return res.json({ attempt, finished: true });

    attempt = await advanceIfExpired(attempt);
    if (attempt.status === 'submitted') return res.json({ attempt, finished: true });

    const section = await loadSectionForAttempt(attempt.exam_id, attempt.current_section_position);
    // đáp án đã lưu của section hiện tại
    const groupIds = (section?.groups || []).map(g => g.id);
    const questionIds = (section?.groups || []).flatMap(g => g.questions.map(q => q.id));
    let savedAnswers = {};
    if (questionIds.length) {
      const { data: ans } = await supabaseAdmin.from('mock_attempt_answers')
        .select('question_id, selected_index').eq('attempt_id', attempt.id).in('question_id', questionIds);
      (ans || []).forEach(a => { savedAnswers[a.question_id] = a.selected_index; });
    }
    res.json({ attempt, section, saved_answers: savedAnswers, remaining_seconds: remainingSeconds(attempt) });
  } catch (err) { handleError(res, err, 'Không thể tải bài làm.'); }
};

// PUT /api/mock-exams/attempts/:attemptId/answers — lưu đáp án (batch)
exports.saveAnswers = async (req, res) => {
  const { answers } = req.body;
  if (!Array.isArray(answers) || !answers.length) return res.json({ saved: 0 });
  try {
    const attempt = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (attempt.status !== 'in_progress')
      return res.status(400).json({ error: 'Bài làm đã kết thúc.' });
    if (Date.now() > new Date(attempt.section_deadline_at).getTime() + GRACE_MS)
      return res.status(403).json({ error: 'Đã hết thời gian phần thi này.' });

    // Chỉ nhận câu thuộc section hiện tại
    const { data: section } = await supabaseAdmin
      .from('mock_exam_sections').select('id').eq('exam_id', attempt.exam_id).eq('position', attempt.current_section_position).single();
    const { data: groups } = await supabaseAdmin.from('mock_question_groups').select('id').eq('section_id', section.id);
    const groupIds = (groups || []).map(g => g.id);
    const { data: validQs } = await supabaseAdmin.from('mock_questions').select('id').in('group_id', groupIds);
    const validSet = new Set((validQs || []).map(q => q.id));

    const rows = answers
      .filter(a => validSet.has(a.question_id) && a.selected_index != null)
      .map(a => ({ attempt_id: attempt.id, question_id: a.question_id, selected_index: Number(a.selected_index) }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from('mock_attempt_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
      if (error) throw error;
    }
    res.json({ saved: rows.length });
  } catch (err) { handleError(res, err, 'Không thể lưu đáp án.'); }
};

// POST /api/mock-exams/attempts/:attemptId/sections/:position/submit — nộp phần / nộp bài
exports.submitSection = async (req, res) => {
  const position = Number(req.params.position);
  try {
    let attempt = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (attempt.status !== 'in_progress')
      return res.status(400).json({ error: 'Bài làm đã kết thúc.' });
    if (position !== attempt.current_section_position)
      return res.status(400).json({ error: 'Phần thi không khớp với tiến trình hiện tại.' });

    const expired = Date.now() > new Date(attempt.section_deadline_at).getTime() + GRACE_MS;

    // Lưu nốt đáp án gửi kèm (nếu chưa quá hạn)
    const answers = req.body.answers;
    if (!expired && Array.isArray(answers) && answers.length) {
      const { data: section } = await supabaseAdmin
        .from('mock_exam_sections').select('id').eq('exam_id', attempt.exam_id).eq('position', position).single();
      const { data: groups } = await supabaseAdmin.from('mock_question_groups').select('id').eq('section_id', section.id);
      const groupIds = (groups || []).map(g => g.id);
      const { data: validQs } = await supabaseAdmin.from('mock_questions').select('id').in('group_id', groupIds);
      const validSet = new Set((validQs || []).map(q => q.id));
      const rows = answers
        .filter(a => validSet.has(a.question_id) && a.selected_index != null)
        .map(a => ({ attempt_id: attempt.id, question_id: a.question_id, selected_index: Number(a.selected_index) }));
      if (rows.length) await supabaseAdmin.from('mock_attempt_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
    }

    // Có section kế tiếp?
    const { data: nextSection } = await supabaseAdmin
      .from('mock_exam_sections').select('position, time_limit_minutes')
      .eq('exam_id', attempt.exam_id).eq('position', position + 1).maybeSingle();

    if (nextSection) {
      const deadline = new Date(Date.now() + nextSection.time_limit_minutes * 60 * 1000).toISOString();
      const { data: updated } = await supabaseAdmin.from('mock_attempts')
        .update({ current_section_position: nextSection.position, section_deadline_at: deadline })
        .eq('id', attempt.id).select().single();
      const section = await loadSectionForAttempt(updated.exam_id, updated.current_section_position);
      return res.json({ attempt: updated, section, remaining_seconds: remainingSeconds(updated), finished: false });
    }

    // Section cuối → chấm toàn bài
    const finalized = await finalizeAttempt(attempt);
    res.json({ attempt: finalized, finished: true });
  } catch (err) { handleError(res, err, 'Không thể nộp bài.'); }
};

// GET /api/mock-exams/attempts/:attemptId/result
exports.getResult = async (req, res) => {
  try {
    const attempt = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (attempt.status !== 'submitted') return res.status(400).json({ error: 'Bài làm chưa được nộp.' });
    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, level, title').eq('id', attempt.exam_id).single();
    res.json({
      attempt_id: attempt.id, exam_id: exam.id, exam_title: exam.title, level: exam.level,
      scores: attempt.scores, total_score: attempt.total_score, passed: attempt.passed,
      duration_seconds: attempt.duration_seconds, submitted_at: attempt.submitted_at,
      pass_total: PASS_TOTAL[exam.level], score_columns: SCORE_COLUMNS[exam.level],
    });
  } catch (err) { handleError(res, err, 'Không thể tải kết quả.'); }
};

// GET /api/mock-exams/attempts/:attemptId/review — full câu hỏi kèm đáp án + giải thích
exports.getReview = async (req, res) => {
  try {
    const attempt = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (attempt.status !== 'submitted') return res.status(400).json({ error: 'Bài làm chưa được nộp.' });

    const { data: exam } = await supabaseAdmin.from('mock_exams').select('id, level, title').eq('id', attempt.exam_id).single();
    const { data: sections } = await supabaseAdmin
      .from('mock_exam_sections').select('*').eq('exam_id', exam.id).order('position');
    const sectionIds = (sections || []).map(s => s.id);
    let groups = [], questions = [];
    if (sectionIds.length) {
      ({ data: groups } = await supabaseAdmin.from('mock_question_groups').select('*').in('section_id', sectionIds).order('position'));
      groups = groups || [];
      const groupIds = groups.map(g => g.id);
      if (groupIds.length) {
        ({ data: questions } = await supabaseAdmin.from('mock_questions').select('*').in('group_id', groupIds).order('position'));
        questions = questions || [];
      }
    }
    const { data: ans } = await supabaseAdmin
      .from('mock_attempt_answers').select('question_id, selected_index, is_correct').eq('attempt_id', attempt.id);
    const answerMap = {};
    (ans || []).forEach(a => { answerMap[a.question_id] = a; });

    const tree = {
      attempt_id: attempt.id, level: exam.level, exam_title: exam.title,
      scores: attempt.scores, total_score: attempt.total_score, passed: attempt.passed,
      sections: (sections || []).map(s => ({
        ...s,
        groups: groups.filter(g => g.section_id === s.id).map(g => ({
          ...g,
          questions: questions.filter(q => q.group_id === g.id).map(q => ({
            ...q,
            selected_index: answerMap[q.id]?.selected_index ?? null,
            is_correct: answerMap[q.id]?.is_correct ?? false,
          })),
        })),
      })),
    };
    res.json(tree);
  } catch (err) { handleError(res, err, 'Không thể tải phần xem lại.'); }
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

// GET /api/mock-exams/:id/leaderboard — chỉ lần làm đầu, điểm↓ thời gian↑
exports.getLeaderboard = async (req, res) => {
  try {
    const { data: rows, error } = await supabaseAdmin.from('mock_attempts')
      .select('id, user_id, total_score, duration_seconds, submitted_at, scores')
      .eq('exam_id', req.params.id).eq('status', 'submitted').eq('attempt_number', 1)
      .order('total_score', { ascending: false })
      .order('duration_seconds', { ascending: true })
      .limit(50);
    if (error) throw error;

    const userIds = [...new Set((rows || []).map(r => r.user_id))];
    let userMap = {};
    if (userIds.length) {
      const { data: users } = await supabaseAdmin.from('users').select('id, full_name, avatar_url').in('id', userIds);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    const board = (rows || []).map((r, i) => ({
      rank: i + 1,
      user_id: r.user_id,
      name: userMap[r.user_id]?.full_name || 'Học viên',
      avatar_url: userMap[r.user_id]?.avatar_url || null,
      total_score: r.total_score,
      duration_seconds: r.duration_seconds,
      passed: r.total_score != null,
      is_me: r.user_id === req.user.id,
      submitted_at: r.submitted_at,
    }));

    // Hạng của user nếu ngoài top 50
    let myRank = board.find(b => b.is_me) || null;
    if (!myRank) {
      const { data: mine } = await supabaseAdmin.from('mock_attempts')
        .select('total_score, duration_seconds').eq('exam_id', req.params.id)
        .eq('user_id', req.user.id).eq('status', 'submitted').eq('attempt_number', 1).maybeSingle();
      if (mine) {
        // đếm số người xếp trên
        const { count: better } = await supabaseAdmin.from('mock_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('exam_id', req.params.id).eq('status', 'submitted').eq('attempt_number', 1)
          .or(`total_score.gt.${mine.total_score},and(total_score.eq.${mine.total_score},duration_seconds.lt.${mine.duration_seconds})`);
        myRank = { rank: (better || 0) + 1, is_me: true, total_score: mine.total_score, duration_seconds: mine.duration_seconds, out_of_top: true };
      }
    }

    res.json({ board, my_rank: myRank });
  } catch (err) { handleError(res, err, 'Không thể tải bảng xếp hạng.'); }
};

// ─── Lịch sử & thống kê ───────────────────────────────────────────────────────

// GET /api/mock-exams/me/history
exports.getHistory = async (req, res) => {
  try {
    const { data: attempts, error } = await supabaseAdmin.from('mock_attempts')
      .select('id, exam_id, attempt_number, status, scores, total_score, passed, duration_seconds, started_at, submitted_at')
      .eq('user_id', req.user.id).eq('status', 'submitted')
      .order('submitted_at', { ascending: false });
    if (error) throw error;

    const examIds = [...new Set((attempts || []).map(a => a.exam_id))];
    let examMap = {};
    if (examIds.length) {
      const { data: exams } = await supabaseAdmin.from('mock_exams').select('id, level, title').in('id', examIds);
      (exams || []).forEach(e => { examMap[e.id] = e; });
    }
    res.json((attempts || []).map(a => ({
      ...a, level: examMap[a.exam_id]?.level || null, exam_title: examMap[a.exam_id]?.title || '(đã xóa)',
    })));
  } catch (err) { handleError(res, err, 'Không thể tải lịch sử.'); }
};
