'use strict';

const { supabaseAdmin }  = require('../config/supabase');
const { incrementUsage } = require('../services/quotaService');

const ALL_LEVELS  = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CATEGORIES  = ['vocabulary', 'kanji', 'grammar'];

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  supported_jlpt_levels: ['N5', 'N4', 'N3', 'N2', 'N1'],
  default_question_count: 30,
  default_duration_minutes: 30,
  per_category_count: 10,
  strict_level_only: false,
  allow_adjacent_level_fallback: true,
  adjacent_level_fallback_order: {
    N5: [], N4: ['N5'], N3: ['N4', 'N5'], N2: ['N3', 'N4'], N1: ['N2', 'N3'],
  },
  min_questions_per_category: 10,
  retake_cooldown_hours: 24,
  popup_enabled_for_new_users: true,
};

let _configCache = null;
let _configCachedAt = 0;

async function getMainConfig() {
  if (_configCache && Date.now() - _configCachedAt < 60_000) return _configCache;
  const { data } = await supabaseAdmin
    .from('placement_test_configs').select('value').eq('key', 'main').maybeSingle();
  _configCache = data?.value ? { ...DEFAULT_CONFIG, ...data.value } : { ...DEFAULT_CONFIG };
  _configCachedAt = Date.now();
  return _configCache;
}

function invalidateConfigCache() { _configCache = null; }

// ── Internal helpers ──────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function computeLevelCounts() {
  const { data } = await supabaseAdmin
    .from('placement_test_questions')
    .select('level, category')
    .eq('is_active', true);
  const map = {};
  (data || []).forEach(({ level, category }) => {
    if (!map[level]) map[level] = {};
    map[level][category] = (map[level][category] || 0) + 1;
  });
  return map;
}

function isLevelUsable(level, counts, config) {
  const minPerCat = config.min_questions_per_category || 10;
  const perCat    = config.per_category_count || 10;
  const lc        = counts[level] || {};
  const strictOk  = CATEGORIES.every(c => (lc[c] || 0) >= minPerCat);
  if (strictOk) return { canStart: true, needsFallback: false };
  if (config.strict_level_only) return { canStart: false, needsFallback: false };
  if (!config.allow_adjacent_level_fallback) return { canStart: false, needsFallback: false };

  const fbLevels = config.adjacent_level_fallback_order?.[level] || [];
  if (!fbLevels.length) return { canStart: false, needsFallback: false };

  const pool = {};
  CATEGORIES.forEach(c => { pool[c] = lc[c] || 0; });
  for (const fb of fbLevels) {
    const fc = counts[fb] || {};
    CATEGORIES.forEach(c => {
      const need = perCat - pool[c];
      if (need > 0) pool[c] += Math.min(need, fc[c] || 0);
    });
  }
  const ok = CATEGORIES.every(c => pool[c] >= perCat);
  return { canStart: ok, needsFallback: ok };
}

async function selectRandomQuestions(level, config) {
  const perCat      = config.per_category_count || 10;
  const totalNeeded = config.default_question_count || 30;
  const levelPool   = [level];
  if (!config.strict_level_only && config.allow_adjacent_level_fallback) {
    (config.adjacent_level_fallback_order?.[level] || []).forEach(l => levelPool.push(l));
  }

  const { data: all, error } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, category, level')
    .eq('is_active', true)
    .in('level', levelPool);
  if (error) throw new Error('DB_ERROR');

  const primary  = all.filter(q => q.level === level);
  const fallback = all.filter(q => q.level !== level);
  const byCat    = {};
  CATEGORIES.forEach(cat => {
    byCat[cat] = {
      p: shuffle(primary.filter(q => q.category === cat)),
      f: shuffle(fallback.filter(q => q.category === cat)),
    };
  });

  let fallbackApplied = false;
  const fallbackFromLevels = new Set();
  const selected = [];

  for (const cat of CATEGORIES) {
    const { p, f } = byCat[cat];
    if (p.length >= perCat) {
      selected.push(...p.slice(0, perCat));
    } else if (config.strict_level_only) {
      throw new Error(`INSUFFICIENT_QUESTIONS:${level}:${cat}`);
    } else {
      selected.push(...p);
      const toAdd = f.slice(0, perCat - p.length);
      selected.push(...toAdd);
      toAdd.forEach(q => { fallbackApplied = true; fallbackFromLevels.add(q.level); });
    }
  }

  if (selected.length < totalNeeded) {
    if (config.strict_level_only) throw new Error('INSUFFICIENT_QUESTIONS');
    const have = new Set(selected.map(q => q.id));
    const extra = shuffle(all.filter(q => !have.has(q.id))).slice(0, totalNeeded - selected.length);
    extra.forEach(q => { fallbackApplied = true; fallbackFromLevels.add(q.level); });
    selected.push(...extra);
  }

  if (selected.length < totalNeeded) throw new Error('INSUFFICIENT_QUESTIONS');

  const finalIds = shuffle(selected.slice(0, totalNeeded)).map(q => q.id);
  return {
    questionIds: finalIds,
    fallbackApplied,
    fallbackFromLevels: [...fallbackFromLevels],
    generationMode: fallbackApplied ? 'fallback' : 'standard',
  };
}

