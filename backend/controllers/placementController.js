'use strict';

const { supabaseAdmin } = require('../config/supabase');

const DURATION_MINUTES = 30;
const TOTAL_QUESTIONS  = 30;
const PER_CATEGORY     = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function selectRandomQuestions() {
  const { data: all, error } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, category')
    .eq('is_active', true);

  if (error) throw new Error('DB_ERROR');
  if (!all || all.length < 10) throw new Error('INSUFFICIENT_QUESTIONS');

  const pool = {
    vocabulary: shuffle(all.filter(q => q.category === 'vocabulary')),
    kanji:      shuffle(all.filter(q => q.category === 'kanji')),
    grammar:    shuffle(all.filter(q => q.category === 'grammar')),
  };

  const selected = [
    ...pool.vocabulary.slice(0, PER_CATEGORY),
    ...pool.kanji.slice(0, PER_CATEGORY),
    ...pool.grammar.slice(0, PER_CATEGORY),
  ];

  // Fill remaining if any category was short
  if (selected.length < TOTAL_QUESTIONS) {
    const have = new Set(selected.map(q => q.id));
    const extras = shuffle(all.filter(q => !have.has(q.id)));
    selected.push(...extras.slice(0, TOTAL_QUESTIONS - selected.length));
  }

  return shuffle(selected.slice(0, TOTAL_QUESTIONS)).map(q => q.id);
}

