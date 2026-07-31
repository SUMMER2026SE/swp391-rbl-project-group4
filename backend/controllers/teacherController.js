'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Bảng quiz đã chuyển sang schema exam_module
const examDb = supabaseAdmin.schema('exam_module');
// Cột giá/phân loại của khóa học nằm ở bảng gốc course_module.courses
const contentDb = supabaseAdmin.schema('course_module');
const langDb = supabaseAdmin.schema('language_module');

// ── My Vocabulary ─────────────────────────────────────────────────────────────
// Giáo viên thêm từ vựng thẳng vào bảng chung vocabulary, lọc theo created_by.
exports.listMyVocab = async (req, res) => {
  const { page = 1, limit = 50, search, level } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let q = supabaseAdmin.from('vocabulary')
      .select('*', { count: 'exact' })
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level)  q = q.eq('level', level);
    if (search) {
      const safe = String(search).replace(/[,()%*]/g, ' ').trim();
      if (safe) q = q.or(`kanji.ilike.%${safe}%,reading.ilike.%${safe}%,meaning_vi.ilike.%${safe}%`);
    }
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tải dữ liệu.' }); }
};

exports.createMyVocab = async (req, res) => {
  const { kanji, reading, meaning_vi, meaning_ja, level, type, example_sentence, han_viet } = req.body;
  if (!reading || !meaning_vi) return res.status(400).json({ error: 'Reading và nghĩa là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary')
      .insert({ kanji, reading, meaning_vi, meaning_ja, level, type, example_sentence, han_viet: han_viet || null, created_by: req.user.id, is_public: true })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể tạo.' }); }
};

exports.updateMyVocab = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('vocabulary').select('created_by').eq('id', req.params.id).single();
    // created_by NULL (từ hệ thống/nhập hàng loạt) — không ai sở hữu riêng nên
    // giáo viên nào cũng sửa được; đã có chủ thì chỉ chủ đó sửa.
    if (!row || (row.created_by && row.created_by !== req.user.id)) return res.status(403).json({ error: 'Không có quyền.' });
    const allowed = ['kanji','reading','meaning_vi','meaning_ja','level','type','example_sentence','han_viet'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin.from('vocabulary').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể cập nhật.' }); }
};

exports.deleteMyVocab = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('vocabulary').select('created_by').eq('id', req.params.id).single();
    if (!row || row.created_by !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    const { error } = await supabaseAdmin.from('vocabulary').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể xóa.' }); }
};

// ── My Kanji ──────────────────────────────────────────────────────────────────
// Giáo viên thêm kanji thẳng vào bảng chung kanji, lọc theo created_by.
exports.listMyKanji = async (req, res) => {
  const { page = 1, limit = 50, search, level } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let q = supabaseAdmin.from('kanji')
      .select('*', { count: 'exact' })
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (level)  q = q.eq('level', level);
    if (search) {
      const safe = String(search).replace(/[,()%*]/g, ' ').trim();
      if (safe) q = q.or(`character.ilike.%${safe}%,meaning_vi.ilike.%${safe}%,han_viet.ilike.%${safe}%`);
    }
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tải dữ liệu.' }); }
};

exports.createMyKanji = async (req, res) => {
  const { character, reading_on, reading_kun, meaning_vi, stroke_count, level } = req.body;
  if (!character || !meaning_vi) return res.status(400).json({ error: 'Kanji và nghĩa là bắt buộc.' });
  const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  try {
    const { data, error } = await supabaseAdmin.from('kanji')
      .insert({ character, reading_on: toArr(reading_on), reading_kun: toArr(reading_kun), meaning_vi, stroke_count: stroke_count ? Number(stroke_count) : null, level, created_by: req.user.id, is_public: true })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể tạo.' }); }
};

exports.updateMyKanji = async (req, res) => {
  const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  try {
    const { data: row } = await supabaseAdmin.from('kanji').select('created_by').eq('id', req.params.id).single();
    // created_by NULL (kanji hệ thống/nhập hàng loạt từ Mazii) — giáo viên nào
    // cũng sửa được; đã có chủ thì chỉ chủ đó sửa.
    if (!row || (row.created_by && row.created_by !== req.user.id)) return res.status(403).json({ error: 'Không có quyền.' });
    const { character, reading_on, reading_kun, meaning_vi, stroke_count, level, han_viet } = req.body;
    const updates = {};
    if (character    !== undefined) updates.character    = character;
    if (meaning_vi   !== undefined) updates.meaning_vi   = meaning_vi;
    if (reading_on   !== undefined) updates.reading_on   = toArr(reading_on);
    if (reading_kun  !== undefined) updates.reading_kun  = toArr(reading_kun);
    if (stroke_count !== undefined) updates.stroke_count = stroke_count ? Number(stroke_count) : null;
    if (level        !== undefined) updates.level        = level;
    if (han_viet      !== undefined) updates.han_viet     = han_viet || null;
    const { data, error } = await supabaseAdmin.from('kanji').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể cập nhật.' }); }
};

exports.deleteMyKanji = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('kanji').select('created_by').eq('id', req.params.id).single();
    if (!row || row.created_by !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    const { error } = await supabaseAdmin.from('kanji').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể xóa.' }); }
};

// Bulk import từ file (JSON/Excel/CSV) vào ngân hàng chung, gắn created_by = giáo viên.
exports.importMyVocab = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Dữ liệu phải là một mảng JSON không rỗng.' });
  if (rows.length > 500)
    return res.status(400).json({ error: 'Tối đa 500 từ mỗi lần nhập.' });

  const ALLOWED = ['kanji','reading','meaning_vi','meaning_ja','level','type','topic','example_sentence'];
  const LEVELS  = new Set(['N5','N4','N3','N2','N1']);
  const errors  = [];
  const cleaned = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.reading)    errors.push(`Dòng ${n}: thiếu trường "reading".`);
    if (!row.meaning_vi) errors.push(`Dòng ${n}: thiếu trường "meaning_vi".`);
    if (row.level && !LEVELS.has(row.level))
      errors.push(`Dòng ${n}: level "${row.level}" không hợp lệ (N5/N4/N3/N2/N1).`);
    const item = { created_by: req.user.id, is_public: true };
    ALLOWED.forEach(k => { if (row[k] !== undefined) item[k] = row[k] || null; });
    cleaned.push(item);
  });

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join('\n• ');
    const suffix  = errors.length > 5 ? `\n... và ${errors.length - 5} lỗi khác.` : '';
    return res.status(400).json({ error: `Có ${errors.length} lỗi:\n• ${preview}${suffix}` });
  }
  try {
    const { error } = await supabaseAdmin.from('vocabulary').insert(cleaned);
    if (error) throw error;
    res.json({ message: `Đã nhập ${cleaned.length} từ vựng vào thư viện.`, count: cleaned.length });
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể nhập dữ liệu.' }); }
};