function buildAnalysis(correctCount, vocab, kanji, grammar, level = 'N5') {
  const totalQ = 30;
  const pct    = (c, t) => (t > 0 ? Math.round((c / t) * 100) : 0);
  const score  = Math.round((correctCount / totalQ) * 100);
  const vp = pct(vocab.c, vocab.t);
  const kp = pct(kanji.c, kanji.t);
  const gp = pct(grammar.c, grammar.t);

  const strengths  = [];
  const weaknesses = [];
  for (const [name, p] of [['Từ vựng', vp], ['Kanji', kp], ['Ngữ pháp', gp]]) {
    if (p >= 75) strengths.push(name);
    else if (p < 55) weaknesses.push(name);
  }

  const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const li         = levelOrder.indexOf(level);
  const nextLevel  = li < levelOrder.length - 1 ? levelOrder[li + 1] : null;
  const prevLevel  = li > 0 ? levelOrder[li - 1] : null;

  let recommendedLevel, levelEvaluation;
  if (score >= 80) {
    recommendedLevel = nextLevel ? `Sẵn sàng cho ${nextLevel}` : `Thành thạo ${level}`;
    levelEvaluation  = nextLevel
      ? `Xuất sắc! Bạn đã sẵn sàng thử thách cấp độ ${nextLevel}.`
      : `Bạn thành thạo ${level}. Hãy tiếp tục duy trì và mở rộng kỹ năng.`;
  } else if (score >= 60) {
    recommendedLevel = `Vững ${level} — cần ôn sâu hơn`;
    levelEvaluation  = `Bạn có nền tảng ${level} khá tốt. Tiếp tục ôn luyện để hoàn thiện trước khi lên cấp cao hơn.`;
  } else if (score >= 40) {
    recommendedLevel = `Đang xây dựng ${level}`;
    levelEvaluation  = `Bạn đang trong quá trình xây dựng nền tảng ${level}. Cần luyện tập đều đặn hơn.`;
  } else {
    recommendedLevel = prevLevel ? `Cần ôn lại ${prevLevel} trước` : `Mới bắt đầu — cần xây dựng nền tảng`;
    levelEvaluation  = prevLevel
      ? `Điểm ${level} còn thấp. Hãy ôn chắc ${prevLevel} trước khi học ${level}.`
      : `Điểm còn thấp. Hãy bắt đầu từ kiến thức cơ bản nhất của ${level}.`;
  }

  const recs = [];
  if (score >= 80 && nextLevel) {
    recs.push({ area: 'next_level',     title: `${nextLevel} nhập môn`,    reason: `Điểm ${level} xuất sắc, đã đến lúc thách thức ${nextLevel}.` });
    recs.push({ area: 'current_review', title: `${level} tăng tốc`,        reason: `Củng cố ${level} toàn diện trước khi chính thức bước vào ${nextLevel}.` });
  } else if (score >= 60) {
    recs.push({ area: 'current_level',  title: `${level} toàn diện`,       reason: `Bạn có nền tảng tốt ở ${level}, hãy hoàn thiện hệ thống.` });
    if (nextLevel) recs.push({ area: 'preview', title: `Khám phá ${nextLevel}`, reason: `Sau khi vững ${level}, bạn có thể bắt đầu tìm hiểu ${nextLevel}.` });
  } else {
    recs.push({ area: 'foundation',     title: `${level} nền tảng`,        reason: `Xây dựng vững chắc nền tảng ${level} trước khi tiến lên.` });
    if (prevLevel) recs.push({ area: 'prev_review', title: `Ôn lại ${prevLevel}`, reason: `Nền tảng ${prevLevel} vững giúp học ${level} hiệu quả hơn.` });
  }
  if (vp < 50) recs.push({ area: 'vocab',   title: `Từ vựng ${level}`, reason: `Từ vựng là điểm yếu (${vp}%), cần luyện thêm.` });
  if (kp < 50) recs.push({ area: 'kanji',   title: `Kanji ${level}`,   reason: `Kanji cần cải thiện (${kp}%).` });
  if (gp < 50) recs.push({ area: 'grammar', title: `Ngữ pháp ${level}`, reason: `Ngữ pháp cần ôn luyện thêm (${gp}%).` });

  return {
    score, vp, kp, gp,
    strengthsText:    strengths.length  ? `Thế mạnh: ${strengths.join(', ')}`    : 'Cần cải thiện đồng đều ở các kỹ năng',
    weaknessText:     weaknesses.length ? `Cần cải thiện: ${weaknesses.join(', ')}` : 'Bạn có nền tảng khá đồng đều',
    recommendedLevel, levelEvaluation,
    recommendations:  recs.slice(0, 3),
  };
}