function buildAnalysis(correctCount, vocab, kanji, grammar) {
  const pct = (c, t) => (t > 0 ? Math.round((c / t) * 100) : 0);
  const score = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
  const vp = pct(vocab.c, vocab.t);
  const kp = pct(kanji.c, kanji.t);
  const gp = pct(grammar.c, grammar.t);

  const strengths  = [];
  const weaknesses = [];
  const cats = [['Từ vựng', vp], ['Kanji', kp], ['Ngữ pháp', gp]];
  for (const [name, p] of cats) {
    if (p >= 75) strengths.push(name);
    else if (p < 55) weaknesses.push(name);
  }

  let recommendedLevel;
  if (score >= 80)      recommendedLevel = 'Sẵn sàng học N4';
  else if (score >= 60) recommendedLevel = 'Vững N5 — cần ôn sâu hơn';
  else if (score >= 40) recommendedLevel = 'Đang học N5 — nền tảng cơ bản';
  else                  recommendedLevel = 'Mới bắt đầu — cần xây dựng nền tảng';

  const strengthsText  = strengths.length
    ? `Thế mạnh: ${strengths.join(', ')}`
    : 'Cần cải thiện đồng đều ở các kỹ năng';
  const weaknessText = weaknesses.length
    ? `Cần cải thiện: ${weaknesses.join(', ')}`
    : 'Bạn có nền tảng khá đồng đều';

  const recommendations = [];
  if (score < 40) {
    recommendations.push({ area: 'foundation',  title: 'Nhập môn tiếng Nhật',   reason: 'Điểm tổng thấp — cần xây dựng nền tảng từ đầu.' });
    recommendations.push({ area: 'vocabulary',  title: 'Từ vựng N5 cơ bản',     reason: 'Từ vựng là bước khởi đầu quan trọng nhất.' });
  } else if (score >= 80) {
    recommendations.push({ area: 'n4',          title: 'N4 nhập môn',            reason: 'Bạn đã vững N5, đã đến lúc thử thách với N4.' });
    recommendations.push({ area: 'n5_review',   title: 'Ôn tập N5 toàn diện',   reason: 'Củng cố trước khi bước lên cấp độ mới.' });
  } else {
    recommendations.push({ area: 'n5_solid',    title: 'N5 toàn diện',           reason: 'Bạn đã có nền tảng, hãy luyện sâu hơn để vững N5.' });
  }
  if (kp < 50)  recommendations.push({ area: 'kanji',    title: 'Kanji N5 nền tảng',      reason: `Điểm Kanji chỉ ${kp}% — cần luyện thêm.` });
  if (gp < 50)  recommendations.push({ area: 'grammar',  title: 'Ngữ pháp N5 cơ bản',    reason: `Điểm Ngữ pháp chỉ ${gp}% — cần ôn trợ từ và cấu trúc.` });
  if (vp < 50)  recommendations.push({ area: 'vocab',    title: 'Từ vựng giao tiếp N5',  reason: `Điểm Từ vựng chỉ ${vp}% — cần mở rộng vốn từ.` });

  return {
    score, vp, kp, gp,
    strengthsText, weaknessText, recommendedLevel,
    recommendations: recommendations.slice(0, 3),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchQuestionsOrdered(questionIds) {
  const { data: questions } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, question_text, category, difficulty, level, placement_test_question_options(id, option_text, sort_order)')
    .in('id', questionIds);

  const qMap = {};
  (questions || []).forEach(q => { qMap[q.id] = q; });
  const ordered = questionIds.map(id => qMap[id]).filter(Boolean);
  ordered.forEach(q => {
    q.options = (q.placement_test_question_options || []).sort((a, b) => a.sort_order - b.sort_order);
    delete q.placement_test_question_options;
  });
  return ordered;
}

async function scoreAndFinish(attemptId) {
  const { data: attempt } = await supabaseAdmin
    .from('placement_test_attempts').select('*').eq('id', attemptId).single();
  if (!attempt || attempt.status !== 'in_progress') return null;

  const { data: answers } = await supabaseAdmin
    .from('placement_test_answers').select('question_id, selected_option_id').eq('attempt_id', attemptId);

  const { data: questions } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, category, placement_test_question_options(id, is_correct)')
    .in('id', attempt.question_ids);

  const qMap = {};
  (questions || []).forEach(q => {
    const correct = q.placement_test_question_options?.find(o => o.is_correct);
    qMap[q.id] = { category: q.category, correctId: correct?.id };
  });

  const counts = {
    vocabulary: { c: 0, t: 0 },
    kanji:      { c: 0, t: 0 },
    grammar:    { c: 0, t: 0 },
  };
  let totalCorrect = 0;

  for (const ans of (answers || [])) {
    const q = qMap[ans.question_id];
    if (!q) continue;
    const isCorrect = !!ans.selected_option_id && ans.selected_option_id === q.correctId;
    if (isCorrect) totalCorrect++;
    if (counts[q.category]) {
      counts[q.category].t++;
      if (isCorrect) counts[q.category].c++;
    }
    await supabaseAdmin.from('placement_test_answers')
      .update({ is_correct: isCorrect })
      .eq('attempt_id', attemptId).eq('question_id', ans.question_id);
  }

  const analysis = buildAnalysis(
    totalCorrect,
    counts.vocabulary,
    counts.kanji,
    counts.grammar,
  );

  await supabaseAdmin.from('placement_test_attempts').update({
    status:           'submitted',
    submitted_at:     new Date().toISOString(),
    correct_count:    totalCorrect,
    score:            analysis.score,
    vocab_correct:    counts.vocabulary.c,
    vocab_total:      counts.vocabulary.t,
    kanji_correct:    counts.kanji.c,
    kanji_total:      counts.kanji.t,
    grammar_correct:  counts.grammar.c,
    grammar_total:    counts.grammar.t,
    strengths:        analysis.strengthsText,
    weaknesses:       analysis.weaknessText,
    recommended_level: analysis.recommendedLevel,
  }).eq('id', attemptId);

  return analysis;
}

// ── Student endpoints ─────────────────────────────────────────────────────────

exports.checkStatus = async (req, res) => {
  const userId = req.user.id;

  const [{ data: completed }, { data: pending }] = await Promise.all([
    supabaseAdmin.from('placement_test_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['submitted', 'auto_submitted']),
    supabaseAdmin.from('placement_test_attempts')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
  ]);

  res.json({
    hasCompleted:       (completed?.length ?? 0) > 0,
    hasPendingAttempt:  !!pending,
    showPopup:          !((completed?.length ?? 0) > 0),
  });
};

exports.getConfig = (_req, res) => {
  res.json({
    totalQuestions:  TOTAL_QUESTIONS,
    durationMinutes: DURATION_MINUTES,
    perCategory:     PER_CATEGORY,
  });
};

exports.startAttempt = async (req, res) => {
  const userId = req.user.id;

  // Resume in-progress
  const { data: existing } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    const questions   = await fetchQuestionsOrdered(existing.question_ids);
    const { data: savedRaw } = await supabaseAdmin
      .from('placement_test_answers')
      .select('question_id, selected_option_id').eq('attempt_id', existing.id);
    const savedAnswers = {};
    (savedRaw || []).forEach(a => { savedAnswers[a.question_id] = a.selected_option_id; });
    return res.json({ attempt: existing, questions, savedAnswers, isResuming: true });
  }

  // Retake cooldown check
  const { data: lastDone } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('submitted_at')
    .eq('user_id', userId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastDone?.submitted_at) {
    const hoursAgo = (Date.now() - new Date(lastDone.submitted_at).getTime()) / 3_600_000;
    if (hoursAgo < 24) {
      return res.status(429).json({ error: `Bạn cần đợi thêm ${Math.ceil(24 - hoursAgo)} giờ để làm lại bài test.` });
    }
  }

  let questionIds;
  try {
    questionIds = await selectRandomQuestions();
  } catch (e) {
    if (e.message === 'INSUFFICIENT_QUESTIONS') {
      return res.status(422).json({ error: 'Ngân hàng câu hỏi chưa đủ. Vui lòng liên hệ quản trị viên.' });
    }
    throw e;
  }

  const expiresAt = new Date(Date.now() + DURATION_MINUTES * 60_000).toISOString();

  const { data: attempt, error } = await supabaseAdmin
    .from('placement_test_attempts')
    .insert({ user_id: userId, question_ids: questionIds, expires_at: expiresAt, total_questions: TOTAL_QUESTIONS })
    .select().single();

  if (error) return res.status(500).json({ error: 'Không thể tạo bài thi.' });

  const questions = await fetchQuestionsOrdered(questionIds);
  res.json({ attempt, questions, savedAnswers: {}, isResuming: false });
};

exports.saveAnswer = async (req, res) => {
  const { attemptId } = req.params;
  const { questionId, optionId } = req.body;
  const userId = req.user.id;

  if (!questionId) return res.status(400).json({ error: 'Thiếu questionId.' });

  const { data: attempt } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('id, status, expires_at, question_ids, answered_count')
    .eq('id', attemptId).eq('user_id', userId).maybeSingle();

  if (!attempt)                                    return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  if (attempt.status !== 'in_progress')            return res.status(409).json({ error: 'Bài thi đã kết thúc.' });
  if (new Date(attempt.expires_at) <= new Date())  return res.status(410).json({ error: 'Bài thi đã hết giờ.' });
  if (!attempt.question_ids.includes(questionId)) return res.status(400).json({ error: 'Câu hỏi không thuộc bài thi.' });

  const { error: upsertErr } = await supabaseAdmin
    .from('placement_test_answers')
    .upsert(
      { attempt_id: attemptId, question_id: questionId, selected_option_id: optionId || null, answered_at: new Date().toISOString() },
      { onConflict: 'attempt_id,question_id' },
    );

  if (upsertErr) return res.status(500).json({ error: 'Không thể lưu đáp án.' });

  const { count } = await supabaseAdmin
    .from('placement_test_answers')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attemptId)
    .not('selected_option_id', 'is', null);

  await supabaseAdmin.from('placement_test_attempts')
    .update({ answered_count: count || 0 }).eq('id', attemptId);

  res.json({ ok: true, answeredCount: count || 0 });
};

exports.submitAttempt = async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user.id;

  const { data: attempt } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('id, status').eq('id', attemptId).eq('user_id', userId).maybeSingle();

  if (!attempt)                           return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  if (attempt.status !== 'in_progress')   return res.status(409).json({ error: 'Bài thi đã được nộp.' });

  await scoreAndFinish(attemptId);

  const { data: result } = await supabaseAdmin
    .from('placement_test_attempts').select('*').eq('id', attemptId).single();

  const analysis = buildAnalysis(
    result.correct_count,
    { c: result.vocab_correct,   t: result.vocab_total },
    { c: result.kanji_correct,   t: result.kanji_total },
    { c: result.grammar_correct, t: result.grammar_total },
  );

  // Fetch questions with correct answers for review
  const questions = await fetchQuestionsOrdered(result.question_ids);
  const { data: questionsWithCorrect } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, question_text, category, explanation, placement_test_question_options(id, option_text, is_correct, sort_order)')
    .in('id', result.question_ids);

  const { data: answers } = await supabaseAdmin
    .from('placement_test_answers').select('*').eq('attempt_id', attemptId);

  res.json({ attempt: result, questionsWithCorrect: questionsWithCorrect || [], answers: answers || [], analysis });
};

