'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Bảng quiz đã chuyển sang schema exam_module
const examDb = supabaseAdmin.schema('exam_module');

// ── My Vocabulary ─────────────────────────────────────────────────────────────
exports.listMyVocab = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const { data, error, count } = await supabaseAdmin
      .from('teacher_vocabulary')
      .select('*', { count: 'exact' })
      .eq('teacher_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tải dữ liệu.' }); }
};

exports.createMyVocab = async (req, res) => {
  const { kanji, reading, meaning_vi, meaning_ja, level, type, example_sentence } = req.body;
  if (!reading || !meaning_vi) return res.status(400).json({ error: 'Reading và nghĩa là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('teacher_vocabulary')
      .insert({ teacher_id: req.user.id, kanji, reading, meaning_vi, meaning_ja, level, type, example_sentence })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo.' }); }
};

exports.updateMyVocab = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('teacher_vocabulary').select('teacher_id,status').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    if (row.status === 'pending') return res.status(400).json({ error: 'Không thể sửa khi đang chờ duyệt.' });
    const allowed = ['kanji','reading','meaning_vi','meaning_ja','level','type','example_sentence'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_at = new Date().toISOString();
    updates.status = 'draft';
    const { data, error } = await supabaseAdmin.from('teacher_vocabulary').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteMyVocab = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('teacher_vocabulary').select('teacher_id').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    await supabaseAdmin.from('teacher_vocabulary').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

exports.submitMyVocab = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('teacher_vocabulary').select('teacher_id,status').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    if (row.status === 'pending') return res.status(400).json({ error: 'Đã gửi yêu cầu rồi.' });
    if (row.status === 'approved') return res.status(400).json({ error: 'Đã được duyệt.' });
    const { data, error } = await supabaseAdmin.from('teacher_vocabulary')
      .update({ status: 'pending', admin_note: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể gửi yêu cầu.' }); }
};

// ── My Kanji ──────────────────────────────────────────────────────────────────
exports.listMyKanji = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const { data, error, count } = await supabaseAdmin
      .from('teacher_kanji')
      .select('*', { count: 'exact' })
      .eq('teacher_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tải dữ liệu.' }); }
};

exports.createMyKanji = async (req, res) => {
  const { character, reading_on, reading_kun, meaning_vi, stroke_count, level } = req.body;
  if (!character || !meaning_vi) return res.status(400).json({ error: 'Kanji và nghĩa là bắt buộc.' });
  const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  try {
    const { data, error } = await supabaseAdmin.from('teacher_kanji')
      .insert({ teacher_id: req.user.id, character, reading_on: toArr(reading_on), reading_kun: toArr(reading_kun), meaning_vi, stroke_count: stroke_count ? Number(stroke_count) : null, level })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo.' }); }
};

exports.updateMyKanji = async (req, res) => {
  const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  try {
    const { data: row } = await supabaseAdmin.from('teacher_kanji').select('teacher_id,status').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    if (row.status === 'pending') return res.status(400).json({ error: 'Không thể sửa khi đang chờ duyệt.' });
    const { character, reading_on, reading_kun, meaning_vi, stroke_count, level } = req.body;
    const updates = { updated_at: new Date().toISOString(), status: 'draft' };
    if (character   !== undefined) updates.character    = character;
    if (meaning_vi  !== undefined) updates.meaning_vi   = meaning_vi;
    if (reading_on  !== undefined) updates.reading_on   = toArr(reading_on);
    if (reading_kun !== undefined) updates.reading_kun  = toArr(reading_kun);
    if (stroke_count !== undefined) updates.stroke_count = stroke_count ? Number(stroke_count) : null;
    if (level       !== undefined) updates.level        = level;
    const { data, error } = await supabaseAdmin.from('teacher_kanji').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteMyKanji = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('teacher_kanji').select('teacher_id').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    await supabaseAdmin.from('teacher_kanji').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

exports.submitMyKanji = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin.from('teacher_kanji').select('teacher_id,status').eq('id', req.params.id).single();
    if (!row || row.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    if (row.status === 'pending') return res.status(400).json({ error: 'Đã gửi yêu cầu rồi.' });
    if (row.status === 'approved') return res.status(400).json({ error: 'Đã được duyệt.' });
    const { data, error } = await supabaseAdmin.from('teacher_kanji')
      .update({ status: 'pending', admin_note: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể gửi yêu cầu.' }); }
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

    const { data: lessons } = await supabaseAdmin
      .from('lessons').select('course_id').in('course_id', courses.map(c => c.id));

    const counts = {};
    (lessons || []).forEach(l => { counts[l.course_id] = (counts[l.course_id] || 0) + 1; });

    res.json(courses.map(c => ({ ...c, lesson_count: counts[c.id] || 0 })));
  } catch (err) {
    console.error('Teacher courses error:', err);
    res.status(500).json({ error: 'Không thể tải khoá học.' });
  }
};

// POST /api/teacher/courses
exports.createCourse = async (req, res) => {
  const { title, title_ja, description, description_ja, level, thumbnail_url } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  try {
    const { data, error } = await supabaseAdmin.from('courses')
      .insert({ title, title_ja, description, description_ja, level, thumbnail_url, created_by: req.user.id })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tạo khoá học.' });
  }
};

// PUT /api/teacher/courses/:id
exports.updateCourse = async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from('courses').select('created_by').eq('id', req.params.id).single();
    if (!existing || existing.created_by !== req.user.id)
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa khoá học này.' });

    const allowed = ['title','title_ja','description','description_ja','level','thumbnail_url','is_published'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from('courses').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
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