// Map a tested level + score into a clean current_level enum (N5..N1).
// Solid at the tested level (>=60%) keeps it; otherwise drop one level (floor N5).
function deriveCurrentLevel(testedLevel, score) {
  const i = ALL_LEVELS.indexOf(testedLevel);
  if (i < 0) return 'N5';
  if (score >= 60) return testedLevel;
  return i > 0 ? ALL_LEVELS[i - 1] : 'N5';
}

async function fetchQuestionsOrdered(questionIds) {
  const { data } = await supabaseAdmin
    .from('placement_test_questions')
    .select('id, question_text, category, level, difficulty, placement_test_question_options(id, option_text, sort_order)')
    .in('id', questionIds);
  const qMap = {};
  (data || []).forEach(q => { qMap[q.id] = q; });
  const ordered = questionIds.map(id => qMap[id]).filter(Boolean);
  ordered.forEach(q => {
    q.options = (q.placement_test_question_options || []).sort((a, b) => a.sort_order - b.sort_order);
    delete q.placement_test_question_options;
  });
  return ordered;
}

async function createSnapshots(attemptId, questionIds) {
  try {
    const { data } = await supabaseAdmin
      .from('placement_test_questions')
      .select('id, question_text, category, level, difficulty, explanation, placement_test_question_options(id, option_text, is_correct, sort_order)')
      .in('id', questionIds);
    const rows = questionIds.map((qId, idx) => {
      const q = data?.find(x => x.id === qId);
      if (!q) return null;
      const opts = [...(q.placement_test_question_options || [])].sort((a, b) => a.sort_order - b.sort_order)
        .map(o => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct, sort_order: o.sort_order }));
      return { attempt_id: attemptId, question_id: q.id, sort_order: idx, question_text: q.question_text, category: q.category, jlpt_level: q.level, difficulty: q.difficulty, explanation: q.explanation || null, options: opts };
    }).filter(Boolean);
    if (rows.length) await supabaseAdmin.from('placement_test_question_snapshots').insert(rows);
  } catch (e) {
    console.error('Snapshot creation failed (non-critical):', e.message);
  }
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

  const counts = { vocabulary: { c: 0, t: 0 }, kanji: { c: 0, t: 0 }, grammar: { c: 0, t: 0 } };
  let totalCorrect = 0;
  for (const ans of (answers || [])) {
    const q = qMap[ans.question_id];
    if (!q) continue;
    const ok = !!ans.selected_option_id && ans.selected_option_id === q.correctId;
    if (ok) totalCorrect++;
    if (counts[q.category]) { counts[q.category].t++; if (ok) counts[q.category].c++; }
    await supabaseAdmin.from('placement_test_answers')
      .update({ is_correct: ok }).eq('attempt_id', attemptId).eq('question_id', ans.question_id);
  }

  const analysis = buildAnalysis(totalCorrect, counts.vocabulary, counts.kanji, counts.grammar, attempt.jlpt_level_selected || 'N5');
  await supabaseAdmin.from('placement_test_attempts').update({
    status: 'submitted', submitted_at: new Date().toISOString(),
    correct_count: totalCorrect, score: analysis.score,
    vocab_correct: counts.vocabulary.c, vocab_total: counts.vocabulary.t,
    kanji_correct: counts.kanji.c,     kanji_total: counts.kanji.t,
    grammar_correct: counts.grammar.c, grammar_total: counts.grammar.t,
    strengths: analysis.strengthsText, weaknesses: analysis.weaknessText,
    recommended_level: analysis.recommendedLevel,
  }).eq('id', attemptId);

  // Persist a clean current_level enum so the learning path has a starting point.
  // Best-effort — must never break scoring.
  try {
    await supabaseAdmin.from('student_profiles')
      .update({ current_level: deriveCurrentLevel(attempt.jlpt_level_selected || 'N5', analysis.score) })
      .eq('user_id', attempt.user_id);
  } catch (e) {
    console.error('current_level update failed (non-critical):', e.message);
  }

  return analysis;
}