exports.getResult = async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user.id;

  const { data: attempt } = await supabaseAdmin
    .from('placement_test_attempts').select('*')
    .eq('id', attemptId).eq('user_id', userId).maybeSingle();

  if (!attempt)                     return res.status(404).json({ error: 'Không tìm thấy kết quả.' });
  if (attempt.status === 'in_progress') return res.status(400).json({ error: 'Bài thi chưa hoàn thành.' });

  const analysis = buildAnalysis(
    attempt.correct_count,
    { c: attempt.vocab_correct,   t: attempt.vocab_total },
    { c: attempt.kanji_correct,   t: attempt.kanji_total },
    { c: attempt.grammar_correct, t: attempt.grammar_total },
  );

  const { data: questionsWithCorrect } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, question_text, category, explanation, placement_test_question_options(id, option_text, is_correct, sort_order)')
    .in('id', attempt.question_ids);

  const { data: answers } = await supabaseAdmin
    .from('placement_test_answers').select('*').eq('attempt_id', attemptId);

  res.json({ attempt, questionsWithCorrect: questionsWithCorrect || [], answers: answers || [], analysis });
};

exports.getHistory = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('id, status, score, correct_count, total_questions, submitted_at, recommended_level, vocab_correct, vocab_total, kanji_correct, kanji_total, grammar_correct, grammar_total')
    .eq('user_id', req.user.id)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'Không tải được lịch sử.' });
  res.json(data || []);
};

