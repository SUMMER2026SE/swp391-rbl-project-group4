'use strict';

const { supabaseAdmin }  = require('../config/supabase');
const { incrementUsage } = require('../services/quotaService');
const { chatCompletion } = require('../config/ai');

const LEVELS      = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SKILL_FOCUS = ['vocabulary', 'kanji', 'grammar', 'reading', 'listening', 'mixed'];
const CATALOG_CAP = 40;       // max items per resource type sent to the AI
const AI_MODEL    = process.env.FPT_AI_MODEL || 'gemma-4-31B-it';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Inclusive level span from current → target (e.g. N5→N3 = [N5,N4,N3]).
// Also tolerates target < current by returning just the current level.
function levelSpan(current, target) {
  const ci = LEVELS.indexOf(current);
  const ti = LEVELS.indexOf(target);
  if (ci < 0) return [];
  if (ti < 0 || ti < ci) return [current];
  return LEVELS.slice(ci, ti + 1);
}

const skillFromListType = (t) =>
  (t === 'vocabulary' || t === 'kanji' || t === 'grammar') ? t : 'mixed';

// Build the whitelist catalog the AI is allowed to reference.
async function buildCatalog(span) {
  const [coursesRes, listsRes, mocksRes] = await Promise.all([
    supabaseAdmin.from('courses')
      .select('id, title, level, description').in('level', span).eq('is_published', true).limit(CATALOG_CAP),
    supabaseAdmin.from('study_list_posts')
      .select('id, title, list_type, level, description').in('level', span).limit(CATALOG_CAP),
    supabaseAdmin.from('mock_exams')
      .select('id, title, level').in('level', span).eq('is_published', true).limit(CATALOG_CAP),
  ]);

  const index = new Map();   // resource_id → { resource_type, level, title, list_type }
  const lines = [];

  for (const c of (coursesRes.data || [])) {
    index.set(c.id, { resource_type: 'course', level: c.level, title: c.title });
    lines.push(`[${c.id}] (course, ${c.level}) ${c.title}${c.description ? ' — ' + String(c.description).slice(0, 80) : ''}`);
  }
  for (const p of (listsRes.data || [])) {
    index.set(p.id, { resource_type: 'study_list', level: p.level, title: p.title, list_type: p.list_type });
    lines.push(`[${p.id}] (study_list/${p.list_type}, ${p.level}) ${p.title}`);
  }
  for (const m of (mocksRes.data || [])) {
    index.set(m.id, { resource_type: 'mock_exam', level: m.level, title: m.title });
    lines.push(`[${m.id}] (mock_exam, ${m.level}) ${m.title}`);
  }

  return { index, text: lines.join('\n') };
}