// ── Student API ───────────────────────────────────────────────────────────────

exports.checkStatus = async (req, res) => {
  const userId = req.user.id;
  const [{ data: completed }, { data: pending }] = await Promise.all([
    supabaseAdmin.from('placement_test_attempts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('status', ['submitted', 'auto_submitted']),
    supabaseAdmin.from('placement_test_attempts')
      .select('id, expires_at, jlpt_level_selected')
      .eq('user_id', userId).eq('status', 'in_progress')
      .gt('expires_at', new Date().toISOString()).limit(1).maybeSingle(),
  ]);
  res.json({
    hasCompleted:      (completed?.length ?? 0) > 0,
    hasPendingAttempt: !!pending,
    pendingLevel:      pending?.jlpt_level_selected || null,
    showPopup:         !((completed?.length ?? 0) > 0),
  });
};

exports.getConfig = async (_req, res) => {
  const cfg = await getMainConfig();
  res.json({
    totalQuestions:  cfg.default_question_count,
    durationMinutes: cfg.default_duration_minutes,
    perCategory:     cfg.per_category_count,
    supportedLevels: cfg.supported_jlpt_levels,
    strictLevelOnly: cfg.strict_level_only,
    allowFallback:   cfg.allow_adjacent_level_fallback,
  });
};

exports.getLevels = async (_req, res) => {
  const cfg     = await getMainConfig();
  const counts  = await computeLevelCounts();
  const supported = cfg.supported_jlpt_levels || ALL_LEVELS;

  const result = ALL_LEVELS.map(level => {
    const lc = counts[level] || {};
    const vocab   = lc.vocabulary || 0;
    const kanji   = lc.kanji || 0;
    const grammar = lc.grammar || 0;
    const { canStart, needsFallback } = supported.includes(level)
      ? isLevelUsable(level, counts, cfg)
      : { canStart: false, needsFallback: false };
    return { level, vocabulary: vocab, kanji, grammar, total: vocab + kanji + grammar, available: canStart, needsFallback, supported: supported.includes(level) };
  });
  res.json(result);
};

exports.startAttempt = async (req, res) => {
  const userId = req.user.id;
  const { jlpt_level, force_new = false } = req.body || {};
  const cfg = await getMainConfig();

  // Resume (no level given)
  if (!jlpt_level) {
    const { data: existing } = await supabaseAdmin.from('placement_test_attempts')
      .select('*').eq('user_id', userId).eq('status', 'in_progress')
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!existing) return res.status(400).json({ error: 'Vui lòng chọn cấp độ JLPT để bắt đầu bài thi.' });
    const questions = await fetchQuestionsOrdered(existing.question_ids);
    const { data: savedRaw } = await supabaseAdmin.from('placement_test_answers')
      .select('question_id, selected_option_id').eq('attempt_id', existing.id);
    const savedAnswers = {};
    (savedRaw || []).forEach(a => { savedAnswers[a.question_id] = a.selected_option_id; });
    return res.json({ attempt: existing, questions, savedAnswers, isResuming: true });
  }

  // Validate level
  if (!ALL_LEVELS.includes(jlpt_level))
    return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  if (!(cfg.supported_jlpt_levels || []).includes(jlpt_level))
    return res.status(400).json({ error: `Cấp độ ${jlpt_level} hiện chưa được hỗ trợ.` });

  // Handle existing in-progress
  const { data: existing } = await supabaseAdmin.from('placement_test_attempts')
    .select('*').eq('user_id', userId).eq('status', 'in_progress')
    .gt('expires_at', new Date().toISOString()).maybeSingle();

  if (existing) {
    if (!force_new) {
      const questions = await fetchQuestionsOrdered(existing.question_ids);
      const { data: savedRaw } = await supabaseAdmin.from('placement_test_answers')
        .select('question_id, selected_option_id').eq('attempt_id', existing.id);
      const savedAnswers = {};
      (savedRaw || []).forEach(a => { savedAnswers[a.question_id] = a.selected_option_id; });
      return res.json({ attempt: existing, questions, savedAnswers, isResuming: true });
    }
    await scoreAndFinish(existing.id);
  }

  // Cooldown check
  const cooldownH = cfg.retake_cooldown_hours || 24;
  const { data: lastDone } = await supabaseAdmin.from('placement_test_attempts')
    .select('submitted_at').eq('user_id', userId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false }).limit(1).maybeSingle();
  if (lastDone?.submitted_at && !force_new) {
    const h = (Date.now() - new Date(lastDone.submitted_at).getTime()) / 3_600_000;
    if (h < cooldownH) return res.status(429).json({ error: `Bạn cần đợi thêm ${Math.ceil(cooldownH - h)} giờ để làm lại bài test.` });
  }

  // Validate level availability
  const counts = await computeLevelCounts();
  const { canStart } = isLevelUsable(jlpt_level, counts, cfg);
  if (!canStart) return res.status(422).json({ error: `Cấp độ ${jlpt_level} hiện chưa đủ dữ liệu câu hỏi. Vui lòng chọn cấp độ khác.` });

  // Select questions
  let result;
  try { result = await selectRandomQuestions(jlpt_level, cfg); }
  catch (e) {
    if (e.message.startsWith('INSUFFICIENT')) return res.status(422).json({ error: `Cấp độ ${jlpt_level} chưa đủ câu hỏi.` });
    throw e;
  }

  const { questionIds, fallbackApplied, fallbackFromLevels, generationMode } = result;
  const durMins  = cfg.default_duration_minutes || 30;
  const expiresAt = new Date(Date.now() + durMins * 60_000).toISOString();

  const { data: attempt, error: createErr } = await supabaseAdmin
    .from('placement_test_attempts')
    .insert({ user_id: userId, question_ids: questionIds, expires_at: expiresAt, total_questions: questionIds.length, jlpt_level_selected: jlpt_level, generation_mode: generationMode, fallback_applied: fallbackApplied, fallback_from_levels: fallbackFromLevels })
    .select().single();
  if (createErr) return res.status(500).json({ error: 'Không thể tạo bài thi.' });

  // Non-blocking snapshot creation
  createSnapshots(attempt.id, questionIds);

  // Increment quota usage (non-blocking, best-effort)
  incrementUsage(userId, 'placement_test_monthly').catch(() => {});

  const questions = await fetchQuestionsOrdered(questionIds);
  res.json({ attempt, questions, savedAnswers: {}, isResuming: false });
};

