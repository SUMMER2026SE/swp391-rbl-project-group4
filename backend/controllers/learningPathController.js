'use strict';

const { supabaseAdmin }  = require('../config/supabase');
const { incrementUsage } = require('../services/quotaService');
const { chatCompletion } = require('../config/ai');
const { buildLearnerProfile, toSnapshot, profileToPrompt } = require('../services/learnerProfileService');
const { pickExternal, getResourceById } = require('../services/externalResources');

// Bảng mock_exams nằm trong schema jlpt_module (migration 024)
const jlptDb     = supabaseAdmin.schema('jlpt_module');
const aiDb       = supabaseAdmin.schema('ai_module');
const langDb     = supabaseAdmin.schema('language_module');
const practiceDb = supabaseAdmin.schema('practice_module');

const LEVELS      = ['N5', 'N4', 'N3', 'N2', 'N1'];
const BEGINNER    = 'BEGINNER';   // chưa biết bảng chữ cái — thấp hơn N5
const SKILL_FOCUS = ['vocabulary', 'kanji', 'grammar', 'reading', 'listening', 'writing', 'mixed'];
// Kỹ năng hợp lệ cho ô "trọng tâm" ở form (không gồm 'mixed' — rỗng nghĩa là học đều)
const FOCUS_SKILLS = ['vocabulary', 'kanji', 'grammar', 'reading', 'listening', 'writing'];

// Quỹ thời gian mỗi ngày phải THỰC SỰ đổi khối lượng lộ trình. Trước đây daily_minutes
// chỉ được in ra một dòng nên 1 giờ/ngày và 6 giờ/ngày cho kết quả như nhau.
function timeBudget(dailyMinutes) {
  const m = Number(dailyMinutes) || 0;
  if (!m)        return { label: 'không rõ', steps: '7–8',   perStep: '3–5 ngày',  guide: 'Giả định khoảng 30 phút/ngày.' };
  if (m < 30)    return { label: `${m} phút/ngày (ít)`,        steps: '5–6',   perStep: '5–8 ngày',
    guide: 'Quỹ thời gian hẹp: CHỈ giữ nội dung cốt lõi, mỗi mốc nhỏ gọn, không thêm nội dung bổ trợ.' };
  if (m < 60)    return { label: `${m} phút/ngày (vừa)`,       steps: '7–8',   perStep: '4–6 ngày',
    guide: 'Cân đối: mỗi mốc vừa phải, xen kẽ ôn tập.' };
  if (m < 120)   return { label: `${m} phút/ngày (nhiều)`,     steps: '9–11',  perStep: '3–5 ngày',
    guide: 'Học được nhiều: thêm mốc luyện tập bổ trợ và tăng tần suất luyện đề.' };
  return { label: `${m} phút/ngày (rất nhiều)`, steps: '12–14', perStep: '2–4 ngày',
    guide: 'Cường độ cao: chia mốc nhỏ để tiến nhanh, thêm nhiều mốc luyện đề, luyện đủ cả 4 kỹ năng song song.' };
}
const CATALOG_CAP = 40;       // max items per resource type sent to the AI
const AI_MODEL    = process.env.FPT_AI_MODEL || 'gemma-4-31B-it';

// Mỗi lần "Tạo lại" phải cho ra phương án khác — nhưng khác một cách CÓ CHỦ ĐÍCH và
// giải thích được cho học viên, thay vì trông chờ vào tính ngẫu nhiên của model.
// Lần tạo lại luôn chọn chiến lược kế tiếp trong danh sách này.
const STRATEGIES = [
  {
    key: 'weakness_first',
    label: 'Tập trung khắc phục điểm yếu',
    instruction: 'Đặt kỹ năng YẾU NHẤT lên đầu lộ trình và dành nhiều mốc nhất cho nó. Các kỹ năng khác chỉ duy trì ở mức tối thiểu.',
  },
  {
    key: 'foundation_first',
    label: 'Xây nền tảng trước',
    instruction: 'Củng cố nền tảng từ vựng và kanji ở các mốc đầu, sau đó mới sang ngữ pháp, đọc và nghe. Phù hợp khi nền chưa vững.',
  },
  {
    key: 'balanced',
    label: 'Cân bằng các kỹ năng',
    instruction: 'Xen kẽ đều các kỹ năng qua từng mốc để tiến bộ toàn diện, tránh học dồn một kỹ năng quá lâu.',
  },
  {
    key: 'exam_oriented',
    label: 'Bám sát đề thi',
    instruction: 'Thiết kế theo hướng luyện đề: chèn nhiều mốc thi thử xen giữa các mốc ôn tập để đo tiến bộ liên tục.',
  },
];