async function loadLatestPlacement(userId) {
  const { data } = await supabaseAdmin
    .from('placement_test_attempts')
    .select('id, score, vocab_correct, vocab_total, kanji_correct, kanji_total, grammar_correct, grammar_total, strengths, weaknesses, jlpt_level_selected')
    .eq('user_id', userId)
    .in('status', ['submitted', 'auto_submitted'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

const pct = (c, t) => (t > 0 ? Math.round((c / t) * 100) : null);

// Call the AI once and return a parsed array of raw milestones (may throw 502).
async function callAI(context) {
  const { current, target, goal, dailyMinutes, placement, catalogText } = context;

  let breakdown = 'Chưa có dữ liệu bài kiểm tra đầu vào.';
  if (placement) {
    const vp = pct(placement.vocab_correct, placement.vocab_total);
    const kp = pct(placement.kanji_correct, placement.kanji_total);
    const gp = pct(placement.grammar_correct, placement.grammar_total);
    breakdown = [
      `Điểm tổng: ${placement.score ?? '?'}%`,
      vp !== null ? `Từ vựng: ${vp}%` : null,
      kp !== null ? `Kanji: ${kp}%` : null,
      gp !== null ? `Ngữ pháp: ${gp}%` : null,
      placement.strengths ? placement.strengths : null,
      placement.weaknesses ? placement.weaknesses : null,
    ].filter(Boolean).join(' · ');
  }

  const SYSTEM = `Bạn là cố vấn học tập JLPT. Nhiệm vụ: thiết kế một lộ trình học cá nhân hoá gồm các mốc (milestone) có thứ tự từ dễ đến khó.

QUY TẮC BẮT BUỘC:
- Mỗi mốc PHẢI tham chiếu một học liệu bằng "resource_id" LẤY CHÍNH XÁC từ DANH MỤC được cung cấp. TUYỆT ĐỐI KHÔNG bịa id, không tự tạo id mới.
- Ưu tiên khắc phục kỹ năng yếu của học viên.
- Sắp xếp từ cấp độ hiện tại tiến dần lên mục tiêu.
- "skill_focus" phải là một trong: vocabulary, kanji, grammar, reading, listening, mixed.
- Toàn bộ nội dung (title, description, rationale) viết bằng tiếng Việt.
- CHỈ trả về MỘT mảng JSON hợp lệ, KHÔNG kèm bất kỳ văn bản nào khác.

Schema mỗi phần tử:
{"title": string, "description": string, "skill_focus": string, "resource_type": "course"|"study_list"|"mock_exam", "resource_id": string (id trong danh mục), "rationale": string}`;

  const userMsg = `HỌC VIÊN:
- Trình độ hiện tại: ${current}
- Mục tiêu: ${target}
- Mục tiêu học tập: ${goal || 'không nêu'}
- Thời gian học mỗi ngày: ${dailyMinutes ? dailyMinutes + ' phút' : 'không nêu'}
- Kết quả kiểm tra đầu vào: ${breakdown}

DANH MỤC HỌC LIỆU (chỉ được chọn resource_id trong đây):
${catalogText}

Hãy tạo lộ trình 6–10 mốc từ ${current} → ${target}, ưu tiên khắc phục điểm yếu. Trả về ĐÚNG một mảng JSON.`;

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    { max_tokens: 3000, temperature: 0.4 }
  );

  const raw = result.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    const e = new Error('AI không trả về JSON hợp lệ.');
    e.httpStatus = 502; e.raw = raw.slice(0, 300);
    throw e;
  }
  let arr;
  try { arr = JSON.parse(match[0]); }
  catch {
    const e = new Error('Không thể phân tích JSON từ AI.');
    e.httpStatus = 502; e.raw = raw.slice(0, 300);
    throw e;
  }
  if (!Array.isArray(arr)) {
    const e = new Error('AI trả về định dạng không mong đợi.');
    e.httpStatus = 502;
    throw e;
  }
  return arr;
}

// Validate AI milestones against the catalog whitelist → clean step rows.
function validateSteps(rawSteps, catalogIndex) {
  const steps = [];
  const seen = new Set();
  for (const m of rawSteps) {
    if (!m || !m.title || !m.resource_id) continue;
    const cat = catalogIndex.get(m.resource_id);
    if (!cat) continue;                       // hallucinated / unknown id → drop
    if (seen.has(m.resource_id)) continue;    // dedupe
    seen.add(m.resource_id);
    steps.push({
      order_index:    steps.length,
      title:          String(m.title).slice(0, 200),
      description:    m.description ? String(m.description).slice(0, 600) : null,
      skill_focus:    SKILL_FOCUS.includes(m.skill_focus) ? m.skill_focus : 'mixed',
      rationale:      m.rationale ? String(m.rationale).slice(0, 600) : null,
      resource_type:  cat.resource_type,      // trust the catalog, not the AI
      resource_id:    m.resource_id,
      resource_level: cat.level || null,
    });
  }
  return steps;
}

// Re-query live resource titles/levels for a set of steps (keeps titles fresh,
// flags resources that were deleted after the path was generated).
async function enrichSteps(steps) {
  const byType = { course: [], study_list: [], mock_exam: [] };
  for (const s of steps) if (byType[s.resource_type]) byType[s.resource_type].push(s.resource_id);

  const meta = new Map();  // id → { title, level, list_type }
  const [courses, lists, mocks] = await Promise.all([
    byType.course.length     ? supabaseAdmin.from('courses').select('id, title, level').in('id', byType.course)               : { data: [] },
    byType.study_list.length ? supabaseAdmin.from('study_list_posts').select('id, title, level, list_type').in('id', byType.study_list) : { data: [] },
    byType.mock_exam.length  ? supabaseAdmin.from('mock_exams').select('id, title, level').in('id', byType.mock_exam)         : { data: [] },
  ]);
  for (const c of (courses.data || [])) meta.set(c.id, { title: c.title, level: c.level });
  for (const p of (lists.data || []))   meta.set(p.id, { title: p.title, level: p.level, list_type: p.list_type });
  for (const m of (mocks.data || []))   meta.set(m.id, { title: m.title, level: m.level });

  return steps.map(s => {
    const m = meta.get(s.resource_id);
    return {
      ...s,
      resource_title:    m?.title || null,
      resource_list_type: m?.list_type || null,
      resource_missing:  !m,                 // resource no longer exists
    };
  });
}

async function fetchFullPath(pathId) {
  const { data: path } = await supabaseAdmin
    .from('learning_paths').select('*').eq('id', pathId).single();
  if (!path) return null;
  const { data: rawSteps } = await supabaseAdmin
    .from('learning_path_steps').select('*').eq('path_id', pathId).order('order_index', { ascending: true });
  const steps = await enrichSteps(rawSteps || []);
  const total = steps.length;
  const done  = steps.filter(s => s.status === 'completed').length;
  return { path, steps, progress: { total, completed: done, pct: total ? Math.round((done / total) * 100) : 0 } };
}

// ── Core generation (shared by generate + regenerate) ─────────────────────────

async function generateForUser(userId, body) {
  const { data: profile } = await supabaseAdmin
    .from('student_profiles')
    .select('current_level, jlpt_target_level, study_goal, daily_study_minutes')
    .eq('user_id', userId).maybeSingle();

  const placement = await loadLatestPlacement(userId);

  const clean = (v) => (typeof v === 'string' ? v.trim() : v);
  let current = clean(body.current_level) || (profile?.current_level ? profile.current_level.trim() : null)
    || (placement?.jlpt_level_selected || null) || 'N5';
  let target  = clean(body.target_level) || (profile?.jlpt_target_level ? profile.jlpt_target_level.trim() : null) || null;

  if (!LEVELS.includes(current)) current = 'N5';
  if (!target || !LEVELS.includes(target)) {
    const ci = LEVELS.indexOf(current);
    target = LEVELS[Math.min(ci + 1, LEVELS.length - 1)];   // default: one level up
  }

  const goal         = clean(body.study_goal) || profile?.study_goal || null;
  const dailyMinutes = body.daily_minutes != null ? Number(body.daily_minutes) : (profile?.daily_study_minutes ?? null);

  const span = levelSpan(current, target);
  const { index: catalogIndex, text: catalogText } = await buildCatalog(span);

  if (catalogIndex.size === 0) {
    const e = new Error('Chưa đủ học liệu cho cấp độ này để tạo lộ trình. Vui lòng thử lại sau.');
    e.httpStatus = 422;
    throw e;
  }

  // Generate + validate, with one retry if nothing survives validation.
  let steps = [];
  for (let attempt = 0; attempt < 2 && steps.length === 0; attempt++) {
    const rawSteps = await callAI({ current, target, goal, dailyMinutes, placement, catalogText });
    steps = validateSteps(rawSteps, catalogIndex);
  }
  if (steps.length === 0) {
    const e = new Error('AI chưa tạo được lộ trình hợp lệ. Vui lòng thử lại.');
    e.httpStatus = 502;
    throw e;
  }

  // Archive any existing active path, then insert the new one.
  await supabaseAdmin.from('learning_paths')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'active');

  const { data: path, error: pErr } = await supabaseAdmin.from('learning_paths').insert({
    user_id: userId,
    current_level: current,
    target_level: target,
    study_goal: goal,
    daily_minutes: dailyMinutes,
    source_attempt_id: placement?.id || null,
    ai_model: AI_MODEL,
  }).select().single();
  if (pErr) throw pErr;

  const rows = steps.map(s => ({ ...s, path_id: path.id }));
  const { error: sErr } = await supabaseAdmin.from('learning_path_steps').insert(rows);
  if (sErr) throw sErr;

  incrementUsage(userId, 'learning_path_generate_monthly').catch(() => {});

  return fetchFullPath(path.id);
}