exports.saveAnswer = async (req, res) => {
  const { attemptId } = req.params;
  const { questionId, optionId } = req.body;
  const userId = req.user.id;
  if (!questionId) return res.status(400).json({ error: 'Thiếu questionId.' });

  const { data: attempt } = await supabaseAdmin.from('placement_test_attempts')
    .select('id, status, expires_at, question_ids').eq('id', attemptId).eq('user_id', userId).maybeSingle();
  if (!attempt)                                   return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  if (attempt.status !== 'in_progress')           return res.status(409).json({ error: 'Bài thi đã kết thúc.' });
  if (new Date(attempt.expires_at) <= new Date()) return res.status(410).json({ error: 'Bài thi đã hết giờ.' });
  if (!attempt.question_ids.includes(questionId)) return res.status(400).json({ error: 'Câu hỏi không thuộc bài thi.' });

  const { error: upsertErr } = await supabaseAdmin.from('placement_test_answers')
    .upsert({ attempt_id: attemptId, question_id: questionId, selected_option_id: optionId || null, answered_at: new Date().toISOString() }, { onConflict: 'attempt_id,question_id' });
  if (upsertErr) return res.status(500).json({ error: 'Không thể lưu đáp án.' });

  const { count } = await supabaseAdmin.from('placement_test_answers')
    .select('id', { count: 'exact', head: true }).eq('attempt_id', attemptId).not('selected_option_id', 'is', null);
  await supabaseAdmin.from('placement_test_attempts').update({ answered_count: count || 0 }).eq('id', attemptId);

  res.json({ ok: true, answeredCount: count || 0 });
};

