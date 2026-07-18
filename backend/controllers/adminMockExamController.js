'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { BLUEPRINTS, MONDAI_TYPES, SCORE_COLUMNS, validateQuestionPayload } = require('../utils/jlptMock');

// Toàn bộ bảng mock_* nằm trong schema jlpt_module (migration 024)
const jlptDb = supabaseAdmin.schema('jlpt_module');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Đề đã publish là snapshot bất biến — chặn mọi sửa đổi nội dung.
// Trả về exam row nếu còn sửa được, ném lỗi 400 nếu đã publish.
async function assertEditableExam(examId) {
  const { data: exam, error } = await jlptDb
    .from('mock_exams').select('id, level, is_published').eq('id', examId).single();
  if (error || !exam) { const e = new Error('Không tìm thấy đề thi.'); e.httpStatus = 404; throw e; }
  if (exam.is_published) {
    const e = new Error('Đề đã xuất bản là bất biến. Hãy gỡ xuất bản trước khi sửa nội dung.');
    e.httpStatus = 400; throw e;
  }
  return exam;
}

async function examIdOfSection(sectionId) {
  const { data, error } = await jlptDb
    .from('mock_exam_sections').select('id, exam_id').eq('id', sectionId).single();
  if (error || !data) { const e = new Error('Không tìm thấy phần thi.'); e.httpStatus = 404; throw e; }
  return data.exam_id;
}

async function groupWithExamId(groupId) {
  const { data: group, error } = await jlptDb
    .from('mock_question_groups').select('*').eq('id', groupId).single();
  if (error || !group) { const e = new Error('Không tìm thấy mondai.'); e.httpStatus = 404; throw e; }
  const examId = await examIdOfSection(group.section_id);
  return { group, examId };
}

async function examIdOfQuestion(questionId) {
  const { data, error } = await jlptDb
    .from('mock_questions').select('id, group_id').eq('id', questionId).single();
  if (error || !data) { const e = new Error('Không tìm thấy câu hỏi.'); e.httpStatus = 404; throw e; }
  const { examId } = await groupWithExamId(data.group_id);
  return examId;
}

function handleError(res, err, fallback) {
  console.error(err);
  res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : fallback });
}

// Cấu trúc đề (phần thi + mondai) cố định theo blueprint JLPT chuẩn — chặn mọi
// thao tác thêm/xóa/sắp xếp lại. Chỉ số câu trong mỗi mondai là linh hoạt.
const STRUCTURE_LOCKED = 'Cấu trúc đề cố định theo format JLPT chuẩn, không thể thêm/xóa phần thi hoặc mondai.';

// ─── Đề thi (mock_exams) ──────────────────────────────────────────────────────