// ── Controllers ───────────────────────────────────────────────────────────────

exports.getPath = async (req, res) => {
  try {
    const { data: path } = await supabaseAdmin
      .from('learning_paths').select('id')
      .eq('user_id', req.user.id).eq('status', 'active')
      .maybeSingle();
    if (!path) return res.json({ path: null });
    const full = await fetchFullPath(path.id);
    res.json(full);
  } catch (err) {
    console.error('getPath error:', err.message);
    res.status(500).json({ error: 'Không thể tải lộ trình học.' });
  }
};

async function handleGenerate(req, res) {
  try {
    const full = await generateForUser(req.user.id, req.body || {});
    res.status(201).json(full);
  } catch (err) {
    console.error('generate learning path error:', err.message);
    res.status(err.httpStatus || 500).json({ error: err.message || 'Không thể tạo lộ trình học.' });
  }
}

exports.generatePath   = handleGenerate;
exports.regeneratePath = handleGenerate;

exports.updateStep = async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  }
  try {
    // Verify the step belongs to the requesting user (via its path).
    const { data: step } = await supabaseAdmin
      .from('learning_path_steps').select('id, path_id').eq('id', req.params.id).maybeSingle();
    if (!step) return res.status(404).json({ error: 'Không tìm thấy bước học.' });

    const { data: path } = await supabaseAdmin
      .from('learning_paths').select('id, user_id').eq('id', step.path_id).single();
    if (!path || path.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền.' });
    }

    await supabaseAdmin.from('learning_path_steps')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', req.params.id);

    const full = await fetchFullPath(step.path_id);
    res.json(full);
  } catch (err) {
    console.error('updateStep error:', err.message);
    res.status(500).json({ error: 'Không thể cập nhật bước học.' });
  }
};