// Chọn chiến lược: lần đầu ưu tiên "đánh vào điểm yếu" (nếu đã biết điểm yếu),
// lần tạo lại thì xoay sang chiến lược kế tiếp so với lần trước.
function pickStrategy(previousKey, hasWeakness) {
  if (!previousKey) return hasWeakness ? STRATEGIES[0] : STRATEGIES[1];
  const i = STRATEGIES.findIndex(s => s.key === previousKey);
  return STRATEGIES[(i < 0 ? 0 : i + 1) % STRATEGIES.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Inclusive level span from current → target (e.g. N5→N3 = [N5,N4,N3]).
// Also tolerates target < current by returning just the current level.
function levelSpan(current, target) {
  // Người mới chưa có cấp JLPT nào → học liệu bắt đầu từ N5
  const ci = current === BEGINNER ? 0 : LEVELS.indexOf(current);
  const ti = LEVELS.indexOf(target);
  if (ci < 0) return [];
  if (ti < 0 || ti < ci) return [LEVELS[ci]];
  return LEVELS.slice(ci, ti + 1);
}

const skillFromListType = (t) =>
  (t === 'vocabulary' || t === 'kanji' || t === 'grammar') ? t : 'mixed';

// Trộn mảng theo seed — mỗi lần tạo lại cho thứ tự danh mục khác nhau, nhờ đó AI
// không bị "mỏ neo" vào cùng vài học liệu đầu danh sách như trước.
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;      // LCG
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Kỹ năng mà mỗi loại học liệu phục vụ — dùng để lọc theo trọng tâm người dùng chọn.
const skillOfList = (t) => (t === 'vocabulary' || t === 'kanji' || t === 'grammar') ? t : 'mixed';

// Build the whitelist catalog the AI is allowed to reference.
// profile     : loại học liệu đã hoàn thành, đánh dấu khoá đang học dở.
// focusSkills : rỗng = học đều; có giá trị = chỉ giữ học liệu phục vụ các kỹ năng đó.
async function buildCatalog(span, profile = null, seed = 0, focusSkills = []) {
  const [coursesRes, listsRes, mocksRes, articlesRes, listeningRes] = await Promise.all([
    supabaseAdmin.from('courses')
      .select('id, title, level, description').in('level', span).eq('is_published', true).limit(CATALOG_CAP),
    langDb.from('study_list_posts')
      .select('id, title, list_type, level, description').in('level', span).limit(CATALOG_CAP),
    jlptDb.from('mock_exams')
      .select('id, title, level').in('level', span).eq('is_published', true).limit(CATALOG_CAP),
    // Bài luyện ĐỌC và NGHE — trước đây bị bỏ quên nên lộ trình không phát triển đủ 4 kỹ năng
    practiceDb.from('articles')
      .select('id, title, title_vi, level').in('level', span).eq('is_published', true).limit(CATALOG_CAP),
    practiceDb.from('listening_dialogues')
      .select('id, title, title_vi, level, topic').in('level', span).eq('is_published', true).limit(CATALOG_CAP),
  ]);

  const done       = profile?.completedResourceIds || new Set();
  const inProgress = profile?.inProgressPct || new Map();

  const focus  = new Set(focusSkills || []);
  const wants  = (skill) => focus.size === 0 || focus.has(skill) || skill === 'mixed';
  const covered = new Set();                 // kỹ năng thực sự có học liệu trong catalog

  const index = new Map();
  const lines = [];
  const push = (id, meta, line, skill) => {
    index.set(id, meta); lines.push(line); if (skill) covered.add(skill);
  };

  for (const c of (coursesRes.data || [])) {
    if (done.has(c.id)) continue;                       // đã học xong → không gợi ý lại
    if (focus.size && !focus.has('mixed') && focus.size < 4) {
      // Khoá học là tổng hợp — khi người dùng thu hẹp trọng tâm (vd chỉ Kanji) thì bỏ qua
      continue;
    }
    const mark = inProgress.has(c.id) ? ` [ĐANG HỌC ~${inProgress.get(c.id)}%]` : '';
    push(c.id, { resource_type: 'course', level: c.level, title: c.title },
      `[${c.id}] (course, ${c.level}) ${c.title}${mark}${c.description ? ' — ' + String(c.description).slice(0, 80) : ''}`, 'mixed');
  }
  for (const p of (listsRes.data || [])) {
    const skill = skillOfList(p.list_type);
    if (!wants(skill)) continue;
    push(p.id, { resource_type: 'study_list', level: p.level, title: p.title, list_type: p.list_type },
      `[${p.id}] (study_list/${p.list_type} → ${skill}, ${p.level}) ${p.title}`, skill);
  }
  for (const a of (articlesRes.data || [])) {
    if (!wants('reading')) continue;
    push(a.id, { resource_type: 'article', level: a.level, title: a.title },
      `[${a.id}] (article → LUYỆN ĐỌC, ${a.level}) ${a.title_vi || a.title}`, 'reading');
  }
  for (const l of (listeningRes.data || [])) {
    if (!wants('listening')) continue;
    push(l.id, { resource_type: 'listening', level: l.level, title: l.title },
      `[${l.id}] (listening → LUYỆN NGHE, ${l.level}) ${l.title_vi || l.title}${l.topic ? ' — ' + l.topic : ''}`, 'listening');
  }
  for (const m of (mocksRes.data || [])) {
    if (done.has(m.id)) continue;                       // đề đã ĐẠT → bỏ
    if (focus.size && focus.size < 4 && !focus.has('mixed')) continue;
    push(m.id, { resource_type: 'mock_exam', level: m.level, title: m.title },
      `[${m.id}] (mock_exam, ${m.level}) ${m.title}`, 'mixed');
  }

  // Kỹ năng người dùng muốn nhưng catalog nội bộ không có gì → mới cần nguồn ngoài
  const gaps = [...focus].filter(s => !covered.has(s));

  return { index, text: (seed ? seededShuffle(lines, seed) : lines).join('\n'), covered, gaps };
}

// Call the AI once and return a parsed array of raw milestones (may throw 502).
async function callAI(context) {
  const {
    current, target, goal, dailyMinutes, catalogText,
    profileText, strategy, previousPath, isRegenerate,
    focusSkills = [], budget, externalText, isBeginner,
  } = context;

  const SYSTEM = `Bạn là cố vấn học tập JLPT. Nhiệm vụ: thiết kế lộ trình học CÁ NHÂN HOÁ gồm các mốc (milestone) có thứ tự.

QUY TẮC BẮT BUỘC:
- Mỗi mốc PHẢI tham chiếu một học liệu bằng "resource_id" LẤY CHÍNH XÁC từ DANH MỤC được cung cấp. TUYỆT ĐỐI KHÔNG bịa id.
- Thứ tự và trọng tâm các mốc PHẢI bám theo HỒ SƠ NĂNG LỰC và CHIẾN LƯỢC được giao.
- Trường "rationale" PHẢI trích dẫn SỐ LIỆU THẬT từ hồ sơ năng lực (vd: "Nghe chỉ 6/60 điểm ở đề gần nhất nên cần luyện nghe trước").
  Nếu học viên chưa có dữ liệu, nói rõ là lộ trình nhập môn — KHÔNG được bịa điểm số.
- "skill_focus" phải là một trong: vocabulary, kanji, grammar, reading, listening, writing, mixed.
- "estimated_days" là SỐ NGÀY ước tính để hoàn thành mốc đó, tính theo quỹ thời gian mỗi ngày của học viên.
- ƯU TIÊN TUYỆT ĐỐI học liệu trong DANH MỤC (nội dung của hệ thống). Chỉ dùng mục ở NGUỒN BỔ SUNG khi hệ thống không có nội dung tương ứng.
- Toàn bộ nội dung (title, description, rationale) viết bằng tiếng Việt.
- CHỈ trả về MỘT mảng JSON hợp lệ, KHÔNG kèm bất kỳ văn bản nào khác.

Schema mỗi phần tử:
{"title": string, "description": string, "skill_focus": string, "resource_type": "course"|"study_list"|"mock_exam"|"article"|"listening"|"practice"|"external", "resource_id": string (id LẤY TỪ danh mục hoặc nguồn bổ sung), "estimated_days": number, "rationale": string}`;

  const focusText = focusSkills.length
    ? `${focusSkills.join(', ')} — CHỈ tập trung các kỹ năng này, KHÔNG chèn kỹ năng khác.`
    : 'Phát triển ĐỀU cả 4 kỹ năng — lộ trình BẮT BUỘC có cả mục luyện ĐỌC (article) và luyện NGHE (listening), không chỉ toàn khoá học và danh sách từ vựng.';

  const parts = [
    `HỌC VIÊN:
- Trình độ hiện tại: ${isBeginner ? 'NGƯỜI MỚI HOÀN TOÀN (chưa biết bảng chữ cái Hiragana/Katakana)' : current}
- Mục tiêu: ${target}
- Mục tiêu học tập: ${goal || 'không nêu'}
- Trọng tâm: ${focusText}`,
    profileText,
    `QUỸ THỜI GIAN — ${budget.label}:
- ${budget.guide}
- Số mốc phù hợp: ${budget.steps} mốc. Mỗi mốc khoảng ${budget.perStep}.
- BẮT BUỘC điền "estimated_days" cho từng mốc theo quỹ thời gian này. Người học nhiều giờ/ngày phải có
  lộ trình DÀY hơn và số ngày mỗi mốc NGẮN hơn người học ít giờ/ngày.`,
    `CHIẾN LƯỢC LẦN NÀY — ${strategy.label}:
${strategy.instruction}`,
  ];

  if (isBeginner) {
    parts.push(`LƯU Ý NGƯỜI MỚI:
- 2–3 mốc ĐẦU TIÊN phải là bảng chữ cái Hiragana, Katakana và phát âm (lấy từ NGUỒN BỔ SUNG bên dưới,
  vì hệ thống chưa có nội dung dạy phần này).
- Sau khi xong nền tảng mới chuyển sang khoá học và học liệu N5 trong hệ thống.`);
  }

  if (externalText) {
    parts.push(`NGUỒN BỔ SUNG (chỉ dùng khi hệ thống KHÔNG có nội dung tương ứng — luôn ưu tiên DANH MỤC trước):
${externalText}`);
  }

  if (isRegenerate && previousPath?.length) {
    parts.push(`LỘ TRÌNH TRƯỚC ĐÓ (học viên muốn một phương án KHÁC):
${previousPath.map((s, i) => `${i + 1}. ${s.title} [${s.resource_id}]`).join('\n')}

YÊU CẦU KHI TẠO LẠI:
- Đưa ra phương án KHÁC BIỆT RÕ RỆT so với danh sách trên: đổi thứ tự ưu tiên kỹ năng, đổi cách chia giai đoạn.
- ƯU TIÊN chọn học liệu CHƯA xuất hiện ở lộ trình trước. Chỉ giữ lại học liệu cũ nếu thực sự thiết yếu.
- Cách diễn đạt title/description cũng phải khác, không lặp nguyên văn.`);
  }

  parts.push(`DANH MỤC HỌC LIỆU (chỉ được chọn resource_id trong đây):
${catalogText}`);

  parts.push(`Hãy tạo lộ trình 6–10 mốc từ ${current} → ${target} theo đúng chiến lược trên. Trả về ĐÚNG một mảng JSON.`);

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: parts.join('\n\n') }],
    // Tạo lại cần đa dạng hơn hẳn, nếu không mọi lần sẽ ra gần như cùng kết quả.
    { max_tokens: 3000, temperature: isRegenerate ? 0.85 : 0.45 }
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
    if (seen.has(m.resource_id)) continue;    // dedupe

    const days = Number(m.estimated_days);
    const estimated_days = Number.isFinite(days) && days > 0 ? Math.min(Math.round(days), 90) : null;

    const base = {
      order_index:  steps.length,
      title:        String(m.title).slice(0, 200),
      description:  m.description ? String(m.description).slice(0, 600) : null,
      skill_focus:  SKILL_FOCUS.includes(m.skill_focus) ? m.skill_focus : 'mixed',
      rationale:    m.rationale ? String(m.rationale).slice(0, 600) : null,
      estimated_days,
    };

    const cat = catalogIndex.get(m.resource_id);
    if (cat) {
      seen.add(m.resource_id);
      steps.push({
        ...base,
        resource_type:  cat.resource_type,    // tin catalog, không tin AI
        resource_id:    m.resource_id,
        resource_level: cat.level || null,
      });
      continue;
    }

    // Nguồn ngoài / trang luyện cố định: URL LẤY TỪ WHITELIST, không dùng URL do AI sinh
    // (model không truy cập internet nên link nó tự viết thường sai/chết).
    const ext = getResourceById(m.resource_id);
    if (ext) {
      seen.add(m.resource_id);
      steps.push({
        ...base,
        skill_focus:     SKILL_FOCUS.includes(ext.skill) ? ext.skill : base.skill_focus,
        resource_type:   ext.kind === 'practice' ? 'practice' : 'external',
        resource_id:     null,
        resource_level:  null,
        external_url:    ext.url,
        external_source: ext.source || null,
      });
      continue;
    }
    // id không có trong catalog lẫn whitelist → AI bịa → bỏ
  }
  return steps;
}