exports.importMyKanji = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Dữ liệu phải là một mảng JSON không rỗng.' });
  if (rows.length > 500)
    return res.status(400).json({ error: 'Tối đa 500 kanji mỗi lần nhập.' });

  const LEVELS = new Set(['N5','N4','N3','N2','N1']);
  const toArr  = (v) => {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };
  const errors  = [];
  const cleaned = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.character)  errors.push(`Dòng ${n}: thiếu trường "character".`);
    if (!row.meaning_vi) errors.push(`Dòng ${n}: thiếu trường "meaning_vi".`);
    if (row.level && !LEVELS.has(row.level))
      errors.push(`Dòng ${n}: level "${row.level}" không hợp lệ (N5/N4/N3/N2/N1).`);
    cleaned.push({
      character:    row.character,
      reading_on:   toArr(row.reading_on),
      reading_kun:  toArr(row.reading_kun),
      meaning_vi:   row.meaning_vi,
      stroke_count: row.stroke_count ? Number(row.stroke_count) : null,
      level:        row.level || null,
      han_viet:     row.han_viet || null,
      created_by:   req.user.id,
      is_public:    true,
    });
  });

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join('\n• ');
    const suffix  = errors.length > 5 ? `\n... và ${errors.length - 5} lỗi khác.` : '';
    return res.status(400).json({ error: `Có ${errors.length} lỗi:\n• ${preview}${suffix}` });
  }
  try {
    const { error } = await supabaseAdmin.from('kanji').insert(cleaned);
    if (error) throw error;
    res.json({ message: `Đã nhập ${cleaned.length} kanji vào thư viện.`, count: cleaned.length });
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể nhập dữ liệu.' }); }
};

// GET /api/teacher/stats
exports.getStats = async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: courses } = await supabaseAdmin
      .from('courses').select('id').eq('created_by', userId);
    const courseIds = (courses || []).map(c => c.id);

    const [lessonsRes, quizzesRes] = await Promise.allSettled([
      courseIds.length > 0
        ? supabaseAdmin.from('lessons').select('id', { count: 'exact', head: true }).in('course_id', courseIds)
        : Promise.resolve({ count: 0 }),
      courseIds.length > 0
        ? examDb.from('quizzes').select('id', { count: 'exact', head: true }).in('course_id', courseIds)
        : Promise.resolve({ count: 0 }),
    ]);

    res.json({
      total_courses: courseIds.length,
      total_lessons: lessonsRes.status === 'fulfilled' ? (lessonsRes.value.count || 0) : 0,
      total_quizzes: quizzesRes.status === 'fulfilled' ? (quizzesRes.value.count || 0) : 0,
    });
  } catch (err) {
    console.error('Teacher stats error:', err);
    res.status(500).json({ error: 'Không thể tải thống kê.' });
  }
};

// GET /api/teacher/courses
exports.listCourses = async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: courses, error } = await supabaseAdmin
      .from('courses')
      .select('id,title,title_ja,level,is_published,created_at,thumbnail_url,description')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!courses || courses.length === 0) return res.json([]);

    const ids = courses.map(c => c.id);
    const [{ data: lessons }, { data: cm }] = await Promise.all([
      supabaseAdmin.from('lessons').select('course_id').in('course_id', ids),
      contentDb.from('courses').select('id,enrollment_count').in('id', ids),
    ]);

    const counts = {};
    (lessons || []).forEach(l => { counts[l.course_id] = (counts[l.course_id] || 0) + 1; });
    const enrollMap = Object.fromEntries((cm || []).map(c => [c.id, c.enrollment_count]));

    res.json(courses.map(c => ({ ...c, lesson_count: counts[c.id] || 0, enrollment_count: enrollMap[c.id] || 0 })));
  } catch (err) {
    console.error('Teacher courses error:', err);
    res.status(500).json({ error: 'Không thể tải khoá học.' });
  }
};