// GET /api/admin/mock-exams
exports.listExams = async (req, res) => {
  const { level, is_published, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = jlptDb.from('mock_exams')
      .select('id, level, title, description, is_published, is_free, created_at, published_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level)                      query = query.eq('level', level);
    if (is_published !== undefined && is_published !== '') query = query.eq('is_published', is_published === 'true');
    if (search)                     query = query.ilike('title', `%${search}%`);

    const { data: exams, error, count } = await query;
    if (error) throw error;

    // Đếm số câu + số lượt làm cho từng đề trong trang
    const examIds = (exams || []).map(e => e.id);
    const counts = {};
    examIds.forEach(id => { counts[id] = { questions: 0, attempts: 0 }; });
    if (examIds.length) {
      const { data: sections } = await jlptDb
        .from('mock_exam_sections').select('id, exam_id').in('exam_id', examIds);
      const sectionToExam = {};
      (sections || []).forEach(s => { sectionToExam[s.id] = s.exam_id; });
      const sectionIds = Object.keys(sectionToExam);
      if (sectionIds.length) {
        const { data: groups } = await jlptDb
          .from('mock_question_groups').select('id, section_id').in('section_id', sectionIds);
        const groupToExam = {};
        (groups || []).forEach(g => { groupToExam[g.id] = sectionToExam[g.section_id]; });
        const groupIds = Object.keys(groupToExam);
        if (groupIds.length) {
          const { data: qs } = await jlptDb
            .from('mock_questions').select('group_id').in('group_id', groupIds);
          (qs || []).forEach(q => { counts[groupToExam[q.group_id]].questions += 1; });
        }
      }
      const { data: attempts } = await jlptDb
        .from('mock_attempts').select('exam_id').in('exam_id', examIds);
      (attempts || []).forEach(a => { counts[a.exam_id].attempts += 1; });
    }

    res.json({
      data: (exams || []).map(e => ({ ...e, question_count: counts[e.id].questions, attempt_count: counts[e.id].attempts })),
      total: count, page: Number(page), limit: Number(limit),
    });
  } catch (err) { handleError(res, err, 'Không thể tải danh sách đề thi.'); }
};

// Tạo đề mới + khung blueprint chuẩn (sections + groups, chưa có câu hỏi).
// Trả về { exam, groupIdBy: { "vị_trí_phần.số_mondai": group_id } } — import nguyên đề cần map này.
async function createExamSkeleton({ level, title, description, userId }) {
  const { data: exam, error } = await jlptDb.from('mock_exams')
    .insert({ level, title: title.trim(), description: description || null, created_by: userId })
    .select().single();
  if (error) throw error;

  const bp = BLUEPRINTS[level];
  const groupIdBy = {};
  for (let si = 0; si < bp.sections.length; si++) {
    const s = bp.sections[si];
    const { data: section, error: sErr } = await jlptDb.from('mock_exam_sections')
      .insert({ exam_id: exam.id, position: si + 1, section_type: s.section_type, title: s.title, time_limit_minutes: s.time_limit_minutes })
      .select('id').single();
    if (sErr) throw sErr;
    // Câu chỉ dẫn (instruction) KHÔNG lưu DB — là hằng số chuẩn JLPT, FE render từ mockExamConstants.
    const groupRows = s.groups.map((g, gi) => ({
      section_id:       section.id,
      position:         gi + 1,
      mondai_number:    gi + 1,
      mondai_type:      g.mondai_type,
      score_category:   g.score_category,
    }));
    const { data: created, error: gErr } = await jlptDb.from('mock_question_groups').insert(groupRows).select('id, position');
    if (gErr) throw gErr;
    (created || []).forEach(g => { groupIdBy[`${si + 1}.${g.position}`] = g.id; });
  }
  return { exam, groupIdBy };
}

// POST /api/admin/mock-exams
// Đề luôn tạo từ blueprint chuẩn JLPT — cấu trúc phần thi/mondai cố định.
exports.createExam = async (req, res) => {
  const { level, title, description } = req.body;
  if (!level || !BLUEPRINTS[level]) return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  if (!title?.trim())               return res.status(400).json({ error: 'Tên đề thi là bắt buộc.' });
  try {
    const { exam } = await createExamSkeleton({ level, title, description, userId: req.user?.id });
    res.status(201).json(exam);
  } catch (err) { handleError(res, err, 'Không thể tạo đề thi.'); }
};

// GET /api/admin/mock-exams/:id — full tree kèm đáp án (admin được xem)
exports.getExam = async (req, res) => {
  try {
    const { data: exam, error } = await jlptDb
      .from('mock_exams').select('*').eq('id', req.params.id).single();
    if (error || !exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

    const { data: sections, error: sErr } = await jlptDb
      .from('mock_exam_sections').select('*').eq('exam_id', exam.id).order('position');
    if (sErr) throw sErr;

    const sectionIds = (sections || []).map(s => s.id);
    let groups = [], questions = [];
    if (sectionIds.length) {
      const { data: g, error: gErr } = await jlptDb
        .from('mock_question_groups').select('*').in('section_id', sectionIds).order('position');
      if (gErr) throw gErr;
      groups = g || [];
      const groupIds = groups.map(x => x.id);
      if (groupIds.length) {
        const { data: q, error: qErr } = await jlptDb
          .from('mock_questions').select('*').in('group_id', groupIds).order('position');
        if (qErr) throw qErr;
        questions = q || [];
      }
    }

    const tree = {
      ...exam,
      sections: (sections || []).map(s => ({
        ...s,
        groups: groups.filter(g => g.section_id === s.id).map(g => ({
          ...g,
          questions: questions.filter(q => q.group_id === g.id),
        })),
      })),
    };
    res.json(tree);
  } catch (err) { handleError(res, err, 'Không thể tải đề thi.'); }
};

// PUT /api/admin/mock-exams/:id — sửa meta (title/description/level)
exports.updateExam = async (req, res) => {
  const allowed = ['title', 'description', 'level', 'is_free'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });
  if ('is_free' in updates) updates.is_free = !!updates.is_free;
  if (updates.level && !BLUEPRINTS[updates.level]) return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  try {
    const { data: exam } = await jlptDb.from('mock_exams').select('id, is_published, level').eq('id', req.params.id).single();
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
    if (exam.is_published && (updates.level && updates.level !== exam.level))
      return res.status(400).json({ error: 'Không thể đổi cấp độ của đề đã xuất bản.' });

    const { data, error } = await jlptDb.from('mock_exams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật đề thi.'); }
};

// PATCH /api/admin/mock-exams/:id/publish — body { publish: boolean }
exports.publishExam = async (req, res) => {
  const publish = !!req.body.publish;
  try {
    const { data: exam } = await jlptDb.from('mock_exams').select('id, level, is_published').eq('id', req.params.id).single();
    if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

    if (!publish) {
      const { count } = await jlptDb.from('mock_attempts')
        .select('id', { count: 'exact', head: true }).eq('exam_id', exam.id);
      const { data, error } = await jlptDb.from('mock_exams')
        .update({ is_published: false, updated_at: new Date().toISOString() })
        .eq('id', exam.id).select().single();
      if (error) throw error;
      return res.json({
        ...data,
        warning: count > 0 ? `Đề đã có ${count} lượt làm — nếu sửa nội dung, kết quả/review cũ có thể lệch với đề mới.` : undefined,
      });
    }

    // ── Validate trước khi publish ──
    const errors = [];
    const { data: sections } = await jlptDb
      .from('mock_exam_sections').select('id, title, position').eq('exam_id', exam.id).order('position');
    if (!sections?.length) errors.push('Đề chưa có phần thi nào.');

    const sectionIds = (sections || []).map(s => s.id);
    let groups = [], questions = [];
    if (sectionIds.length) {
      ({ data: groups } = await jlptDb.from('mock_question_groups')
        .select('id, section_id, mondai_number, mondai_type, score_category').in('section_id', sectionIds));
      groups = groups || [];
      const groupIds = groups.map(g => g.id);
      if (groupIds.length) {
        ({ data: questions } = await jlptDb.from('mock_questions')
          .select('id, group_id, question_text, image_url, audio_url, options, correct_index').in('group_id', groupIds));
        questions = questions || [];
      }
    }

    const sectionLabel = {};
    (sections || []).forEach(s => { sectionLabel[s.id] = s.title || `Phần ${s.position}`; });

    for (const s of sections || []) {
      if (!groups.some(g => g.section_id === s.id))
        errors.push(`Phần "${sectionLabel[s.id]}" chưa có mondai nào.`);
    }
    for (const g of groups) {
      const label = `${sectionLabel[g.section_id]} › 問題${g.mondai_number} (${MONDAI_TYPES[g.mondai_type]?.ja || g.mondai_type})`;
      const gQuestions = questions.filter(q => q.group_id === g.id);
      if (!gQuestions.length) { errors.push(`${label}: chưa có câu hỏi.`); continue; }
      gQuestions.forEach((q, i) => {
        const msg = validateQuestionPayload(q);
        if (msg) errors.push(`${label} câu ${i + 1}: ${msg}`);
        if (g.score_category === 'listening' && !q.audio_url)
          errors.push(`${label} câu ${i + 1}: câu nghe phải có audio riêng.`);
        if (g.score_category !== 'listening' && !q.question_text?.trim())
          errors.push(`${label} câu ${i + 1}: thiếu nội dung câu hỏi.`);
      });
    }

    // Mỗi cột chấm điểm của cấp độ phải có ít nhất 1 câu
    const columns = SCORE_COLUMNS[exam.level] || [];
    const catToCol = {};
    columns.forEach(col => col.cats.forEach(cat => { catToCol[cat] = col.key; }));
    const covered = new Set();
    for (const g of groups) {
      if (questions.some(q => q.group_id === g.id) && catToCol[g.score_category])
        covered.add(catToCol[g.score_category]);
    }
    for (const col of columns) {
      if (!covered.has(col.key))
        errors.push(`Cột điểm "${col.key}" chưa có câu hỏi nào — đề ${exam.level} cần đủ các cột: ${columns.map(c => c.key).join(', ')}.`);
    }

    if (errors.length) return res.status(400).json({ error: 'Đề chưa đủ điều kiện xuất bản.', details: errors });

    // ── Cảnh báo (không chặn): số câu mỗi mondai lệch so với chuẩn blueprint ──
    // Điểm tính theo tỷ lệ đúng nên lệch số câu không phá thang điểm — chỉ nhắc admin.
    const warnings = [];
    const bp = BLUEPRINTS[exam.level];
    const sectionPos = {};
    (sections || []).forEach(s => { sectionPos[s.id] = s.position; });
    // Map "vị trí phần : mondai_type" → số câu chuẩn
    const stdCount = {};
    (bp?.sections || []).forEach((s, si) => {
      s.groups.forEach(bg => { stdCount[`${si + 1}:${bg.mondai_type}`] = bg.question_count; });
    });
    for (const gr of groups) {
      const std = stdCount[`${sectionPos[gr.section_id]}:${gr.mondai_type}`];
      const actual = questions.filter(q => q.group_id === gr.id).length;
      if (std != null && actual !== std)
        warnings.push(`${sectionLabel[gr.section_id]} › 問題${gr.mondai_number} (${MONDAI_TYPES[gr.mondai_type]?.ja || gr.mondai_type}): ${actual} câu — chuẩn JLPT là ${std} câu.`);
      // 発話表現: đề thật mỗi câu có 1 tranh — thiếu ảnh chỉ nhắc, không chặn
      if (gr.mondai_type === 'utterance_expression') {
        questions.filter(q => q.group_id === gr.id).forEach((q, i) => {
          if (!q.image_url)
            warnings.push(`${sectionLabel[gr.section_id]} › 問題${gr.mondai_number} (発話表現) câu ${i + 1}: chưa có ảnh minh họa (đề thật mỗi câu 1 tranh).`);
        });
      }
    }

    const { data, error } = await jlptDb.from('mock_exams')
      .update({ is_published: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', exam.id).select().single();
    if (error) throw error;
    res.json({ ...data, warnings: warnings.length ? warnings : undefined });
  } catch (err) { handleError(res, err, 'Không thể xuất bản đề thi.'); }
};

// DELETE /api/admin/mock-exams/:id
exports.deleteExam = async (req, res) => {
  try {
    const { count } = await jlptDb.from('mock_attempts')
      .select('id', { count: 'exact', head: true }).eq('exam_id', req.params.id);
    if (count > 0)
      return res.status(409).json({ error: `Đề đã có ${count} lượt làm, không thể xóa. Hãy gỡ xuất bản để ẩn đề.` });
    const { error } = await jlptDb.from('mock_exams').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa đề thi.' });
  } catch (err) { handleError(res, err, 'Không thể xóa đề thi.'); }
};

// GET /api/admin/mock-exams/:id/attempts — thống kê lượt làm cho admin
exports.listExamAttempts = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { data, error, count } = await jlptDb.from('mock_attempts')
      .select('id, user_id, attempt_number, status, scores, total_score, passed, duration_seconds, started_at, submitted_at', { count: 'exact' })
      .eq('exam_id', req.params.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (error) throw error;

    const userIds = [...new Set((data || []).map(a => a.user_id))];
    let userMap = {};
    if (userIds.length) {
      const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email').in('id', userIds);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }
    res.json({
      data: (data || []).map(a => ({ ...a, user: userMap[a.user_id] || null })),
      total: count, page: Number(page), limit: Number(limit),
    });
  } catch (err) { handleError(res, err, 'Không thể tải danh sách lượt làm.'); }
};

// ─── Phần thi (mock_exam_sections) ────────────────────────────────────────────

// POST /api/admin/mock-exams/:examId/sections — CHẶN: cấu trúc cố định theo blueprint
exports.createSection = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PUT /api/admin/mock-sections/:id
exports.updateSection = async (req, res) => {
  const allowed = ['title', 'time_limit_minutes'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const examId = await examIdOfSection(req.params.id);
    await assertEditableExam(examId);
    const { data, error } = await jlptDb.from('mock_exam_sections')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật phần thi.'); }
};

// DELETE /api/admin/mock-sections/:id — CHẶN: cấu trúc cố định theo blueprint
exports.deleteSection = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PATCH /api/admin/mock-sections/reorder — CHẶN: cấu trúc cố định theo blueprint
exports.reorderSections = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// ─── Mondai (mock_question_groups) ────────────────────────────────────────────

// POST /api/admin/mock-sections/:sectionId/groups — CHẶN: cấu trúc cố định theo blueprint
exports.createGroup = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PUT /api/admin/mock-groups/:id
// Cấu trúc mondai cố định (mondai_number/type/score_category theo blueprint) — chỉ sửa passage/ảnh.
// Audio/transcript phần nghe nằm ở TỪNG CÂU (mock_questions), không còn ở cấp mondai.
exports.updateGroup = async (req, res) => {
  try {
    const { group, examId } = await groupWithExamId(req.params.id);
    await assertEditableExam(examId);
    const allowed = ['passage_text', 'image_url'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length)
      return res.status(400).json({ error: 'Không có trường nào để cập nhật.' });

    const { data, error } = await jlptDb.from('mock_question_groups')
      .update(updates).eq('id', group.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật mondai.'); }
};

// DELETE /api/admin/mock-groups/:id — CHẶN: cấu trúc cố định theo blueprint
exports.deleteGroup = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// PATCH /api/admin/mock-groups/reorder — CHẶN: cấu trúc cố định theo blueprint
exports.reorderGroups = (_req, res) => res.status(400).json({ error: STRUCTURE_LOCKED });

// ─── Câu hỏi (mock_questions) ─────────────────────────────────────────────────

// POST /api/admin/mock-groups/:groupId/questions — bulk (dùng cho cả tạo tay lẫn lưu nháp AI)
exports.createQuestions = async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'Danh sách câu hỏi không được rỗng.' });
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    await assertEditableExam(examId);
    for (let i = 0; i < questions.length; i++) {
      const msg = validateQuestionPayload(questions[i]);
      if (msg) return res.status(400).json({ error: `Câu ${i + 1}: ${msg}` });
    }
    const { data: last } = await jlptDb.from('mock_questions')
      .select('position').eq('group_id', group.id).order('position', { ascending: false }).limit(1);
    const base = last?.[0]?.position || 0;
    const rows = questions.map((q, i) => ({
      group_id:      group.id,
      position:      base + i + 1,
      question_text: q.question_text?.trim() || null,
      image_url:     q.image_url || null,
      audio_url:     q.audio_url || null,
      options:       q.options.map(o => String(o).trim()),
      correct_index: Number(q.correct_index),
      explanation:   q.explanation || null,
      translation_vi: q.translation_vi || null,
      audio_transcript:    q.audio_transcript?.trim() || null,
      option_translations: q.option_translations || null,
    }));
    const { data, error } = await jlptDb.from('mock_questions').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { handleError(res, err, 'Không thể tạo câu hỏi.'); }
};

// PUT /api/admin/mock-questions/:id
exports.updateQuestion = async (req, res) => {
  try {
    const { data: q } = await jlptDb.from('mock_questions').select('*').eq('id', req.params.id).single();
    if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
    const { examId } = await groupWithExamId(q.group_id);
    const { data: exam } = await jlptDb.from('mock_exams').select('id, is_published').eq('id', examId).single();
    // Đề đã publish: chỉ cho sửa giải thích/bản dịch/transcript (không đổi nội dung/đáp án)
    const allowed = exam?.is_published
      ? ['explanation', 'translation_vi', 'option_translations', 'audio_transcript']
      : ['question_text', 'image_url', 'audio_url', 'options', 'correct_index', 'explanation', 'translation_vi', 'option_translations', 'audio_transcript'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length)
      return res.status(400).json({ error: exam?.is_published ? 'Đề đã xuất bản: chỉ được sửa giải thích, bản dịch và transcript.' : 'Không có trường nào để cập nhật.' });

    const merged = { ...q, ...updates };
    const msg = validateQuestionPayload(merged);
    if (msg) return res.status(400).json({ error: msg });

    const { data, error } = await jlptDb.from('mock_questions')
      .update(updates).eq('id', q.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể cập nhật câu hỏi.'); }
};

// DELETE /api/admin/mock-questions/:id
exports.deleteQuestion = async (req, res) => {
  try {
    const examId = await examIdOfQuestion(req.params.id);
    await assertEditableExam(examId);
    const { error } = await jlptDb.from('mock_questions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa câu hỏi.' });
  } catch (err) { handleError(res, err, 'Không thể xóa câu hỏi.'); }
};

// PATCH /api/admin/mock-questions/reorder — body { ids: [...] }
exports.reorderQuestions = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Danh sách ids không hợp lệ.' });
  try {
    const examId = await examIdOfQuestion(ids[0]);
    await assertEditableExam(examId);
    for (let i = 0; i < ids.length; i++) {
      const { error } = await jlptDb.from('mock_questions').update({ position: i + 1 }).eq('id', ids[i]);
      if (error) throw error;
    }
    res.json({ message: 'Đã sắp xếp lại.' });
  } catch (err) { handleError(res, err, 'Không thể sắp xếp câu hỏi.'); }
};

// ─── Import từ ngân hàng đề JLPT riêng (copy snapshot, không reference) ───────

// Copy snapshot 1 câu bank → row mock_questions. bank_question_id chỉ là dấu vết
// (không FK) để tính năng random ưu tiên câu chưa dùng — sửa/xóa bank không ảnh hưởng đề.
function bankQuestionToRow(bq) {
  return {
    question_text:       bq.question_text,
    image_url:           bq.image_url,
    audio_url:           bq.audio_url,
    audio_transcript:    bq.audio_transcript,
    options:             bq.options,
    correct_index:       bq.correct_index,
    explanation:         bq.explanation,
    translation_vi:      bq.translation_vi,
    option_translations: bq.option_translations,
    bank_question_id:    bq.id,
  };
}

// POST /api/admin/mock-groups/:groupId/import-from-bank — body { question_ids: [...] }
// Nguồn: jlpt_module.jlpt_bank_questions — copy đủ field (dịch/transcript/media).
// Sửa bank sau này KHÔNG ảnh hưởng câu đã import vào đề (snapshot).
exports.importFromBank = async (req, res) => {
  const { question_ids } = req.body;
  if (!Array.isArray(question_ids) || !question_ids.length)
    return res.status(400).json({ error: 'Chọn ít nhất 1 câu hỏi để import.' });
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    const exam = await assertEditableExam(examId);

    const { data: bankQs, error } = await jlptDb.from('jlpt_bank_questions')
      .select('id, level, mondai_type, question_text, image_url, audio_url, audio_transcript, options, correct_index, explanation, translation_vi, option_translations')
      .in('id', question_ids);
    if (error) throw error;

    const skipped = [];
    const rows = [];
    for (const bq of bankQs || []) {
      if (bq.level !== exam.level) {
        skipped.push({ id: bq.id, reason: `Câu cấp ${bq.level} không khớp đề ${exam.level}.` });
        continue;
      }
      if (bq.mondai_type !== group.mondai_type) {
        skipped.push({ id: bq.id, reason: 'Dạng mondai không khớp với mondai đang soạn.' });
        continue;
      }
      const msg = validateQuestionPayload(bq);
      if (msg) { skipped.push({ id: bq.id, reason: msg }); continue; }
      rows.push(bankQuestionToRow(bq));
    }
    (question_ids.filter(id => !(bankQs || []).some(b => b.id === id)))
      .forEach(id => skipped.push({ id, reason: 'Không tìm thấy trong ngân hàng.' }));

    let saved = [];
    if (rows.length) {
      const { data: last } = await jlptDb.from('mock_questions')
        .select('position').eq('group_id', group.id).order('position', { ascending: false }).limit(1);
      const base = last?.[0]?.position || 0;
      const { data, error: insErr } = await jlptDb.from('mock_questions')
        .insert(rows.map((r, i) => ({ ...r, group_id: group.id, position: base + i + 1 }))).select();
      if (insErr) throw insErr;
      saved = data;
    }
    res.json({ saved: saved.length, skipped, data: saved });
  } catch (err) { handleError(res, err, 'Không thể import câu hỏi.'); }
};

// Xáo trộn Fisher–Yates (không mutate mảng gốc)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// POST /api/admin/mock-exams/:id/fill-from-bank
// Rút NGẪU NHIÊN câu từ ngân hàng JLPT lấp các mondai còn thiếu câu so với blueprint.
// Không đè câu đã có. Ưu tiên câu/nhóm bank CHƯA từng dùng ở đề nào (dấu vết
// bank_question_id/bank_group_id); pool cạn mới lấy lại câu đã dùng (báo reused).
exports.fillFromBank = async (req, res) => {
  try {
    const exam = await assertEditableExam(req.params.id);
    const bp = BLUEPRINTS[exam.level];
    const { isPassageType } = require('../utils/jlptBankImport');

    const { data: sections, error: sErr } = await jlptDb.from('mock_exam_sections')
      .select('id, position').eq('exam_id', exam.id).order('position');
    if (sErr) throw sErr;
    const sectionIds = (sections || []).map(s => s.id);
    let groups = [];
    if (sectionIds.length) {
      const { data: g, error: gErr } = await jlptDb.from('mock_question_groups')
        .select('id, section_id, position, mondai_number, mondai_type, score_category, bank_group_id')
        .in('section_id', sectionIds).order('position');
      if (gErr) throw gErr;
      groups = g || [];
    }
    const groupIds = groups.map(g => g.id);
    const countByGroup = {};
    const maxPosByGroup = {};
    // Bank ids đã có trong CHÍNH đề này — tuyệt đối không rút lại (tránh trùng câu trong 1 đề)
    const inThisExamQ = new Set();
    const inThisExamG = new Set();
    groupIds.forEach(id => { countByGroup[id] = 0; maxPosByGroup[id] = 0; });
    if (groupIds.length) {
      const { data: qs, error: qErr } = await jlptDb.from('mock_questions')
        .select('group_id, position, bank_question_id').in('group_id', groupIds);
      if (qErr) throw qErr;
      (qs || []).forEach(q => {
        countByGroup[q.group_id] += 1;
        maxPosByGroup[q.group_id] = Math.max(maxPosByGroup[q.group_id], q.position || 0);
        if (q.bank_question_id) inThisExamQ.add(q.bank_question_id);
      });
    }
    groups.forEach(g => { if (g.bank_group_id) inThisExamG.add(g.bank_group_id); });

    // Số câu chuẩn theo "vị trí phần : dạng mondai" (giống publishExam)
    const sectionPos = {};
    (sections || []).forEach(s => { sectionPos[s.id] = s.position; });
    const stdCount = {};
    (bp?.sections || []).forEach((s, si) => {
      s.groups.forEach(bg => { stdCount[`${si + 1}:${bg.mondai_type}`] = bg.question_count; });
    });

    // Dấu vết bank đã dùng ở MỌI đề — để ưu tiên phần tử chưa dùng (chống trùng giữa các đề)
    const { data: usedQ, error: uqErr } = await jlptDb.from('mock_questions')
      .select('bank_question_id').not('bank_question_id', 'is', null);
    if (uqErr) throw uqErr;
    const { data: usedG, error: ugErr } = await jlptDb.from('mock_question_groups')
      .select('bank_group_id').not('bank_group_id', 'is', null);
    if (ugErr) throw ugErr;
    const usedQuestionIds = new Set((usedQ || []).map(r => r.bank_question_id));
    const usedGroupIds    = new Set((usedG || []).map(r => r.bank_group_id));

    const report = [];
    for (const group of groups) {
      const std = stdCount[`${sectionPos[group.section_id]}:${group.mondai_type}`];
      const have = countByGroup[group.id] || 0;
      const needed = Math.max((std || 0) - have, 0);
      if (!needed) continue;
      const entry = {
        section_position: sectionPos[group.section_id],
        mondai_number:    group.mondai_number,
        mondai_type:      group.mondai_type,
        needed, filled: 0, reused: 0, shortage: 0, needs_audio: 0,
      };
      report.push(entry);

      if (isPassageType(group.mondai_type)) {
        // Nhóm passage: chỉ fill khi mondai còn TRỐNG hẳn — không trộn passage bank với câu sẵn có
        if (have > 0) {
          entry.shortage = needed;
          entry.note = 'Mondai đã có câu — không trộn thêm đoạn văn từ ngân hàng, cần bổ sung tay.';
          continue;
        }
        const { data: bankGroups, error: bgErr } = await jlptDb.from('jlpt_bank_groups')
          .select('*, jlpt_bank_questions(*)')
          .eq('level', exam.level).eq('mondai_type', group.mondai_type);
        if (bgErr) throw bgErr;
        const candidates = (bankGroups || []).filter(bg =>
          !inThisExamG.has(bg.id)
          && bg.passage_text?.trim() && (bg.jlpt_bank_questions || []).some(q => !validateQuestionPayload(q)));
        if (!candidates.length) { entry.shortage = needed; continue; }
        const fresh = candidates.filter(bg => !usedGroupIds.has(bg.id));
        const pick = shuffle(fresh.length ? fresh : candidates)[0];
        const children = (pick.jlpt_bank_questions || [])
          .filter(q => !validateQuestionPayload(q))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const { error: gUpErr } = await jlptDb.from('mock_question_groups')
          .update({ passage_text: pick.passage_text, image_url: pick.image_url || null, bank_group_id: pick.id })
          .eq('id', group.id);
        if (gUpErr) throw gUpErr;
        const rows = children.map((bq, i) => ({ ...bankQuestionToRow(bq), group_id: group.id, position: i + 1 }));
        const { error: insErr } = await jlptDb.from('mock_questions').insert(rows);
        if (insErr) throw insErr;

        usedGroupIds.add(pick.id); inThisExamG.add(pick.id);
        children.forEach(c => { usedQuestionIds.add(c.id); inThisExamQ.add(c.id); });
        entry.filled = rows.length;
        if (!fresh.length) entry.reused = rows.length;
        if (rows.length < needed) entry.shortage = needed - rows.length;
      } else {
        // Câu đơn (từ vựng/ngữ pháp) + nghe: rút từng câu độc lập
        const { data: pool, error: pErr } = await jlptDb.from('jlpt_bank_questions')
          .select('*').eq('level', exam.level).eq('mondai_type', group.mondai_type).is('group_id', null);
        if (pErr) throw pErr;
        const validPool = (pool || []).filter(q => !inThisExamQ.has(q.id) && !validateQuestionPayload(q));
        const fresh = shuffle(validPool.filter(q => !usedQuestionIds.has(q.id)));
        const used  = shuffle(validPool.filter(q => usedQuestionIds.has(q.id)));
        const picks = fresh.slice(0, needed);
        if (picks.length < needed) {
          const extra = used.slice(0, needed - picks.length);
          entry.reused = extra.length;
          picks.push(...extra);
        }
        if (!picks.length) { entry.shortage = needed; continue; }

        const base = maxPosByGroup[group.id] || 0;
        const rows = picks.map((bq, i) => ({ ...bankQuestionToRow(bq), group_id: group.id, position: base + i + 1 }));
        const { error: insErr } = await jlptDb.from('mock_questions').insert(rows);
        if (insErr) throw insErr;

        picks.forEach(p => { usedQuestionIds.add(p.id); inThisExamQ.add(p.id); });
        entry.filled = rows.length;
        entry.shortage = needed - rows.length;
        if (group.score_category === 'listening')
          entry.needs_audio = picks.filter(p => !p.audio_url).length;
      }
    }

    const totals = report.reduce((t, e) => ({
      filled:      t.filled + e.filled,
      reused:      t.reused + e.reused,
      shortage:    t.shortage + e.shortage,
      needs_audio: t.needs_audio + e.needs_audio,
    }), { filled: 0, reused: 0, shortage: 0, needs_audio: 0 });
    res.json({ report, ...totals });
  } catch (err) { handleError(res, err, 'Không thể lấp đầy đề từ ngân hàng.'); }
};

// ─── Import Excel tạo NGUYÊN ĐỀ (→ đề nháp) ──────────────────────────────────

// GET /api/admin/mock-exams/import-template?level= — file .xlsx mẫu (mỗi mondai 1 sheet)
exports.examImportTemplate = (req, res) => {
  try {
    const { buildExamImportTemplate } = require('../utils/jlptExamImport');
    const buffer = buildExamImportTemplate(req.query.level);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="jlpt-mock-exam-${req.query.level}.xlsx"`);
    res.send(buffer);
  } catch (err) { handleError(res, err, 'Không thể tạo file mẫu.'); }
};

// POST /api/admin/mock-exams/import-file — multipart { file, level } → preview, KHÔNG ghi DB
exports.examImportFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file để nhập.' });
    const { parseExamImport } = require('../utils/jlptExamImport');
    const result = parseExamImport({
      buffer:   req.file.buffer,
      filename: req.file.originalname || '',
      level:    req.body.level,
    });
    res.json(result);
  } catch (err) { handleError(res, err, 'Không thể đọc file nhập.'); }
};

// Validate 1 câu import nguyên đề theo dạng mondai (server-side, không tin preview từ client)
function validateExamImportQuestion(meta, q) {
  if (!q || typeof q !== 'object') return 'Câu hỏi không hợp lệ.';
  if (!q.question_text?.trim() && !meta.no_question_text) return 'Thiếu nội dung câu hỏi.';
  if (meta.category === 'listening' && !q.audio_transcript?.trim()) return 'Thiếu script bài nghe (audio_transcript).';
  return validateQuestionPayload(q);
}

// POST /api/admin/mock-exams/import-commit — body { level, title, description?, mondais: [...] }
// Tạo đề NHÁP mới từ blueprint rồi đổ câu vào từng mondai. Lỗi giữa chừng → xóa đề (không để rác).
exports.examImportCommit = async (req, res) => {
  const { level, title, description, mondais } = req.body;
  if (!level || !BLUEPRINTS[level]) return res.status(400).json({ error: 'Cấp độ JLPT không hợp lệ.' });
  if (!title?.trim())               return res.status(400).json({ error: 'Tên đề thi là bắt buộc.' });
  if (!Array.isArray(mondais) || !mondais.length)
    return res.status(400).json({ error: 'Không có mondai nào để nhập.' });

  // Validate toàn bộ TRƯỚC khi tạo đề
  const bp = BLUEPRINTS[level];
  const typeBySlot = {};
  bp.sections.forEach((s, si) => s.groups.forEach((g, gi) => { typeBySlot[`${si + 1}.${gi + 1}`] = g.mondai_type; }));
  const usable = [];
  for (const e of mondais) {
    const key = `${e.section_position}.${e.mondai_number}`;
    const expectedType = typeBySlot[key];
    if (!expectedType || e.mondai_type !== expectedType)
      return res.status(400).json({ error: `Mondai ${key} không khớp khung đề ${level}.` });
    const questions = Array.isArray(e.questions) ? e.questions : [];
    const meta = MONDAI_TYPES[e.mondai_type];
    for (let i = 0; i < questions.length; i++) {
      const msg = validateExamImportQuestion(meta, questions[i]);
      if (msg) return res.status(400).json({ error: `Mondai ${key}, câu ${i + 1}: ${msg}` });
    }
    if (questions.length || e.passage_text?.trim()) usable.push({ ...e, key, questions });
  }
  if (!usable.some(e => e.questions.length))
    return res.status(400).json({ error: 'Không có câu hỏi hợp lệ nào để nhập.' });

  let exam = null;
  try {
    const skeleton = await createExamSkeleton({ level, title, description, userId: req.user?.id });
    exam = skeleton.exam;
    let saved = 0;
    for (const e of usable) {
      const groupId = skeleton.groupIdBy[e.key];
      if (!groupId) continue;
      if (e.passage_text?.trim()) {
        const { error: pErr } = await jlptDb.from('mock_question_groups')
          .update({ passage_text: e.passage_text.trim() }).eq('id', groupId);
        if (pErr) throw pErr;
      }
      if (!e.questions.length) continue;
      const rows = e.questions.map((q, i) => ({
        group_id:            groupId,
        position:            i + 1,
        question_text:       q.question_text?.trim() || null,
        image_url:           null,
        audio_url:           null,
        options:             q.options.map(o => String(o).trim()),
        correct_index:       Number(q.correct_index),
        explanation:         q.explanation || null,
        translation_vi:      q.translation_vi || null,
        audio_transcript:    q.audio_transcript?.trim() || null,
        option_translations: q.option_translations || null,
      }));
      const { error: insErr } = await jlptDb.from('mock_questions').insert(rows);
      if (insErr) throw insErr;
      saved += rows.length;
    }
    res.status(201).json({ exam_id: exam.id, saved });
  } catch (err) {
    // Rollback thủ công: xóa đề vừa tạo (cascade sections/groups/questions)
    if (exam?.id) await jlptDb.from('mock_exams').delete().eq('id', exam.id);
    handleError(res, err, 'Không thể tạo đề từ file.');
  }
};

// ─── AI sinh nháp câu hỏi theo mondai ─────────────────────────────────────────

// Gom toàn bộ câu đã có của CẢ ĐỀ thành mảng chuỗi mô tả (câu hỏi → đáp án đúng)
// để đưa vào prompt chống trùng lặp.
async function existingQuestionSummaries(examId) {
  const { data: sections, error } = await jlptDb.from('mock_exam_sections')
    .select('id, mock_question_groups(id, mock_questions(question_text, options, correct_index, audio_transcript))')
    .eq('exam_id', examId);
  if (error) throw error;
  const lines = [];
  for (const s of sections || []) {
    for (const g of s.mock_question_groups || []) {
      for (const q of g.mock_questions || []) {
        const answer = Array.isArray(q.options) ? q.options[q.correct_index] : '';
        const text = q.question_text || (q.audio_transcript ? String(q.audio_transcript).slice(0, 80) : '');
        if (text || answer) lines.push(`${text}${answer ? ` → ${answer}` : ''}`);
      }
    }
  }
  return lines;
}

// POST /api/admin/mock-groups/:groupId/ai-generate — body { count, topic, instruction } → trả NHÁP, không ghi DB
exports.aiGenerateDrafts = async (req, res) => {
  const count = Math.min(Math.max(Number(req.body.count) || 5, 1), 15);
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    const { data: exam } = await jlptDb.from('mock_exams').select('id, level').eq('id', examId).single();
    const { generateMondaiQuestions } = require('../utils/jlptQuestionGen');
    const result = await generateMondaiQuestions({
      level:             exam.level,
      mondaiType:        group.mondai_type,
      count,
      passageText:       group.passage_text || '',
      topic:             req.body.topic || '',
      instruction:       req.body.instruction || '',
      existingQuestions: await existingQuestionSummaries(examId),
    });
    res.json(result);
  } catch (err) { handleError(res, err, 'Không thể sinh câu hỏi bằng AI.'); }
};

// POST /api/admin/mock-groups/:groupId/ai-regenerate-one
// body { instruction, current_question, sibling_questions } → trả 1 câu NHÁP mới, không ghi DB
exports.aiRegenerateOne = async (req, res) => {
  try {
    const { group, examId } = await groupWithExamId(req.params.groupId);
    const { data: exam } = await jlptDb.from('mock_exams').select('id, level').eq('id', examId).single();
    const siblings = Array.isArray(req.body.sibling_questions)
      ? req.body.sibling_questions.map(s => String(s).slice(0, 200)).slice(0, 50)
      : [];
    const { regenerateOneQuestion } = require('../utils/jlptQuestionGen');
    const result = await regenerateOneQuestion({
      level:            exam.level,
      mondaiType:       group.mondai_type,
      instruction:      req.body.instruction || '',
      currentQuestion:  req.body.current_question || {},
      siblingQuestions: siblings,
      passageText:      group.passage_text || '',
    });
    res.json(result);
  } catch (err) { handleError(res, err, 'Không thể sinh lại câu hỏi bằng AI.'); }
};

// ─── Upload media ─────────────────────────────────────────────────────────────

async function uploadBuffer(bucket, buffer, contentType, ext) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filename, buffer, { contentType, upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename);
  return publicUrl;
}

async function uploadToBucket(req, res, bucket, fallbackExt, errMsg) {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || fallbackExt).toLowerCase();
  try {
    const url = await uploadBuffer(bucket, req.file.buffer, req.file.mimetype, ext);
    res.json({ url });
  } catch (err) { console.error(err); res.status(500).json({ error: errMsg }); }
}

// POST /api/admin/mock-exams/upload-audio
exports.uploadAudio = (req, res) => uploadToBucket(req, res, 'mock-exam-audio', 'mp3', 'Không thể tải file âm thanh lên.');

// POST /api/admin/mock-exams/upload-image
exports.uploadImage = (req, res) => uploadToBucket(req, res, 'passage-images', 'jpg', 'Không thể tải ảnh lên.');

// ─── TTS: sinh audio phần nghe từ transcript ──────────────────────────────────

// POST /api/admin/mock-questions/:id/tts — đọc audio_transcript của câu → mp3 → gán audio_url
exports.generateQuestionAudio = async (req, res) => {
  try {
    const { data: q } = await jlptDb.from('mock_questions')
      .select('id, group_id, audio_transcript').eq('id', req.params.id).single();
    if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
    const { examId } = await groupWithExamId(q.group_id);
    await assertEditableExam(examId);

    const { synthesizeTranscript } = require('../utils/ttsJa');
    let buffer;
    try {
      buffer = await synthesizeTranscript(q.audio_transcript);
    } catch (err) {
      // Transcript rỗng/quá dài đã kèm httpStatus 400; còn lại là lỗi dịch vụ TTS
      if (!err.httpStatus) { err.httpStatus = 502; err.message = 'Dịch vụ tạo giọng đọc không phản hồi. Hãy thử lại hoặc tải file thu âm lên.'; }
      throw err;
    }

    const url = await uploadBuffer('mock-exam-audio', buffer, 'audio/mpeg', 'mp3');
    const { data, error } = await jlptDb.from('mock_questions')
      .update({ audio_url: url }).eq('id', q.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { handleError(res, err, 'Không thể tạo audio từ transcript.'); }
};