// ── Admin endpoints ───────────────────────────────────────────────────────────

exports.adminGetStats = async (req, res) => {
  const [
    { count: total },
    { count: active },
    { count: vocab },
    { count: kanji },
    { count: grammar },
    { count: attempts },
  ] = await Promise.all([
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }).eq('category', 'vocabulary').eq('is_active', true),
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }).eq('category', 'kanji').eq('is_active', true),
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }).eq('category', 'grammar').eq('is_active', true),
    supabaseAdmin.from('placement_test_attempts').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'auto_submitted']),
  ]);
  res.json({ total: total || 0, active: active || 0, vocabulary: vocab || 0, kanji: kanji || 0, grammar: grammar || 0, attempts: attempts || 0 });
};

exports.adminListQuestions = async (req, res) => {
  const { category, level, difficulty, search, page = 1 } = req.query;
  const limit  = 20;
  const offset = (Number(page) - 1) * limit;

  let q = supabaseAdmin
    .from('placement_test_questions')
    .select('id, question_text, category, level, difficulty, is_active, tags, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category)  q = q.eq('category', category);
  if (level)     q = q.eq('level', level);
  if (difficulty) q = q.eq('difficulty', difficulty);
  if (search)    q = q.ilike('question_text', `%${search}%`);

  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: 'Không tải được.' });
  res.json({ questions: data || [], total: count || 0 });
};

exports.adminGetQuestion = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('placement_test_questions')
    .select('*, placement_test_question_options(id, option_text, is_correct, sort_order)')
    .eq('id', req.params.id).maybeSingle();
  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
  res.json(data);
};

exports.adminCreateQuestion = async (req, res) => {
  const { question_text, category, level, difficulty, explanation, tags, is_active, options } = req.body;
  if (!question_text || !category)             return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  if (!options?.length)                        return res.status(400).json({ error: 'Cần ít nhất 2 đáp án.' });
  if (!options.some(o => o.is_correct))        return res.status(400).json({ error: 'Cần đánh dấu ít nhất một đáp án đúng.' });

  const { data: q, error: qErr } = await supabaseAdmin
    .from('placement_test_questions')
    .insert({ question_text, category, level: level || 'N5', difficulty: difficulty || 'easy', explanation: explanation || null, tags: tags || [], is_active: is_active !== false })
    .select().single();
  if (qErr) return res.status(500).json({ error: 'Không thể tạo câu hỏi: ' + qErr.message });

  const optRows = options.map((o, i) => ({ question_id: q.id, option_text: o.option_text, is_correct: !!o.is_correct, sort_order: i + 1 }));
  await supabaseAdmin.from('placement_test_question_options').insert(optRows);

  res.status(201).json(q);
};

exports.adminUpdateQuestion = async (req, res) => {
  const { question_text, category, level, difficulty, explanation, tags, is_active, options } = req.body;

  const { data, error } = await supabaseAdmin
    .from('placement_test_questions')
    .update({ question_text, category, level, difficulty, explanation, tags, is_active, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật.' });

  if (options?.length) {
    if (!options.some(o => o.is_correct)) return res.status(400).json({ error: 'Cần đánh dấu ít nhất một đáp án đúng.' });
    await supabaseAdmin.from('placement_test_question_options').delete().eq('question_id', req.params.id);
    const optRows = options.map((o, i) => ({ question_id: req.params.id, option_text: o.option_text, is_correct: !!o.is_correct, sort_order: i + 1 }));
    await supabaseAdmin.from('placement_test_question_options').insert(optRows);
  }

  res.json(data);
};

exports.adminToggleQuestion = async (req, res) => {
  const { is_active } = req.body;
  const { data, error } = await supabaseAdmin
    .from('placement_test_questions')
    .update({ is_active: !!is_active }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật.' });
  res.json(data);
};

exports.adminDeleteQuestion = async (req, res) => {
  const { error } = await supabaseAdmin
    .from('placement_test_questions').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Không thể xóa.' });
  res.json({ ok: true });
};