// POST /api/teacher/courses — khóa của giáo viên có phí (price > 0), creator_type='teacher'.
exports.createCourse = async (req, res) => {
  const { title, title_ja, description, description_ja, level, thumbnail_url,
          price, reference_curriculum, difficulty_level, is_published = false } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0)
    return res.status(400).json({ error: 'Khóa học của giáo viên phải có giá lớn hơn 0.' });
  try {
    const { data, error } = await supabaseAdmin.from('courses')
      .insert({ title, title_ja, description, description_ja, level, thumbnail_url, is_published, created_by: req.user.id })
      .select().single();
    if (error) throw error;

    const { data: extra } = await contentDb.from('courses')
      .update({
        creator_type: 'teacher',
        is_free: false,
        price: p,
        reference_curriculum: reference_curriculum ?? null,
        difficulty_level: difficulty_level ?? null,
      })
      .eq('id', data.id)
      .select('is_free,price,creator_type,reference_curriculum,difficulty_level').single();

    res.status(201).json({ ...data, ...(extra || {}) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tạo khoá học.' });
  }
};

// PUT /api/teacher/courses/:id — chỉ sửa khóa do chính mình tạo.
exports.updateCourse = async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from('courses').select('created_by').eq('id', req.params.id).single();
    if (!existing || existing.created_by !== req.user.id)
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa khoá học này.' });

    // Cột cơ bản qua view compat; giá/phân loại ghi thẳng vào bảng gốc. is_free luôn false (khóa teacher).
    const viewAllowed = ['title','title_ja','description','description_ja','level','thumbnail_url','is_published'];
    const newAllowed  = ['price','reference_curriculum','difficulty_level'];
    const viewUpdates = Object.fromEntries(Object.entries(req.body).filter(([k]) => viewAllowed.includes(k)));
    const newUpdates  = Object.fromEntries(Object.entries(req.body).filter(([k]) => newAllowed.includes(k)));

    if (newUpdates.price !== undefined) {
      const p = Number(newUpdates.price);
      if (!Number.isFinite(p) || p <= 0)
        return res.status(400).json({ error: 'Giá khóa học phải lớn hơn 0.' });
      newUpdates.price = p;
    }

    let data = null;
    if (Object.keys(viewUpdates).length) {
      viewUpdates.updated_at = new Date().toISOString();
      const r = await supabaseAdmin.from('courses').update(viewUpdates).eq('id', req.params.id).select().single();
      if (r.error) throw r.error;
      data = r.data;
    }
    let extra = null;
    if (Object.keys(newUpdates).length) {
      const r = await contentDb.from('courses').update(newUpdates).eq('id', req.params.id)
        .select('is_free,price,creator_type,reference_curriculum,difficulty_level').single();
      if (r.error) throw r.error;
      extra = r.data;
    }
    if (!data) {
      const r = await supabaseAdmin.from('courses').select('*').eq('id', req.params.id).single();
      data = r.data;
    }
    res.json({ ...data, ...(extra || {}) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

// DELETE /api/teacher/courses/:id
exports.deleteCourse = async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from('courses').select('created_by').eq('id', req.params.id).single();
    if (!existing || existing.created_by !== req.user.id)
      return res.status(403).json({ error: 'Bạn không có quyền xóa khoá học này.' });

    await supabaseAdmin.from('courses').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa khoá học.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa.' });
  }
};

// ── Course content (Bài học/units + Mục/lessons) — chỉ trên khóa do mình tạo ───
async function ownsCourse(courseId, userId) {
  const { data } = await supabaseAdmin.from('courses').select('created_by').eq('id', courseId).single();
  return !!data && data.created_by === userId;
}

// GET /api/teacher/courses/:courseId/builder
exports.getCourseBuilder = async (req, res) => {
  const { courseId } = req.params;
  try {
    if (!(await ownsCourse(courseId, req.user.id)))
      return res.status(403).json({ error: 'Bạn không có quyền với khóa học này.' });
    const { data: course, error: cErr } = await supabaseAdmin.from('courses').select('*').eq('id', courseId).single();
    if (cErr || !course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });

    // View compat không có price/phân loại — lấy thêm từ bảng gốc (như updateCourse).
    const { data: extra } = await contentDb.from('courses')
      .select('is_free,price,creator_type,reference_curriculum,difficulty_level').eq('id', courseId).single();

    const [{ data: units }, { data: lessons }] = await Promise.all([
      contentDb.from('units').select('*').eq('course_id', courseId).order('sort_order'),
      supabaseAdmin.from('lessons')
        .select('id,unit_id,title,title_ja,lesson_type,order_index,duration_minutes,question_count')
        .eq('course_id', courseId).order('order_index'),
    ]);
    const items = lessons || [];
    const unitsWithItems = (units || []).map(u => ({ ...u, lessons: items.filter(l => l.unit_id === u.id) }));
    res.json({ ...course, ...(extra || {}), units: unitsWithItems });
  } catch (err) { res.status(500).json({ error: 'Lỗi tải dữ liệu.' }); }
};