exports.submitAttempt = async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user.id;
  const { data: attempt } = await supabaseAdmin.from('placement_test_attempts')
    .select('id, status').eq('id', attemptId).eq('user_id', userId).maybeSingle();
  if (!attempt)                         return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  if (attempt.status !== 'in_progress') return res.status(409).json({ error: 'Bài thi đã được nộp.' });

  await scoreAndFinish(attemptId);

  const { data: r } = await supabaseAdmin.from('placement_test_attempts').select('*').eq('id', attemptId).single();
  const analysis = buildAnalysis(r.correct_count, { c: r.vocab_correct, t: r.vocab_total }, { c: r.kanji_correct, t: r.kanji_total }, { c: r.grammar_correct, t: r.grammar_total }, r.jlpt_level_selected || 'N5');

  const { data: qwc } = await supabaseAdmin.from('placement_test_questions')
    .select('id, question_text, category, explanation, placement_test_question_options(id, option_text, is_correct, sort_order)')
    .in('id', r.question_ids);
  const { data: answers } = await supabaseAdmin.from('placement_test_answers').select('*').eq('attempt_id', attemptId);

  res.json({ attempt: r, questionsWithCorrect: qwc || [], answers: answers || [], analysis });
};

exports.getResult = async (req, res) => {
  const { attemptId } = req.params;
  const userId = req.user.id;
  const { data: attempt } = await supabaseAdmin.from('placement_test_attempts')
    .select('*').eq('id', attemptId).eq('user_id', userId).maybeSingle();
  if (!attempt)                         return res.status(404).json({ error: 'Không tìm thấy kết quả.' });
  if (attempt.status === 'in_progress') return res.status(400).json({ error: 'Bài thi chưa hoàn thành.' });

  const analysis = buildAnalysis(attempt.correct_count, { c: attempt.vocab_correct, t: attempt.vocab_total }, { c: attempt.kanji_correct, t: attempt.kanji_total }, { c: attempt.grammar_correct, t: attempt.grammar_total }, attempt.jlpt_level_selected || 'N5');

  const { data: qwc } = await supabaseAdmin.from('placement_test_questions')
    .select('id, question_text, category, explanation, placement_test_question_options(id, option_text, is_correct, sort_order)')
    .in('id', attempt.question_ids);
  const { data: answers } = await supabaseAdmin.from('placement_test_answers').select('*').eq('attempt_id', attemptId);

  res.json({ attempt, questionsWithCorrect: qwc || [], answers: answers || [], analysis });
};

exports.getHistory = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('id, status, score, correct_count, total_questions, submitted_at, recommended_level, jlpt_level_selected, vocab_correct, vocab_total, kanji_correct, kanji_total, grammar_correct, grammar_total')
    .eq('user_id', req.user.id).in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false }).limit(20);
  if (error) return res.status(500).json({ error: 'Không tải được lịch sử.' });
  res.json(data || []);
};

// ── Admin API ─────────────────────────────────────────────────────────────────

exports.adminGetConfig = async (_req, res) => {
  const cfg = await getMainConfig();
  res.json(cfg);
};

exports.adminUpdateConfig = async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid config.' });
  const current = await getMainConfig();
  const merged  = { ...current, ...updates };
  const { error } = await supabaseAdmin.from('placement_test_configs')
    .upsert({ key: 'main', value: merged, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: 'Không thể cập nhật cấu hình.' });
  invalidateConfigCache();
  res.json(merged);
};