// Re-query live resource titles/levels for a set of steps (keeps titles fresh,
// flags resources that were deleted after the path was generated).
// Mốc trỏ tới nguồn ngoài / trang luyện cố định không có bản ghi trong DB —
// chúng dùng external_url nên KHÔNG bao giờ được coi là "học liệu không khả dụng".
const isLinkStep = (t) => t === 'practice' || t === 'external';

async function enrichSteps(steps) {
  const byType = { course: [], study_list: [], mock_exam: [], article: [], listening: [] };
  for (const s of steps) {
    if (byType[s.resource_type] && s.resource_id) byType[s.resource_type].push(s.resource_id);
  }

  const meta = new Map();  // id → { title, level, list_type }
  const [courses, lists, mocks, articles, listenings] = await Promise.all([
    byType.course.length     ? supabaseAdmin.from('courses').select('id, title, level').in('id', byType.course)               : { data: [] },
    byType.study_list.length ? langDb.from('study_list_posts').select('id, title, level, list_type').in('id', byType.study_list) : { data: [] },
    byType.mock_exam.length  ? jlptDb.from('mock_exams').select('id, title, level').in('id', byType.mock_exam)         : { data: [] },
    byType.article.length    ? practiceDb.from('articles').select('id, title, title_vi, level').in('id', byType.article)  : { data: [] },
    byType.listening.length  ? practiceDb.from('listening_dialogues').select('id, title, title_vi, level').in('id', byType.listening) : { data: [] },
  ]);
  for (const c of (courses.data || []))    meta.set(c.id, { title: c.title, level: c.level });
  for (const p of (lists.data || []))      meta.set(p.id, { title: p.title, level: p.level, list_type: p.list_type });
  for (const m of (mocks.data || []))      meta.set(m.id, { title: m.title, level: m.level });
  for (const a of (articles.data || []))   meta.set(a.id, { title: a.title_vi || a.title, level: a.level });
  for (const l of (listenings.data || [])) meta.set(l.id, { title: l.title_vi || l.title, level: l.level });

  return steps.map(s => {
    if (isLinkStep(s.resource_type)) {
      return { ...s, resource_title: s.title, resource_list_type: null, resource_missing: !s.external_url };
    }
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
  const { data: path } = await aiDb
    .from('learning_paths').select('*').eq('id', pathId).single();
  if (!path) return null;
  const { data: rawSteps } = await aiDb
    .from('learning_path_steps').select('*').eq('path_id', pathId).order('order_index', { ascending: true });
  const steps = await enrichSteps(rawSteps || []);
  const total = steps.length;
  const done  = steps.filter(s => s.status === 'completed').length;
  return { path, steps, progress: { total, completed: done, pct: total ? Math.round((done / total) * 100) : 0 } };
}

// ── Core generation (shared by generate + regenerate) ─────────────────────────

async function generateForUser(userId, body, isRegenerate = false) {
  const { data: profile } = await supabaseAdmin
    .from('student_profiles')
    .select('current_level, jlpt_target_level, study_goal, daily_study_minutes')
    .eq('user_id', userId).maybeSingle();

  const clean = (v) => (typeof v === 'string' ? v.trim() : v);
  let current = clean(body.current_level) || (profile?.current_level ? profile.current_level.trim() : null) || 'N5';
  let target  = clean(body.target_level) || (profile?.jlpt_target_level ? profile.jlpt_target_level.trim() : null) || null;

  const isBeginner = current === BEGINNER;
  if (!isBeginner && !LEVELS.includes(current)) current = 'N5';
  if (!target || !LEVELS.includes(target)) {
    // Người mới mặc định nhắm N5; còn lại tăng 1 cấp
    const ci = isBeginner ? -1 : LEVELS.indexOf(current);
    target = LEVELS[Math.min(ci + 1, LEVELS.length - 1)];
  }

  // Trọng tâm kỹ năng do người dùng chọn — rỗng nghĩa là học đều 4 kỹ năng
  const focusSkills = Array.isArray(body.focus_skills)
    ? [...new Set(body.focus_skills.filter(s => FOCUS_SKILLS.includes(s)))]
    : [];

  const goal         = clean(body.study_goal) || profile?.study_goal || null;
  const dailyMinutes = body.daily_minutes != null ? Number(body.daily_minutes) : (profile?.daily_study_minutes ?? null);

  const span = levelSpan(current, target);

  // ── Cá nhân hoá: dựng hồ sơ năng lực từ dữ liệu học tập thật ──
  const learner = await buildLearnerProfile(userId, span);

  // Lộ trình đang hoạt động (nếu có) — dùng để tạo lại cho ra phương án KHÁC
  const { data: prevPath } = await aiDb.from('learning_paths')
    .select('id, learner_snapshot')
    .eq('user_id', userId).eq('status', 'active').maybeSingle();

  let previousSteps = [];
  if (isRegenerate && prevPath) {
    const { data: ps } = await aiDb.from('learning_path_steps')
      .select('title, resource_id').eq('path_id', prevPath.id).order('order_index');
    previousSteps = ps || [];
  }

  const strategy = pickStrategy(
    isRegenerate ? prevPath?.learner_snapshot?.strategy : null,
    learner.weaknesses.length > 0,
  );

  // Seed đổi mỗi lần tạo lại → thứ tự danh mục khác → AI không lặp lại lựa chọn cũ
  const seed = isRegenerate ? Date.now() % 100000 : 0;
  const { index: catalogIndex, text: catalogText, gaps } =
    await buildCatalog(span, learner, seed, focusSkills);

  // Nguồn bổ sung: trang luyện nội bộ + (chỉ khi hệ thống thiếu) nguồn ngoài đã kiểm duyệt
  const externals = pickExternal({ isBeginner, focusSkills, gaps });
  const externalText = externals.length
    ? externals.map(r => `[${r.id}] (${r.kind === 'practice' ? 'practice — TRONG HỆ THỐNG' : 'external — ' + r.source}, ${r.skill}) ${r.title}${r.note ? ' — ' + r.note : ''}`).join('\n')
    : '';

  if (catalogIndex.size === 0 && externals.length === 0) {
    const e = new Error('Chưa đủ học liệu cho cấp độ này để tạo lộ trình. Vui lòng thử lại sau.');
    e.httpStatus = 422;
    throw e;
  }

  const profileText = profileToPrompt(learner);
  const budget = timeBudget(dailyMinutes);

  // Generate + validate, with one retry if nothing survives validation.
  let steps = [];
  for (let attempt = 0; attempt < 2 && steps.length === 0; attempt++) {
    const rawSteps = await callAI({
      current, target, goal, dailyMinutes, catalogText,
      profileText, strategy, previousPath: previousSteps, isRegenerate,
      focusSkills, budget, externalText, isBeginner,
    });
    steps = validateSteps(rawSteps, catalogIndex);
  }
  if (steps.length === 0) {
    const e = new Error('AI chưa tạo được lộ trình hợp lệ. Vui lòng thử lại.');
    e.httpStatus = 502;
    throw e;
  }

  // Archive any existing active path, then insert the new one.
  await aiDb.from('learning_paths')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'active');

  const { data: path, error: pErr } = await aiDb.from('learning_paths').insert({
    user_id: userId,
    current_level: current,
    target_level: target,
    study_goal: goal,
    daily_minutes: dailyMinutes,
    ai_model: AI_MODEL,
    focus_skills: focusSkills.length ? focusSkills : null,
    learner_snapshot: { ...toSnapshot(learner, strategy.key), focusSkills, timeBudget: budget.label },
  }).select().single();
  if (pErr) throw pErr;

  const rows = steps.map(s => ({ ...s, path_id: path.id }));
  const { error: sErr } = await aiDb.from('learning_path_steps').insert(rows);
  if (sErr) throw sErr;

  incrementUsage(userId, 'learning_path_generate_monthly').catch(() => {});

  return fetchFullPath(path.id);
}

// ── Controllers ───────────────────────────────────────────────────────────────

exports.getPath = async (req, res) => {
  try {
    const { data: path } = await aiDb
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

function handleGenerate(isRegenerate) {
  return async (req, res) => {
    try {
      const full = await generateForUser(req.user.id, req.body || {}, isRegenerate);
      res.status(201).json(full);
    } catch (err) {
      console.error('generate learning path error:', err.message);
      res.status(err.httpStatus || 500).json({ error: err.message || 'Không thể tạo lộ trình học.' });
    }
  };
}

// Tạo mới và tạo lại KHÁC nhau: tạo lại đọc lộ trình cũ, đổi chiến lược, tăng đa dạng.
exports.generatePath   = handleGenerate(false);
exports.regeneratePath = handleGenerate(true);

exports.updateStep = async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  }
  try {
    // Verify the step belongs to the requesting user (via its path).
    const { data: step } = await aiDb
      .from('learning_path_steps').select('id, path_id').eq('id', req.params.id).maybeSingle();
    if (!step) return res.status(404).json({ error: 'Không tìm thấy bước học.' });

    const { data: path } = await aiDb
      .from('learning_paths').select('id, user_id').eq('id', step.path_id).single();
    if (!path || path.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền.' });
    }

    await aiDb.from('learning_path_steps')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', req.params.id);

    const full = await fetchFullPath(step.path_id);
    res.json(full);
  } catch (err) {
    console.error('updateStep error:', err.message);
    res.status(500).json({ error: 'Không thể cập nhật bước học.' });
  }
};