// ── Units ──────────────────────────────────────────────────────────────────────
exports.createUnit = async (req, res) => {
  const { course_id, title, title_ja, sort_order, description, level } = req.body;
  if (!course_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  if (!(await ownsCourse(course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const { data, error } = await contentDb.from('units')
      .insert({ course_id, title, title_ja: title_ja || null, sort_order: sort_order ?? 0, description: description || null, level: level || null })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài học.' }); }
};

exports.updateUnit = async (req, res) => {
  try {
    const { data: unit } = await contentDb.from('units').select('course_id').eq('id', req.params.id).single();
    if (!unit || !(await ownsCourse(unit.course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    const allowed = ['title', 'title_ja', 'sort_order', 'description', 'level'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_at = new Date().toISOString();
    const { data, error } = await contentDb.from('units').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.reorderUnits = async (req, res) => {
  const { items } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items phải là mảng.' });
  try {
    // Chỉ sắp xếp unit thuộc khóa do chính mình tạo.
    const { data: rows } = await contentDb.from('units').select('course_id').in('id', items.map(i => i.id));
    for (const cid of [...new Set((rows || []).map(r => r.course_id))])
      if (!(await ownsCourse(cid, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    await Promise.all(items.map(({ id, sort_order }) =>
      contentDb.from('units').update({ sort_order, updated_at: new Date().toISOString() }).eq('id', id)
    ));
    res.json({ message: 'Đã cập nhật thứ tự.' });
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật thứ tự.' }); }
};

exports.reorderLessons = async (req, res) => {
  const { items } = req.body; // [{ id, order_index }]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items phải là mảng.' });
  try {
    // Chỉ sắp xếp mục thuộc khóa do chính mình tạo.
    const { data: rows } = await supabaseAdmin.from('lessons').select('course_id').in('id', items.map(i => i.id));
    for (const cid of [...new Set((rows || []).map(r => r.course_id))])
      if (!(await ownsCourse(cid, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    await Promise.all(items.map(({ id, order_index }) =>
      supabaseAdmin.from('lessons').update({ order_index, updated_at: new Date().toISOString() }).eq('id', id)
    ));
    res.json({ message: 'Đã cập nhật thứ tự.' });
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật thứ tự.' }); }
};

exports.deleteUnit = async (req, res) => {
  try {
    const { data: unit } = await contentDb.from('units').select('course_id').eq('id', req.params.id).single();
    if (!unit || !(await ownsCourse(unit.course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    await contentDb.from('units').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa bài học.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Lessons (Mục) ──────────────────────────────────────────────────────────────
exports.getLesson = async (req, res) => {
  try {
    // Đọc qua compat view public.lessons để có shape giống admin (content/lesson_type/...).
    const { data: lesson } = await supabaseAdmin.from('lessons').select('*').eq('id', req.params.id).single();
    if (!lesson) return res.status(404).json({ error: 'Không tìm thấy mục.' });
    if (!(await ownsCourse(lesson.course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    // View compat không có description/transcript_segments — lấy thêm từ bảng gốc (như price của course).
    const { data: extra } = await contentDb.from('lessons').select('description,transcript_segments').eq('id', req.params.id).single();
    res.json({ ...lesson, description: extra?.description ?? null, transcript_segments: extra?.transcript_segments ?? null });
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

exports.createLesson = async (req, res) => {
  const { course_id, unit_id, title, title_ja, lesson_type, content, content_url, transcript, transcript_segments, grammar_notes, order_index, duration_minutes, question_count } = req.body;
  if (!course_id || !unit_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  if (!(await ownsCourse(course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const { data, error } = await contentDb.from('lessons')
      .insert({
        course_id, unit_id, title, title_ja: title_ja || null,
        content_body: content || null, content_type: lesson_type || 'reading',
        content_url: content_url || null, transcript: transcript || null, transcript_segments: transcript_segments || null, grammar_notes: grammar_notes || null,
        sort_order: order_index || 0, duration_minutes: duration_minutes || 0, question_count: question_count || 0,
        is_published: true,
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo mục.' }); }
};

exports.updateLesson = async (req, res) => {
  try {
    const { data: lesson } = await contentDb.from('lessons').select('course_id').eq('id', req.params.id).single();
    if (!lesson || !(await ownsCourse(lesson.course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    const FIELD_MAP = { content: 'content_body', lesson_type: 'content_type', order_index: 'sort_order', module_id: 'unit_id' };
    const allowed = ['title', 'title_ja', 'content', 'order_index', 'is_published', 'unit_id', 'lesson_type', 'duration_minutes', 'question_count', 'grammar_notes', 'content_url', 'transcript', 'transcript_segments', 'description'];
    const raw = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const updates = Object.fromEntries(Object.entries(raw).map(([k, v]) => [FIELD_MAP[k] || k, v]));
    updates.updated_at = new Date().toISOString();
    const { data, error } = await contentDb.from('lessons').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

// Chép lời tự động cho lesson video (cả upload lẫn YouTube qua yt-dlp) — chỉ trên khóa
// của chính mình. Trả về bản nháp segments cho editor duyệt, KHÔNG ghi DB (lưu qua
// PUT /lessons/:id sau khi xem lại).
exports.transcribeLessonVideo = async (req, res) => {
  const { runVideoTranscription } = require('../services/lessonTranscribe');
  try {
    const { data: lesson } = await contentDb.from('lessons').select('course_id, content_url').eq('id', req.params.id).single();
    if (!lesson || !(await ownsCourse(lesson.course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    if (!lesson.content_url) return res.status(400).json({ error: 'Mục chưa có video.' });
    const { segments, transcript } = await runVideoTranscription(lesson.content_url);
    res.json({ segments, transcript, count: segments.length });
  } catch (err) {
    console.error('transcribeLessonVideo (teacher) error:', err);
    res.status(500).json({ error: 'Không thể chép lời tự động: ' + err.message });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const { data: lesson } = await contentDb.from('lessons').select('course_id').eq('id', req.params.id).single();
    if (!lesson || !(await ownsCourse(lesson.course_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
    await contentDb.from('lessons').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa mục.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Vocabulary / Kanji attach-detach (gắn vào Mục) — kiểm tra sở hữu qua lesson ─
async function ownsLesson(lessonId, userId) {
  const { data } = await contentDb.from('lessons').select('course_id').eq('id', lessonId).single();
  return !!data && ownsCourse(data.course_id, userId);
}

exports.attachVocab = async (req, res) => {
  const { lessonId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Chưa chọn từ vựng nào.' });
  if (!(await ownsLesson(lessonId, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const rows = ids.map(vocabulary_id => ({ lesson_id: lessonId, vocabulary_id }));
    const { error } = await contentDb.from('lesson_vocabulary').upsert(rows, { onConflict: 'lesson_id,vocabulary_id' });
    if (error) throw error;
    res.json({ message: `Đã thêm ${ids.length} từ vựng vào bài.` });
  } catch (err) { res.status(500).json({ error: 'Không thể thêm từ vựng.' }); }
};

exports.detachVocab = async (req, res) => {
  const { lessonId, vocabId } = req.params;
  if (!(await ownsLesson(lessonId, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const { error } = await contentDb.from('lesson_vocabulary').delete().eq('lesson_id', lessonId).eq('vocabulary_id', vocabId);
    if (error) throw error;
    res.json({ message: 'Đã gỡ khỏi bài.' });
  } catch (err) { res.status(500).json({ error: 'Không thể gỡ từ vựng.' }); }
};

exports.attachKanji = async (req, res) => {
  const { lessonId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Chưa chọn kanji nào.' });
  if (!(await ownsLesson(lessonId, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const rows = ids.map(kanji_id => ({ lesson_id: lessonId, kanji_id }));
    const { error } = await contentDb.from('lesson_kanji').upsert(rows, { onConflict: 'lesson_id,kanji_id' });
    if (error) throw error;
    res.json({ message: `Đã thêm ${ids.length} kanji vào bài.` });
  } catch (err) { res.status(500).json({ error: 'Không thể thêm kanji.' }); }
};

exports.detachKanji = async (req, res) => {
  const { lessonId, kanjiId } = req.params;
  if (!(await ownsLesson(lessonId, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const { error } = await contentDb.from('lesson_kanji').delete().eq('lesson_id', lessonId).eq('kanji_id', kanjiId);
    if (error) throw error;
    res.json({ message: 'Đã gỡ khỏi bài.' });
  } catch (err) { res.status(500).json({ error: 'Không thể gỡ kanji.' }); }
};

exports.attachGrammar = async (req, res) => {
  const { lessonId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Chưa chọn ngữ pháp nào.' });
  if (!(await ownsLesson(lessonId, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const rows = ids.map(grammar_point_id => ({ lesson_id: lessonId, grammar_point_id }));
    const { error } = await contentDb.from('lesson_grammar_points').upsert(rows, { onConflict: 'lesson_id,grammar_point_id' });
    if (error) throw error;
    res.json({ message: `Đã thêm ${ids.length} ngữ pháp vào bài.` });
  } catch (err) { res.status(500).json({ error: 'Không thể thêm ngữ pháp.' }); }
};

exports.detachGrammar = async (req, res) => {
  const { lessonId, grammarId } = req.params;
  if (!(await ownsLesson(lessonId, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const { error } = await contentDb.from('lesson_grammar_points').delete().eq('lesson_id', lessonId).eq('grammar_point_id', grammarId);
    if (error) throw error;
    res.json({ message: 'Đã gỡ khỏi bài.' });
  } catch (err) { res.status(500).json({ error: 'Không thể gỡ ngữ pháp.' }); }
};

// ── Teacher-specific create with lesson ownership check ───────────────────────
// Khi giáo viên thêm thủ công vào bài, kiểm tra sở hữu bài trước khi tạo.
exports.createVocabForLesson = async (req, res) => {
  const { lesson_id } = req.body;
  if (lesson_id && !(await ownsLesson(lesson_id, req.user.id)))
    return res.status(403).json({ error: 'Bạn không có quyền thêm vào bài này.' });
  return require('./adminController').createVocab(req, res);
};

exports.createKanjiForLesson = async (req, res) => {
  const { lesson_id } = req.body;
  if (lesson_id && !(await ownsLesson(lesson_id, req.user.id)))
    return res.status(403).json({ error: 'Bạn không có quyền thêm vào bài này.' });
  return require('./adminController').createKanji(req, res);
};

exports.createGrammarForLesson = async (req, res) => {
  const { lesson_id } = req.body;
  if (lesson_id && !(await ownsLesson(lesson_id, req.user.id)))
    return res.status(403).json({ error: 'Bạn không có quyền thêm vào bài này.' });
  return require('./adminController').createGrammarPoint(req, res);
};

// ── Sửa kanji/ngữ pháp trong kho chung (vd: sửa inline ngay trên bài đăng) ──────
// created_by NULL (kanji hệ thống, ngữ pháp nhập hàng loạt từ Mazii) → giáo viên
// nào cũng sửa được, vì không ai sở hữu riêng. Đã gán cho 1 giáo viên cụ thể →
// chỉ giáo viên đó sửa được, giống hệt luật của "my-vocab".
async function checkSharedOwnership(table, id, userId) {
  const { data: row } = await supabaseAdmin.from(table).select('created_by').eq('id', id).single();
  if (!row) return { ok: false, notFound: true };
  if (row.created_by && row.created_by !== userId) return { ok: false, notFound: false };
  return { ok: true, notFound: false };
}

exports.updateSharedVocab = async (req, res) => {
  const check = await checkSharedOwnership('vocabulary', req.params.id, req.user.id);
  if (check.notFound) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (!check.ok) return res.status(403).json({ error: 'Từ vựng này do giáo viên khác tạo, bạn không có quyền sửa.' });
  const allowed = ['kanji', 'reading', 'meaning_vi', 'meaning_ja', 'level', 'lesson_id', 'type', 'topic', 'example_sentence', 'image_url', 'han_viet'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể cập nhật.' }); }
};

exports.updateSharedKanji = async (req, res) => {
  const check = await checkSharedOwnership('kanji', req.params.id, req.user.id);
  if (check.notFound) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (!check.ok) return res.status(403).json({ error: 'Kanji này do giáo viên khác tạo, bạn không có quyền sửa.' });
  const allowed = ['character', 'reading_on', 'reading_kun', 'meaning_vi', 'stroke_count', 'level', 'han_viet'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('kanji').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể cập nhật.' }); }
};

exports.updateSharedGrammarPoint = async (req, res) => {
  const check = await checkSharedOwnership('grammar_points', req.params.id, req.user.id);
  if (check.notFound) return res.status(404).json({ error: 'Không tìm thấy.' });
  if (!check.ok) return res.status(403).json({ error: 'Mẫu ngữ pháp này do giáo viên khác tạo, bạn không có quyền sửa.' });
  const allowed = ['title', 'title_ja', 'meaning_vi', 'explanation', 'example_sentence', 'level'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (updates.level === '') updates.level = null;
  try {
    const { data, error } = await langDb.from('grammar_points').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể cập nhật.' }); }
};

// ── Quiz của Mục (lesson quiz) ─────────────────────────────────────────────────
// Trình soạn quiz gắn với Mục (giống admin /admin/quizzes), khác bộ "Bài kiểm tra"
// (/api/exams/teacher/*: is_exam=true, sở hữu qua teacher_id). Ở đây quiz thuộc
// lesson → sở hữu kiểm tra qua khóa học do chính giáo viên tạo (ownsLesson).
const { validateThreshold } = require('../services/passThreshold');

// Quiz phải gắn lesson thuộc khóa của giáo viên; trả về quiz row hoặc null.
async function ownedLessonQuiz(quizId, userId) {
  const { data: quiz } = await examDb.from('quizzes').select('*').eq('id', quizId).single();
  if (!quiz || !quiz.lesson_id) return null;
  return (await ownsLesson(quiz.lesson_id, userId)) ? quiz : null;
}

exports.listLessonQuizzes = async (req, res) => {
  const { lesson_id } = req.query;
  if (!lesson_id) return res.status(400).json({ error: 'Thiếu lesson_id.' });
  if (!(await ownsLesson(lesson_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    const { data, error } = await examDb.from('quizzes')
      .select('*').eq('lesson_id', lesson_id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [], total: (data || []).length });
  } catch (err) { res.status(500).json({ error: 'Không thể tải danh sách quiz.' }); }
};

exports.createLessonQuiz = async (req, res) => {
  const { title, title_ja, description, lesson_id, type, time_limit, mode, strict_fullscreen } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  if (!lesson_id) return res.status(400).json({ error: 'Thiếu lesson_id.' });
  if (!(await ownsLesson(lesson_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    // Phải set course_id — nếu để NULL, checkCourseContentAccess coi quiz là "không thuộc
    // khóa nào" và học sinh chưa mua khóa vẫn truy cập được (bypass paywall).
    const { data: lessonRow } = await contentDb.from('lessons')
      .select('course_id').eq('id', lesson_id).single();
    const { data, error } = await examDb.from('quizzes')
      .insert({ title, title_ja, description, lesson_id, course_id: lessonRow?.course_id || null,
                type: type || 'multiple_choice', time_limit,
                mode: mode === 'proctored' ? 'proctored' : 'normal',
                // "Giám sát" luôn kéo theo toàn màn hình nghiêm ngặt (webcam đã bỏ)
                strict_fullscreen: mode === 'proctored' ? true : strict_fullscreen === true })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể tạo quiz.' }); }
};

exports.updateLessonQuiz = async (req, res) => {
  const allowed = ['title','title_ja','description','type','time_limit','is_published','mode','strict_fullscreen','passing_type','passing_value'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (updates.mode === 'proctored') updates.strict_fullscreen = true;
  try {
    if (!(await ownedLessonQuiz(req.params.id, req.user.id))) return res.status(403).json({ error: 'Không có quyền với quiz này.' });
    if ('passing_type' in updates || 'passing_value' in updates) {
      let total = 0;
      if (updates.passing_type === 'count') {
        const { count } = await examDb.from('quiz_questions')
          .select('id', { count: 'exact', head: true }).eq('quiz_id', req.params.id);
        total = count || 0;
      }
      const v = validateThreshold(updates.passing_type, updates.passing_value, total);
      if (v.error) return res.status(400).json({ error: v.error });
      updates.passing_type  = v.type;
      updates.passing_value = v.value;
    }
    const { data, error } = await examDb.from('quizzes').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteLessonQuiz = async (req, res) => {
  try {
    if (!(await ownedLessonQuiz(req.params.id, req.user.id))) return res.status(403).json({ error: 'Không có quyền với quiz này.' });
    await examDb.from('quizzes').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

exports.listLessonQuizQuestions = async (req, res) => {
  try {
    if (!(await ownedLessonQuiz(req.params.quizId, req.user.id))) return res.status(403).json({ error: 'Không có quyền với quiz này.' });
    const { data, error } = await examDb
      .from('quiz_questions')
      .select('id,question,options,correct_answer,correct_answer_data,question_type,bank_question_id,explanation,order_index')
      .eq('quiz_id', req.params.quizId)
      .order('order_index');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Không thể tải câu hỏi.' }); }
};

exports.createLessonQuizQuestion = async (req, res) => {
  const {
    quiz_id, question, options, correct_answer, correct_answer_data,
    explanation, order_index, question_type, bank_question_id,
  } = req.body;
  if (!quiz_id) return res.status(400).json({ error: 'Thiếu quiz_id.' });
  if (!bank_question_id && !question) return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  try {
    if (!(await ownedLessonQuiz(quiz_id, req.user.id))) return res.status(403).json({ error: 'Không có quyền với quiz này.' });
    const { data, error } = await examDb.from('quiz_questions')
      .insert({
        quiz_id,
        question:             question || null,
        options:              options  || null,
        correct_answer:       correct_answer || null,
        correct_answer_data:  correct_answer_data || null,
        explanation:          explanation || null,
        order_index:          order_index ?? 0,
        question_type:        question_type || 'single_choice',
        bank_question_id:     bank_question_id || null,
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

// Tìm quiz chứa câu hỏi rồi kiểm tra sở hữu qua lesson.
async function ownedQuizQuestion(questionId, userId) {
  const { data: q } = await examDb.from('quiz_questions').select('quiz_id').eq('id', questionId).single();
  if (!q) return null;
  return (await ownedLessonQuiz(q.quiz_id, userId)) ? q : null;
}

exports.updateLessonQuizQuestion = async (req, res) => {
  const allowed = [
    'question','options','correct_answer','correct_answer_data',
    'explanation','order_index','question_type','bank_question_id',
  ];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    if (!(await ownedQuizQuestion(req.params.id, req.user.id))) return res.status(403).json({ error: 'Không có quyền với câu hỏi này.' });
    const { data, error } = await examDb.from('quiz_questions').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteLessonQuizQuestion = async (req, res) => {
  try {
    if (!(await ownedQuizQuestion(req.params.id, req.user.id))) return res.status(403).json({ error: 'Không có quyền với câu hỏi này.' });
    await examDb.from('quiz_questions').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// Nhập nhiều câu hỏi từ ngân hàng đề vào quiz.
exports.importLessonQuizFromBank = async (req, res) => {
  const { quizId } = req.params;
  const { question_ids, source = 'mine' } = req.body; // source: 'mine' (riêng) | 'global' (chung, đã duyệt)
  if (!Array.isArray(question_ids) || !question_ids.length)
    return res.status(400).json({ error: 'Không có câu hỏi được chọn.' });
  try {
    if (!(await ownedLessonQuiz(quizId, req.user.id))) return res.status(403).json({ error: 'Không có quyền với quiz này.' });

    const { data: existing } = await examDb
      .from('quiz_questions').select('order_index').eq('quiz_id', quizId).order('order_index', { ascending: false }).limit(1);
    let nextIdx = existing && existing.length ? (existing[0].order_index + 1) : 0;

    // Lấy câu hỏi từ ngân hàng riêng (của GV) hoặc ngân hàng chung của admin (đã duyệt)
    const bankQuery = source === 'global'
      ? examDb.from('question_bank').select('*').in('id', question_ids).eq('status', 'approved')
      : examDb.from('teacher_question_bank').select('*').in('id', question_ids).eq('teacher_id', req.user.id);
    const { data: bankRows, error: fetchErr } = await bankQuery;
    if (fetchErr) throw fetchErr;

    const rows = (bankRows || []).map((bq, i) => ({
      quiz_id:             quizId,
      bank_question_id:    bq.id,
      question_type:       bq.question_type || 'single_choice',
      question:            bq.question_text,
      options:             bq.options,
      correct_answer:      typeof bq.correct_answer === 'string' ? bq.correct_answer : null,
      correct_answer_data: typeof bq.correct_answer !== 'string' ? bq.correct_answer : null,
      explanation:         bq.explanation || null,
      order_index:         nextIdx + i,
    }));

    const { data, error } = await examDb.from('quiz_questions').insert(rows).select();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể nhập câu hỏi.' }); }
};

// GET /api/teacher/quizzes/:quizId/attempts — danh sách bài làm + dữ liệu giám sát
exports.listLessonQuizAttempts = async (req, res) => {
  try {
    if (!(await ownedLessonQuiz(req.params.quizId, req.user.id))) return res.status(403).json({ error: 'Không có quyền với quiz này.' });
    const { data: attempts, error } = await examDb
      .from('quiz_attempts')
      .select('id,user_id,score,total_questions,mode,violation_count,proctor_events,snapshots,completed_at')
      .eq('quiz_id', req.params.quizId)
      .order('completed_at', { ascending: false });
    if (error) throw error;
    if (!attempts || attempts.length === 0) return res.json([]);

    // Gắn tên học viên
    const userIds = [...new Set(attempts.map(a => a.user_id))];
    const { data: users } = await supabaseAdmin.from('users').select('id,full_name,email').in('id', userIds);
    const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));

    // Tạo signed URL cho ảnh giám sát (hết hạn sau 1 giờ)
    const result = await Promise.all(attempts.map(async (a) => {
      let snapshotUrls = [];
      if (Array.isArray(a.snapshots) && a.snapshots.length > 0) {
        const { data: signed } = await supabaseAdmin.storage
          .from('proctor-snapshots')
          .createSignedUrls(a.snapshots, 3600);
        snapshotUrls = (signed || []).map(s => s.signedUrl).filter(Boolean);
      }
      return { ...a, student: uMap[a.user_id] || { email: a.user_id }, snapshot_urls: snapshotUrls };
    }));

    res.json(result);
  } catch (err) {
    console.error('List lesson quiz attempts error:', err);
    res.status(500).json({ error: 'Không thể tải bài làm.' });
  }
};

// ── Cấp quyền học khoá cho học viên (giáo viên tự cấp, không cần thanh toán) ───
// Quyền học = row course_enrollments (xem services/courseAccess.js). Giáo viên chỉ
// thao tác được trên khoá do chính mình tạo; admin được đi qua như mọi nơi khác.

const grantSvc = require('../services/courseGrantService');

async function assertCourseOwner(courseId, user) {
  const { data: course } = await supabaseAdmin.from('courses')
    .select('id, title, created_by').eq('id', courseId).maybeSingle();
  if (!course) {
    const e = new Error('Không tìm thấy khoá học.');
    e.status = 404;
    throw e;
  }
  if (user.user_metadata?.role !== 'admin' && course.created_by !== user.id) {
    const e = new Error('Bạn không có quyền trên khoá học này.');
    e.status = 403;
    throw e;
  }
  return course;
}

// Gom xử lý lỗi có e.status để 4 handler dưới không lặp try/catch dài dòng.
function sendErr(res, err, fallback) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

// Bước xác nhận: đối chiếu email → tài khoản, KHÔNG ghi gì vào DB.
exports.previewCourseGrants = async (req, res) => {
  try {
    const course = await assertCourseOwner(req.params.id, req.user);
    const { results } = await grantSvc.resolveEmails(req.body?.emails, course.id, course.created_by);
    res.json({ results, max_emails: grantSvc.MAX_EMAILS });
  } catch (err) { sendErr(res, err, 'Không thể kiểm tra danh sách email.'); }
};

exports.grantCourseAccess = async (req, res) => {
  try {
    const course = await assertCourseOwner(req.params.id, req.user);

    // Nhận user_ids (sau khi đã xác nhận) hoặc emails (đường tắt) — luôn resolve lại
    // để không tin danh sách id do client gửi lên.
    let ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids : null;
    if (!ids) {
      const { results } = await grantSvc.resolveEmails(req.body?.emails, course.id, course.created_by);
      ids = results.filter(r => r.status === 'ok').map(r => r.user_id);
    } else if (ids.length > grantSvc.MAX_EMAILS) {
      return res.status(400).json({ error: `Tối đa ${grantSvc.MAX_EMAILS} học viên mỗi lần.` });
    }
    if (!ids.length) return res.status(400).json({ error: 'Không có học viên hợp lệ để cấp quyền.' });

    const result = await grantSvc.grantAccess(course.id, req.user.id, ids);
    res.json(result);
  } catch (err) { sendErr(res, err, 'Không thể cấp quyền.'); }
};

exports.listCourseGrants = async (req, res) => {
  try {
    const course = await assertCourseOwner(req.params.id, req.user);
    res.json(await grantSvc.listGranted(course.id));
  } catch (err) { sendErr(res, err, 'Không thể tải danh sách đã cấp.'); }
};

exports.revokeCourseGrant = async (req, res) => {
  try {
    const course = await assertCourseOwner(req.params.id, req.user);
    await grantSvc.revokeAccess(course.id, req.params.studentId);
    res.json({ success: true });
  } catch (err) { sendErr(res, err, 'Không thể thu hồi quyền.'); }
};