exports.adminGetStats = async (_req, res) => {
  const cfg    = await getMainConfig();
  const counts = await computeLevelCounts();

  const [{ count: total }, { count: active }, { count: attempts }] = await Promise.all([
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('placement_test_questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('placement_test_attempts').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'auto_submitted']),
  ]);

  const levelStats = ALL_LEVELS.map(level => {
    const lc = counts[level] || {};
    const { canStart, needsFallback } = isLevelUsable(level, counts, cfg);
    return { level, vocabulary: lc.vocabulary || 0, kanji: lc.kanji || 0, grammar: lc.grammar || 0, total: (lc.vocabulary || 0) + (lc.kanji || 0) + (lc.grammar || 0), canStart, needsFallback };
  });

  res.json({ total: total || 0, active: active || 0, attempts: attempts || 0, levelStats, config: { minPerCategory: cfg.min_questions_per_category, strictLevelOnly: cfg.strict_level_only, allowFallback: cfg.allow_adjacent_level_fallback } });
};

exports.adminListQuestions = async (req, res) => {
  const { category, level, difficulty, search, page = 1 } = req.query;
  const limit = 20, offset = (Number(page) - 1) * limit;
  let q = supabaseAdmin.from('placement_test_questions')
    .select('id, question_text, category, level, difficulty, is_active, tags, created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (category)   q = q.eq('category', category);
  if (level)      q = q.eq('level', level);
  if (difficulty) q = q.eq('difficulty', difficulty);
  if (search)     q = q.ilike('question_text', `%${search}%`);
  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: 'Không tải được.' });
  res.json({ questions: data || [], total: count || 0 });
};

exports.adminGetQuestion = async (req, res) => {
  const { data, error } = await supabaseAdmin.from('placement_test_questions')
    .select('*, placement_test_question_options(id, option_text, is_correct, sort_order)').eq('id', req.params.id).maybeSingle();
  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
  res.json(data);
};

exports.adminCreateQuestion = async (req, res) => {
  const { question_text, category, level, difficulty, explanation, tags, is_active, options } = req.body;
  if (!question_text || !category)      return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  if (!options?.length)                 return res.status(400).json({ error: 'Cần ít nhất 2 đáp án.' });
  if (!options.some(o => o.is_correct)) return res.status(400).json({ error: 'Cần đánh dấu ít nhất một đáp án đúng.' });
  const { data: q, error: qErr } = await supabaseAdmin.from('placement_test_questions')
    .insert({ question_text, category, level: level || 'N5', difficulty: difficulty || 'easy', explanation: explanation || null, tags: tags || [], is_active: is_active !== false })
    .select().single();
  if (qErr) return res.status(500).json({ error: 'Không thể tạo câu hỏi: ' + qErr.message });
  await supabaseAdmin.from('placement_test_question_options')
    .insert(options.map((o, i) => ({ question_id: q.id, option_text: o.option_text, is_correct: !!o.is_correct, sort_order: i + 1 })));
  res.status(201).json(q);
};

exports.adminUpdateQuestion = async (req, res) => {
  const { question_text, category, level, difficulty, explanation, tags, is_active, options } = req.body;
  const { data, error } = await supabaseAdmin.from('placement_test_questions')
    .update({ question_text, category, level, difficulty, explanation, tags, is_active, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật.' });
  if (options?.length) {
    if (!options.some(o => o.is_correct)) return res.status(400).json({ error: 'Cần ít nhất một đáp án đúng.' });
    await supabaseAdmin.from('placement_test_question_options').delete().eq('question_id', req.params.id);
    await supabaseAdmin.from('placement_test_question_options')
      .insert(options.map((o, i) => ({ question_id: req.params.id, option_text: o.option_text, is_correct: !!o.is_correct, sort_order: i + 1 })));
  }
  res.json(data);
};

exports.adminToggleQuestion = async (req, res) => {
  const { data, error } = await supabaseAdmin.from('placement_test_questions')
    .update({ is_active: !!req.body.is_active }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Không thể cập nhật.' });
  res.json(data);
};

exports.adminDeleteQuestion = async (req, res) => {
  const { error } = await supabaseAdmin.from('placement_test_questions').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Không thể xóa.' });
  res.json({ ok: true });
};
