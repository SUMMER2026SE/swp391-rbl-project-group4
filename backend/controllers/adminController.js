'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Bảng quiz đã chuyển sang schema exam_module (question_bank/users vẫn ở public)
const examDb = supabaseAdmin.schema('exam_module');
// Bảng "Bài học" (units) nằm trong content_module (Mục/item vẫn dùng compat view public.lessons)
const contentDb = supabaseAdmin.schema('content_module');

// ── Stats ────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [usersRes, coursesRes, vocabRes, quizzesRes] = await Promise.allSettled([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('vocabulary').select('id', { count: 'exact', head: true }),
      examDb.from('quizzes').select('id', { count: 'exact', head: true }),
    ]);
    const authUsers    = usersRes.status === 'fulfilled' ? (usersRes.value.data?.users || []) : [];
    const teacherCount = authUsers.filter(u => u.user_metadata?.role === 'teacher').length;
    res.json({
      total_users:    usersRes.status    === 'fulfilled' ? (usersRes.value.data?.total || authUsers.length) : 0,
      teacher_count:  teacherCount,
      total_courses:  coursesRes.status  === 'fulfilled' ? (coursesRes.value.count    || 0) : 0,
      total_vocab:    vocabRes.status    === 'fulfilled' ? (vocabRes.value.count       || 0) : 0,
      total_quizzes:  quizzesRes.status  === 'fulfilled' ? (quizzesRes.value.count    || 0) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải thống kê.' });
  }
};

// ── Users ────────────────────────────────────────────────────────────────────
exports.listUsers = async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let query = supabaseAdmin.from('users')
      .select('id,full_name,email,phone,avatar_url,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with role from auth.users metadata
    const roleMap = {};
    if (data && data.length > 0) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const ids = new Set(data.map(u => u.id));
      (authData?.users || []).forEach(u => {
        if (ids.has(u.id)) roleMap[u.id] = u.user_metadata?.role || 'student';
      });
    }

    const enriched = (data || []).map(u => ({ ...u, role: roleMap[u.id] || 'student' }));
    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách.' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};

exports.updateUser = async (req, res) => {
  const { full_name, phone, role } = req.body;
  try {
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone     !== undefined) updates.phone     = phone;
    await supabaseAdmin.from('users').update(updates).eq('id', req.params.id);
    if (role !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, { user_metadata: { role } });
    }
    res.json({ message: 'Đã cập nhật.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    res.json({ message: 'Đã xóa người dùng.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa.' });
  }
};

exports.resetUserPassword = async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password });
    if (error) throw error;
    res.json({ message: 'Đã đặt lại mật khẩu thành công.' });
  } catch (err) {
    console.error('Reset user password error:', err);
    res.status(500).json({ error: 'Không thể đặt lại mật khẩu.' });
  }
};

// ── Recent Activity ──────────────────────────────────────────────────────────
exports.getRecentActivity = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id,full_name,email,created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;

    const activity = (data || []).map(u => {
      const name = u.full_name || u.email || 'Người dùng';
      const words = name.trim().split(' ');
      const initials = words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
      return { id: u.id, name, initials, action: 'Đã đăng ký tài khoản', time: u.created_at };
    });
    res.json(activity);
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ error: 'Không thể tải hoạt động.' });
  }
};

// ── Courses CRUD ─────────────────────────────────────────────────────────────
exports.listCourses = async (req, res) => {
  const { page = 1, limit = 12, search, status, level, sort = 'newest' } = req.query;
  const offset = (page - 1) * limit;
  // Áp filter search/level dùng chung cho cả query trang lẫn đếm tab.
  const applyBase = (q) => {
    if (search) q = q.ilike('title', `%${search}%`);
    if (level)  q = q.eq('level', level);
    return q;
  };
  try {
    let q = applyBase(supabaseAdmin.from('courses').select('*', { count: 'exact' }));
    if (status === 'published') q = q.eq('is_published', true);
    if (status === 'draft')     q = q.eq('is_published', false);
    if (sort === 'oldest')      q = q.order('created_at', { ascending: true });
    else if (sort === 'title')  q = q.order('title', { ascending: true });
    else                        q = q.order('created_at', { ascending: false });
    q = q.range(offset, offset + Number(limit) - 1);

    const [pageRes, allRes, pubRes] = await Promise.all([
      q,
      applyBase(supabaseAdmin.from('courses').select('*', { count: 'exact', head: true })),
      applyBase(supabaseAdmin.from('courses').select('*', { count: 'exact', head: true })).eq('is_published', true),
    ]);
    if (pageRes.error) throw pageRes.error;
    const rows = pageRes.data || [];
    const all = allRes.count || 0;
    const published = pubRes.count || 0;

    // Bổ sung số học viên (cột cache ở content_module) + số mục cho từng khóa của trang.
    const ids = rows.map(c => c.id);
    let enrollMap = {}, lessonMap = {};
    if (ids.length) {
      const [{ data: cm }, { data: ls }] = await Promise.all([
        contentDb.from('courses').select('id,enrollment_count').in('id', ids),
        supabaseAdmin.from('lessons').select('course_id').in('course_id', ids),
      ]);
      enrollMap = Object.fromEntries((cm || []).map(c => [c.id, c.enrollment_count]));
      (ls || []).forEach(l => { lessonMap[l.course_id] = (lessonMap[l.course_id] || 0) + 1; });
    }
    const data = rows.map(c => ({ ...c, enrollment_count: enrollMap[c.id] || 0, lesson_count: lessonMap[c.id] || 0 }));

    res.json({
      data, total: pageRes.count, page: Number(page), limit: Number(limit),
      counts: { all, published, draft: all - published },
    });
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

// POST /api/admin/courses/upload-cover (dùng chung cho teacher) — trả về URL ảnh bìa.
exports.uploadCourseCover = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const filename = `course-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error } = await supabaseAdmin.storage
      .from('passage-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('passage-images').getPublicUrl(filename);
    res.json({ url: publicUrl });
  } catch (err) { res.status(500).json({ error: 'Không thể tải ảnh lên.' }); }
};

exports.createCourse = async (req, res) => {
  const { title, title_ja, description, description_ja, level, thumbnail_url, is_published = false,
          price, reference_curriculum, difficulty_level } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  try {
    // Cột cơ bản đi qua view compat (map level → jlpt_level_id).
    const { data, error } = await supabaseAdmin.from('courses')
      .insert({ title, title_ja, description, description_ja, level, thumbnail_url, is_published, created_by: req.user.id })
      .select().single();
    if (error) throw error;

    // Khóa do admin tạo: miễn phí, creator_type='admin'. Cột mới ghi thẳng vào bảng gốc.
    const { data: extra } = await contentDb.from('courses')
      .update({
        creator_type: 'admin',
        is_free: true,
        price: price ?? 0,
        reference_curriculum: reference_curriculum ?? null,
        difficulty_level: difficulty_level ?? null,
      })
      .eq('id', data.id)
      .select('is_free,price,creator_type,reference_curriculum,difficulty_level').single();

    res.status(201).json({ ...data, ...(extra || {}) });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo khóa học.' }); }
};

exports.updateCourse = async (req, res) => {
  // Cột cơ bản qua view compat; cột giá/phân loại ghi thẳng vào bảng gốc content_module.
  const viewAllowed = ['title','title_ja','description','description_ja','level','thumbnail_url','is_published'];
  const newAllowed  = ['is_free','price','reference_curriculum','difficulty_level'];
  const viewUpdates = Object.fromEntries(Object.entries(req.body).filter(([k]) => viewAllowed.includes(k)));
  const newUpdates  = Object.fromEntries(Object.entries(req.body).filter(([k]) => newAllowed.includes(k)));
  try {
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
    // Nếu chỉ sửa cột mới, vẫn trả về bản ghi đầy đủ từ view.
    if (!data) {
      const r = await supabaseAdmin.from('courses').select('*').eq('id', req.params.id).single();
      data = r.data;
    }
    res.json({ ...data, ...(extra || {}) });
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteCourse = async (req, res) => {
  try {
    await supabaseAdmin.from('courses').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Course Builder ────────────────────────────────────────────────────────────
exports.getCourseBuilder = async (req, res) => {
  const { courseId } = req.params;
  try {
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses').select('*').eq('id', courseId).single();
    if (cErr || !course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });

    const [{ data: units, error: uErr }, { data: lessons, error: lErr }] = await Promise.all([
      contentDb.from('units').select('*').eq('course_id', courseId).order('sort_order'),
      supabaseAdmin.from('lessons')
        .select('id,unit_id,title,title_ja,lesson_type,order_index,duration_minutes,question_count')
        .eq('course_id', courseId).order('order_index'),
    ]);
    if (uErr) throw uErr;
    if (lErr) throw lErr;

    const items = lessons || [];
    const unitsWithItems = (units || []).map(u => ({
      ...u,
      lessons: items.filter(l => l.unit_id === u.id),
    }));

    res.json({ ...course, units: unitsWithItems });
  } catch (err) { res.status(500).json({ error: 'Lỗi tải dữ liệu.' }); }
};

// ── Units CRUD ("Bài học") ─────────────────────────────────────────────────────
exports.createUnit = async (req, res) => {
  const { course_id, title, title_ja, sort_order, description, level } = req.body;
  if (!course_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await contentDb.from('units')
      .insert({ course_id, title, title_ja: title_ja || null, sort_order: sort_order ?? 0, description: description || null, level: level || null })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài học.' }); }
};

exports.updateUnit = async (req, res) => {
  const allowed = ['title', 'title_ja', 'sort_order', 'description', 'level'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date().toISOString();
  try {
    const { data, error } = await contentDb.from('units').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteUnit = async (req, res) => {
  try {
    await contentDb.from('units').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa bài học.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

exports.reorderUnits = async (req, res) => {
  const { items } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items phải là mảng.' });
  try {
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
    await Promise.all(items.map(({ id, order_index }) =>
      supabaseAdmin.from('lessons').update({ order_index, updated_at: new Date().toISOString() }).eq('id', id)
    ));
    res.json({ message: 'Đã cập nhật thứ tự.' });
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật thứ tự.' }); }
};

// ── Lessons CRUD ─────────────────────────────────────────────────────────────
exports.getLesson = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('lessons').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

exports.listLessons = async (req, res) => {
  const { course_id, lesson_type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    // lessons là view (không embed FK được) → join thủ công với courses.
    let q = supabaseAdmin.from('lessons').select('*', { count: 'exact' })
      .order('course_id').order('order_index')
      .range(offset, offset + Number(limit) - 1);
    if (course_id)   q = q.eq('course_id', course_id);
    if (lesson_type) q = q.eq('lesson_type', lesson_type);
    const { data, error, count } = await q;
    if (error) throw error;

    const courseIds = [...new Set((data || []).map(l => l.course_id).filter(Boolean))];
    const { data: courses } = courseIds.length
      ? await supabaseAdmin.from('courses').select('id, title, level').in('id', courseIds)
      : { data: [] };
    const cMap = Object.fromEntries((courses || []).map(c => [c.id, c]));
    const enriched = (data || []).map(l => ({ ...l, courses: cMap[l.course_id] || null }));


    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

exports.createLesson = async (req, res) => {
  const { course_id, unit_id, title, title_ja, lesson_type, content, grammar_notes, content_url, transcript, order_index, duration_minutes, question_count, is_published } = req.body;
  if (!course_id || !unit_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const contentDb = supabaseAdmin.schema('content_module');
    const { data, error } = await contentDb.from('lessons')
      .insert({ course_id, unit_id: unit_id || null, title, title_ja, content_body: content, content_type: lesson_type || 'reading', grammar_notes, content_url, transcript, sort_order: order_index || 0, duration_minutes: duration_minutes || 0, question_count: question_count || 0, is_published: is_published ?? false })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('createLesson error:', err);
    res.status(500).json({ error: 'Không thể tạo bài học.' });
  }
};

exports.updateLesson = async (req, res) => {
  const FIELD_MAP = { content: 'content_body', lesson_type: 'content_type', order_index: 'sort_order', module_id: 'unit_id' };
  const allowed = ['title','title_ja','content','order_index','is_published','course_id','module_id','unit_id','lesson_type','duration_minutes','question_count','grammar_notes','content_url','transcript'];
  const raw = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const updates = Object.fromEntries(Object.entries(raw).map(([k, v]) => [FIELD_MAP[k] || k, v]));

  updates.updated_at = new Date().toISOString();
  try {
    const contentDb = supabaseAdmin.schema('content_module');
    const { data, error } = await contentDb.from('lessons').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('updateLesson error:', err);
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const contentDb = supabaseAdmin.schema('content_module');
    const { error } = await contentDb.from('lessons').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    console.error('deleteLesson error:', err);
    res.status(500).json({ error: 'Không thể xóa.' });
  }
};

// ── Vocabulary Import ─────────────────────────────────────────────────────────
exports.importVocab = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Dữ liệu phải là một mảng JSON không rỗng.' });
  if (rows.length > 500)
    return res.status(400).json({ error: 'Tối đa 500 từ mỗi lần nhập.' });

  const ALLOWED = ['kanji','reading','meaning_vi','meaning_ja','level','type','topic','example_sentence','lesson_id'];
  const LEVELS  = new Set(['N5','N4','N3','N2','N1']);
  const TYPES   = new Set(['DANH TỪ','ĐỘNG TỪ','TÍNH TỪ','PHÓ TỪ','LIÊN TỪ']);
  const errors  = [];
  const cleaned = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.reading)    errors.push(`Dòng ${n}: thiếu trường "reading".`);
    if (!row.meaning_vi) errors.push(`Dòng ${n}: thiếu trường "meaning_vi".`);
    if (row.level && !LEVELS.has(row.level))
      errors.push(`Dòng ${n}: level "${row.level}" không hợp lệ (N5/N4/N3/N2/N1).`);
    if (row.type && !TYPES.has(row.type))
      errors.push(`Dòng ${n}: type "${row.type}" không hợp lệ.`);
    const item = {};
    ALLOWED.forEach(k => { if (row[k] !== undefined) item[k] = row[k] || null; });
    cleaned.push(item);
  });

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join('\n• ');
    const suffix  = errors.length > 5 ? `\n... và ${errors.length - 5} lỗi khác.` : '';
    return res.status(400).json({ error: `Có ${errors.length} lỗi:\n• ${preview}${suffix}` });
  }

  try {
    const { data, error } = await supabaseAdmin.from('vocabulary').insert(cleaned).select('id');
    if (error) throw error;
    res.status(201).json({ imported: data.length, message: `Đã nhập ${data.length} từ vựng thành công.` });
  } catch (err) {
    console.error('Import vocab error:', err);
    res.status(500).json({ error: 'Không thể nhập từ vựng vào cơ sở dữ liệu.' });
  }
};

// ── Vocabulary CRUD ──────────────────────────────────────────────────────────
exports.listVocab = async (req, res) => {
  const { lesson_id, search, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    // Từ vựng trong một Mục được lấy qua bảng nối lesson_vocabulary (nhiều–nhiều).
    if (lesson_id) {
      const { data: links } = await contentDb.from('lesson_vocabulary')
        .select('vocabulary_id').eq('lesson_id', lesson_id);
      const ids = (links || []).map(l => l.vocabulary_id);
      if (ids.length === 0) return res.json({ data: [], total: 0 });
      const { data, error } = await supabaseAdmin.from('vocabulary')
        .select('*').in('id', ids).order('created_at', { ascending: true });
      if (error) throw error;
      return res.json({ data: data || [], total: data?.length || 0 });
    }

    let q = supabaseAdmin.from('vocabulary').select('*', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(offset, offset + Number(limit) - 1);
    if (search) q = q.or(`kanji.ilike.%${search}%,reading.ilike.%${search}%,meaning_vi.ilike.%${search}%`);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

exports.createVocab = async (req, res) => {
  const { kanji, reading, meaning_vi, meaning_ja, level, lesson_id, type, topic, example_sentence } = req.body;
  if (!reading || !meaning_vi) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary')
      .insert({ kanji, reading, meaning_vi, meaning_ja, level, lesson_id, type, topic, example_sentence })
      .select().single();
    if (error) throw error;
    // Gắn từ mới vào Mục qua bảng nối để hiển thị trong bài.
    if (lesson_id) {
      await contentDb.from('lesson_vocabulary')
        .upsert({ lesson_id, vocabulary_id: data.id }, { onConflict: 'lesson_id,vocabulary_id' });
    }
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo.' }); }
};

// Gắn nhiều từ vựng có sẵn vào một Mục (chọn từ list tổng).
exports.attachVocab = async (req, res) => {
  const { lessonId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Chưa chọn từ vựng nào.' });
  try {
    const rows = ids.map(vocabulary_id => ({ lesson_id: lessonId, vocabulary_id }));
    const { error } = await contentDb.from('lesson_vocabulary')
      .upsert(rows, { onConflict: 'lesson_id,vocabulary_id' });
    if (error) throw error;
    res.json({ message: `Đã thêm ${ids.length} từ vựng vào bài.` });
  } catch (err) { res.status(500).json({ error: 'Không thể thêm từ vựng.' }); }
};

// Gỡ một từ vựng khỏi Mục (không xóa từ gốc).
exports.detachVocab = async (req, res) => {
  const { lessonId, vocabId } = req.params;
  try {
    const { error } = await contentDb.from('lesson_vocabulary')
      .delete().eq('lesson_id', lessonId).eq('vocabulary_id', vocabId);
    if (error) throw error;
    res.json({ message: 'Đã gỡ khỏi bài.' });
  } catch (err) { res.status(500).json({ error: 'Không thể gỡ từ vựng.' }); }
};

exports.updateVocab = async (req, res) => {
  const allowed = ['kanji','reading','meaning_vi','meaning_ja','level','lesson_id','type','topic','example_sentence'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteVocab = async (req, res) => {
  try {
    await supabaseAdmin.from('vocabulary').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Kanji Import ──────────────────────────────────────────────────────────────
exports.importKanji = async (req, res) => {
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
    if (row.stroke_count !== undefined && row.stroke_count !== null && row.stroke_count !== '' && isNaN(Number(row.stroke_count)))
      errors.push(`Dòng ${n}: stroke_count phải là số nguyên.`);
    cleaned.push({
      character:    row.character,
      reading_on:   toArr(row.reading_on),
      reading_kun:  toArr(row.reading_kun),
      meaning_vi:   row.meaning_vi,
      stroke_count: row.stroke_count ? Number(row.stroke_count) : null,
      level:        row.level || null,
      han_viet:     row.han_viet || null,
    });
  });

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join('\n• ');
    const suffix  = errors.length > 5 ? `\n... và ${errors.length - 5} lỗi khác.` : '';
    return res.status(400).json({ error: `Có ${errors.length} lỗi:\n• ${preview}${suffix}` });
  }

  try {
    // INSTEAD OF trigger trên view tự upsert theo character (view không nhận ON CONFLICT)
    const { data, error } = await supabaseAdmin
      .from('kanji')
      .insert(cleaned)
      .select('id');
    if (error) throw error;
    res.status(201).json({ imported: data.length, message: `Đã nhập ${data.length} kanji thành công.` });
  } catch (err) {
    console.error('Import kanji error:', err);
    res.status(500).json({ error: 'Không thể nhập kanji vào cơ sở dữ liệu.' });
  }
};

// ── Kanji CRUD ───────────────────────────────────────────────────────────────
exports.listKanji = async (req, res) => {
  const { lesson_id, level, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    // Kanji trong một Mục được lấy qua bảng nối lesson_kanji (nhiều–nhiều).
    if (lesson_id) {
      const { data: links } = await contentDb.from('lesson_kanji')
        .select('kanji_id').eq('lesson_id', lesson_id);
      const ids = (links || []).map(l => l.kanji_id);
      if (ids.length === 0) return res.json({ data: [], total: 0 });
      const { data, error } = await supabaseAdmin.from('kanji')
        .select('*').in('id', ids).order('created_at', { ascending: true });
      if (error) throw error;
      return res.json({ data: data || [], total: data?.length || 0 });
    }

    let q = supabaseAdmin.from('kanji').select('*', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(offset, offset + Number(limit) - 1);
    if (level)     q = q.eq('level', level);
    if (search)    q = q.or(`character.ilike.%${search}%,meaning_vi.ilike.%${search}%,han_viet.ilike.%${search}%`);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tải kanji.' }); }
};

exports.createKanji = async (req, res) => {
  const { character, reading_on, reading_kun, meaning_vi, stroke_count, level, han_viet, lesson_id } = req.body;
  if (!character || !meaning_vi) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('kanji')
      .insert({ character, reading_on, reading_kun, meaning_vi, stroke_count, level, han_viet, lesson_id: lesson_id || null })
      .select().single();
    if (error) throw error;
    // Gắn kanji mới vào Mục qua bảng nối để hiển thị trong bài.
    if (lesson_id) {
      await contentDb.from('lesson_kanji')
        .upsert({ lesson_id, kanji_id: data.id }, { onConflict: 'lesson_id,kanji_id' });
    }
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể tạo.' }); }
};

// Gắn nhiều kanji có sẵn vào một Mục (chọn từ list tổng).
exports.attachKanji = async (req, res) => {
  const { lessonId } = req.params;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Chưa chọn kanji nào.' });
  try {
    const rows = ids.map(kanji_id => ({ lesson_id: lessonId, kanji_id }));
    const { error } = await contentDb.from('lesson_kanji')
      .upsert(rows, { onConflict: 'lesson_id,kanji_id' });
    if (error) throw error;
    res.json({ message: `Đã thêm ${ids.length} kanji vào bài.` });
  } catch (err) { res.status(500).json({ error: 'Không thể thêm kanji.' }); }
};

// Gỡ một kanji khỏi Mục (không xóa kanji gốc).
exports.detachKanji = async (req, res) => {
  const { lessonId, kanjiId } = req.params;
  try {
    const { error } = await contentDb.from('lesson_kanji')
      .delete().eq('lesson_id', lessonId).eq('kanji_id', kanjiId);
    if (error) throw error;
    res.json({ message: 'Đã gỡ khỏi bài.' });
  } catch (err) { res.status(500).json({ error: 'Không thể gỡ kanji.' }); }
};

exports.updateKanji = async (req, res) => {
  const allowed = ['character','reading_on','reading_kun','meaning_vi','stroke_count','level','han_viet','lesson_id'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('kanji').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteKanji = async (req, res) => {
  try {
    await supabaseAdmin.from('kanji').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Question Bank ─────────────────────────────────────────────────────────────
exports.listQuestionBank = async (req, res) => {
  const { level, skill, topic, difficulty, status, question_type, passage_id, listening_passage_id, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.from('question_bank')
      .select('*, reading_passages(id, title), listening_passages(id, title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)               query = query.eq('level', level);
    if (skill)               query = query.eq('skill', skill);
    if (topic)               query = query.ilike('topic', `%${topic}%`);
    if (difficulty)          query = query.eq('difficulty', difficulty);
    if (status)              query = query.eq('status', status);
    if (question_type)       query = query.eq('question_type', question_type);
    if (passage_id)          query = query.eq('passage_id', passage_id);
    if (listening_passage_id) query = query.eq('listening_passage_id', listening_passage_id);
    if (search)              query = query.ilike('question_text', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải câu hỏi.' });
  }
};

exports.questionBankStats = async (req, res) => {
  try {
    const [total, pending, byLevel] = await Promise.all([
      supabaseAdmin.from('question_bank').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('question_bank').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('question_bank').select('level').not('level', 'is', null),
    ]);
    const levelCounts = {};
    (byLevel.data || []).forEach(r => { levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });
    const topLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    res.json({ total: total.count || 0, pending: pending.count || 0, topLevel });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải thống kê.' });
  }
};

exports.createQuestionBank = async (req, res) => {
  const { question_text, options, correct_answer, explanation, level, skill, topic, difficulty, status, is_ai_generated, question_type, passage_id, listening_passage_id } = req.body;
  if (!question_text) return res.status(400).json({ error: 'Nội dung câu hỏi là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('question_bank')
      .insert({ question_text, options: options ?? [], correct_answer, explanation, level, skill, topic, difficulty: difficulty || 'medium', status: 'approved', is_ai_generated: !!is_ai_generated, question_type: question_type || 'single_choice', passage_id: passage_id || null, listening_passage_id: listening_passage_id || null, created_by: req.user?.id })
      .select('*, reading_passages(id, title), listening_passages(id, title)').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestionBank = async (req, res) => {
  const allowed = ['question_text','options','correct_answer','explanation','level','skill','topic','difficulty','status','is_ai_generated','question_type','passage_id','listening_passage_id'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('passage_id' in updates && !updates.passage_id) updates.passage_id = null;
  if ('listening_passage_id' in updates && !updates.listening_passage_id) updates.listening_passage_id = null;
  try {
    const { data, error } = await supabaseAdmin.from('question_bank').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.bulkCreateQuestionBank = async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'Danh sách câu hỏi không được rỗng.' });
  try {
    const rows = questions.map(q => ({
      question_text:  q.question_text,
      question_type:  q.question_type || 'single_choice',
      options:        q.options ?? [],
      correct_answer: q.correct_answer ?? null,
      explanation:    q.explanation   || null,
      level:          q.level         || null,
      skill:          q.skill         || null,
      topic:          q.topic         || null,
      difficulty:     q.difficulty    || 'medium',
      status:         'approved',
      is_ai_generated: true,
      passage_id:           q.passage_id           || null,
      listening_passage_id: q.listening_passage_id || null,
      created_by:           req.user?.id,
    }));
    const { data, error } = await supabaseAdmin.from('question_bank').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { res.status(500).json({ error: 'Không thể lưu câu hỏi.' }); }
};

exports.aiGenerateQuestions = async (req, res) => {
  const { generateQuestions } = require('../utils/questionGen');
  const {
    passage_id, listening_passage_id, custom_content,
    question_types = ['single_choice'],
    count = 5, level, difficulty = 'medium', topic, skill,
  } = req.body;

  if (!passage_id && !listening_passage_id && !custom_content)
    return res.status(400).json({ error: 'Cần cung cấp bài đọc, bài nghe, hoặc nội dung tự do.' });
  if (!Array.isArray(question_types) || !question_types.length)
    return res.status(400).json({ error: 'Chọn ít nhất 1 loại câu hỏi.' });

  let contentText = custom_content || '';
  let passageTitle = '';
  let skillHint = '';

  if (passage_id) {
    const { data: passage, error } = await supabaseAdmin
      .from('reading_passages').select('title, content, image_url').eq('id', passage_id).single();
    if (error || !passage) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    passageTitle = passage.title || '';
    contentText  = passage.content || '';
    if (!contentText && passage.image_url)
      contentText = `[Bài đọc dạng hình ảnh: ${passageTitle}]`;
    skillHint = 'Đây là câu hỏi ĐỌC HIỂU (reading). Tạo câu hỏi kiểm tra khả năng đọc hiểu nội dung.';
  }

  if (listening_passage_id) {
    const { data: lp, error } = await supabaseAdmin
      .from('listening_passages').select('title, transcript, description').eq('id', listening_passage_id).single();
    if (error || !lp) return res.status(404).json({ error: 'Không tìm thấy bài nghe.' });
    passageTitle = lp.title || '';
    contentText  = lp.transcript || lp.description || '';
    if (!contentText) contentText = `[Bài nghe: ${passageTitle}]`;
    skillHint = 'Đây là câu hỏi NGHE HIỂU (listening). Tạo câu hỏi kiểm tra khả năng nghe hiểu. Câu hỏi nên tập trung vào ý chính, chi tiết cụ thể, suy luận từ nội dung nghe.';
  }

  if (!contentText.trim())
    return res.status(400).json({ error: 'Nội dung bài đọc/nghe trống.' });

  try {
    const { questions, usage } = await generateQuestions({
      contentText, passageTitle, question_types, count, level, difficulty, topic, skill, passage_id,
    });
    const final = listening_passage_id
      ? questions.map(q => ({ ...q, listening_passage_id }))
      : questions;
    res.json({ questions: final, count: final.length, usage });
  } catch (err) {
    res.status(err.httpStatus || 502).json({ error: err.message, ...(err.raw ? { raw: err.raw } : {}) });
  }
};

exports.deleteQuestionBank = async (req, res) => {
  try {
    await supabaseAdmin.from('question_bank').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Reading Passages ──────────────────────────────────────────────────────────
exports.uploadPassageImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error } = await supabaseAdmin.storage
      .from('passage-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('passage-images').getPublicUrl(filename);
    res.json({ url: publicUrl });
  } catch (err) { res.status(500).json({ error: 'Không thể tải ảnh lên.' }); }
};

exports.listPassages = async (req, res) => {
  try {
    const { data: passages, error } = await supabaseAdmin
      .from('reading_passages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // question count per passage
    const { data: links } = await supabaseAdmin
      .from('question_bank')
      .select('passage_id')
      .not('passage_id', 'is', null);
    const countMap = {};
    (links || []).forEach(r => { countMap[r.passage_id] = (countMap[r.passage_id] || 0) + 1; });

    res.json((passages || []).map(p => ({ ...p, question_count: countMap[p.id] || 0 })));
  } catch (err) { res.status(500).json({ error: 'Không thể tải bài đọc.' }); }
};

exports.createPassage = async (req, res) => {
  const { title, content, image_url, level, topic, source } = req.body;
  if (!content?.trim() && !image_url) return res.status(400).json({ error: 'Bài đọc phải có nội dung text hoặc hình ảnh.' });
  try {
    const { data, error } = await supabaseAdmin.from('reading_passages')
      .insert({ title, content: content || null, image_url: image_url || null, level, topic, source, created_by: req.user?.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, question_count: 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài đọc.' }); }
};

exports.updatePassage = async (req, res) => {
  const allowed = ['title', 'content', 'image_url', 'level', 'topic', 'source'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('image_url' in updates && !updates.image_url) updates.image_url = null;
  if ('content'   in updates && !updates.content)   updates.content   = null;
  try {
    const { data, error } = await supabaseAdmin.from('reading_passages')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài đọc.' }); }
};

exports.deletePassage = async (req, res) => {
  try {
    const { data: p } = await supabaseAdmin.from('reading_passages').select('image_url').eq('id', req.params.id).single();
    await supabaseAdmin.from('question_bank').update({ passage_id: null }).eq('passage_id', req.params.id);
    await supabaseAdmin.from('reading_passages').delete().eq('id', req.params.id);
    // clean up storage file if present
    if (p?.image_url) {
      const filename = p.image_url.split('/').pop();
      await supabaseAdmin.storage.from('passage-images').remove([filename]);
    }
    res.json({ message: 'Đã xóa bài đọc.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài đọc.' }); }
};

// ── Listening Passages ────────────────────────────────────────────────────────
exports.uploadListeningAudio = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || 'mp3').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error } = await supabaseAdmin.storage
      .from('listening-passages-audio')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('listening-passages-audio').getPublicUrl(filename);
    res.json({ url: publicUrl });
  } catch (err) { res.status(500).json({ error: 'Không thể tải file âm thanh lên.' }); }
};

exports.listListeningPassages = async (req, res) => {
  try {
    const { data: passages, error } = await supabaseAdmin
      .from('listening_passages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: links } = await supabaseAdmin
      .from('question_bank')
      .select('listening_passage_id')
      .not('listening_passage_id', 'is', null);
    const countMap = {};
    (links || []).forEach(r => { countMap[r.listening_passage_id] = (countMap[r.listening_passage_id] || 0) + 1; });

    res.json((passages || []).map(p => ({ ...p, question_count: countMap[p.id] || 0 })));
  } catch (err) { res.status(500).json({ error: 'Không thể tải bài nghe.' }); }
};

exports.createListeningPassage = async (req, res) => {
  const { title, audio_url, transcript, description, level, topic, source, duration_sec } = req.body;
  if (!audio_url) return res.status(400).json({ error: 'Bài nghe phải có file âm thanh.' });
  try {
    const { data, error } = await supabaseAdmin.from('listening_passages')
      .insert({ title, audio_url, transcript: transcript || null, description: description || null, level, topic, source, duration_sec: duration_sec || null, created_by: req.user?.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, question_count: 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài nghe.' }); }
};

exports.updateListeningPassage = async (req, res) => {
  const allowed = ['title', 'audio_url', 'transcript', 'description', 'level', 'topic', 'source', 'duration_sec', 'transcript_segments'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('transcript'   in updates && !updates.transcript)   updates.transcript   = null;
  if ('description'  in updates && !updates.description)  updates.description  = null;
  if ('duration_sec' in updates && !updates.duration_sec) updates.duration_sec = null;
  try {
    const { data, error } = await supabaseAdmin.from('listening_passages')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài nghe.' }); }
};

exports.transcribeListeningPassage = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { whisperTranscribe } = require('../config/ai');
  const { analyzeSilence, extractAudioChunk, mergeIntoGroups } = require('../config/audio');
  const { language } = req.body;

  try {
    const { data: passage, error } = await supabaseAdmin
      .from('listening_passages').select('audio_url, title').eq('id', req.params.id).single();
    if (error || !passage) return res.status(404).json({ error: 'Không tìm thấy bài nghe.' });
    if (!passage.audio_url) return res.status(400).json({ error: 'Bài nghe chưa có file âm thanh.' });

    const audioRes = await fetch(passage.audio_url);
    if (!audioRes.ok) throw new Error('Không thể tải file âm thanh từ storage.');
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    const ext = (passage.audio_url.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
    const mimeMap = { mp3:'audio/mpeg', mp4:'audio/mp4', wav:'audio/wav', ogg:'audio/ogg', webm:'audio/webm', m4a:'audio/x-m4a', aac:'audio/aac' };
    const mimeType = mimeMap[ext] || 'audio/mpeg';
    const lang = language || 'ja';

    // Write audio once to a temp file — shared by VAD and chunk extraction
    const tmpFile = path.join(os.tmpdir(), `kn_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpFile, audioBuffer);

    let segments = [];
    let transcript = '';

    try {
      // Step 1: VAD / silencedetect — find speech boundaries (ignores background music)
      const { speechSegments, totalDuration } = await analyzeSilence(tmpFile, ext);

      // Step 2: merge nearby segments into utterance groups
      // gap ≤ 0.3s → same group; min 0.3s to keep short utterances; max 6s
      const groups = mergeIntoGroups(speechSegments, 0.3, 0.3, 6);
      console.log('[Transcribe]', groups.length, 'utterance groups / total', totalDuration, 's');

      // Step 3: transcribe each group individually — each chunk returns its own text
      // Process in batches of 3 to avoid rate-limit issues
      const BATCH = 3;
      for (let i = 0; i < groups.length; i += BATCH) {
        const batch = groups.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (g) => {
          const dur = g.end - g.start;
          const isHallucination = (text) => {
            if (!text) return false;
            const repetitive = /(.{2,})\1{4,}/.test(text);
            const tooLong = text.length > dur * 18; // ~18 chars/sec max for Japanese
            return repetitive || tooLong;
          };
          try {
            // First attempt: plain audio, no forced language (auto-detect per chunk)
            const chunk = await extractAudioChunk(tmpFile, g.start, dur);
            const r = await whisperTranscribe(chunk, 'chunk.mp3', 'audio/mpeg', null);
            const text = r.text?.trim();

            if (!isHallucination(text)) {
              return text ? { start: g.start, end: g.end, text } : null;
            }

            // Retry with voice band filter to reduce background music interference
            console.warn('[Transcribe] hallucination at', g.start, '-', g.end, '— retrying with voice filter');
            const chunk2 = await extractAudioChunk(tmpFile, g.start, dur, true);
            const r2 = await whisperTranscribe(chunk2, 'chunk.mp3', 'audio/mpeg', null);
            const text2 = r2.text?.trim();

            if (!text2 || isHallucination(text2)) {
              console.warn('[Transcribe] still hallucinating after filter, skipping', g.start, '-', g.end);
              return null;
            }
            return { start: g.start, end: g.end, text: text2 };
          } catch (e) {
            console.warn('[Transcribe] chunk', g.start, '-', g.end, 'failed:', e.message);
            return null;
          }
        }));
        segments.push(...results.filter(Boolean));
      }

      segments.sort((a, b) => a.start - b.start);
      transcript = segments.map(s => s.text).join(' ');
      console.log('[Transcribe] done:', segments.length, 'segments');

    } catch (audioErr) {
      console.warn('[Transcribe] segmented approach failed, falling back to single call:', audioErr.message);
      // Fallback: one Whisper call for the whole audio (no timestamps)
      const r = await whisperTranscribe(audioBuffer, `audio.${ext}`, mimeType, lang);
      transcript = r.text?.trim() || '';
      segments = [];
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    await supabaseAdmin.from('listening_passages').update({
      transcript_segments: segments.length > 0 ? segments : null,
      transcript,
      transcript_language: lang,
    }).eq('id', req.params.id);

    res.json({ segments, transcript, language: lang, count: segments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteListeningPassage = async (req, res) => {
  try {
    const { data: p } = await supabaseAdmin.from('listening_passages').select('audio_url').eq('id', req.params.id).single();
    await supabaseAdmin.from('question_bank').update({ listening_passage_id: null }).eq('listening_passage_id', req.params.id);
    await supabaseAdmin.from('listening_passages').delete().eq('id', req.params.id);
    if (p?.audio_url) {
      const filename = p.audio_url.split('/').pop();
      await supabaseAdmin.storage.from('listening-passages-audio').remove([filename]);
    }
    res.json({ message: 'Đã xóa bài nghe.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài nghe.' }); }
};

// ── Content Submissions (teacher → system) ────────────────────────────────────
exports.listSubmissions = async (req, res) => {
  const { type, status = 'pending' } = req.query;
  try {
    const fetchType = async (table, kind) => {
      let q = supabaseAdmin.from(table).select('*').order('updated_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(r => ({ ...r, _kind: kind }));
    };
    let rows = [];
    if (!type || type === 'vocab') rows = rows.concat(await fetchType('teacher_vocabulary', 'vocab'));
    if (!type || type === 'kanji') rows = rows.concat(await fetchType('teacher_kanji', 'kanji'));

    // Enrich with teacher name
    const teacherIds = [...new Set(rows.map(r => r.teacher_id))];
    const { data: teachers } = await supabaseAdmin.from('users').select('id,full_name,email').in('id', teacherIds);
    const tMap = Object.fromEntries((teachers || []).map(t => [t.id, t]));
    rows = rows.map(r => ({ ...r, teacher: tMap[r.teacher_id] || { email: r.teacher_id } }));

    res.json(rows);
  } catch (err) {
    console.error('List submissions error:', err);
    res.status(500).json({ error: 'Không thể tải yêu cầu.' });
  }
};

exports.reviewVocab = async (req, res) => {
  const { action, note } = req.body; // action: 'approve' | 'reject'
  try {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('teacher_vocabulary').select('*').eq('id', req.params.id).single();
    if (fetchErr || !row) return res.status(404).json({ error: 'Không tìm thấy.' });

    if (action === 'approve') {
      const { error: insertErr } = await supabaseAdmin.from('vocabulary').insert({
        kanji: row.kanji, reading: row.reading, meaning_vi: row.meaning_vi,
        meaning_ja: row.meaning_ja, level: row.level, type: row.type,
        example_sentence: row.example_sentence,
      });
      if (insertErr) throw insertErr;
      await supabaseAdmin.from('teacher_vocabulary')
        .update({ status: 'approved', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã duyệt và thêm vào hệ thống.' });
    }
    if (action === 'reject') {
      await supabaseAdmin.from('teacher_vocabulary')
        .update({ status: 'rejected', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã từ chối.' });
    }
    res.status(400).json({ error: 'action phải là approve hoặc reject.' });
  } catch (err) {
    console.error('Review vocab error:', err);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu.' });
  }
};

exports.reviewKanji = async (req, res) => {
  const { action, note } = req.body;
  try {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('teacher_kanji').select('*').eq('id', req.params.id).single();
    if (fetchErr || !row) return res.status(404).json({ error: 'Không tìm thấy.' });

    if (action === 'approve') {
      const { error: insertErr } = await supabaseAdmin.from('kanji').upsert({
        character: row.character, reading_on: row.reading_on, reading_kun: row.reading_kun,
        meaning_vi: row.meaning_vi, stroke_count: row.stroke_count, level: row.level,
      }, { onConflict: 'character' });
      if (insertErr) throw insertErr;
      await supabaseAdmin.from('teacher_kanji')
        .update({ status: 'approved', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã duyệt và thêm vào hệ thống.' });
    }
    if (action === 'reject') {
      await supabaseAdmin.from('teacher_kanji')
        .update({ status: 'rejected', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã từ chối.' });
    }
    res.status(400).json({ error: 'action phải là approve hoặc reject.' });
  } catch (err) {
    console.error('Review kanji error:', err);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu.' });
  }
};

// ── Quizzes CRUD ─────────────────────────────────────────────────────────────
exports.listQuizzes = async (req, res) => {
  const { lesson_id, course_id, page, limit = 20 } = req.query;
  try {
    // Admin thấy MỌI quiz (cả nháp lẫn đã xuất bản), khác endpoint public /quizzes
    let q = examDb.from('quizzes').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (lesson_id) q = q.eq('lesson_id', lesson_id);
    if (course_id) q = q.eq('course_id', course_id);
    if (page) {
      const offset = (Number(page) - 1) * Number(limit);
      q = q.range(offset, offset + Number(limit) - 1);
    }
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0, page: Number(page) || 1, limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: 'Không thể tải danh sách quiz.' }); }
};

exports.createQuiz = async (req, res) => {
  const { title, title_ja, description, course_id, lesson_id, type, time_limit, mode } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  try {
    const { data, error } = await examDb.from('quizzes')
      .insert({ title, title_ja, description, course_id, lesson_id, type: type || 'multiple_choice', time_limit,
                mode: mode === 'proctored' ? 'proctored' : 'normal' })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message || 'Không thể tạo quiz.' }); }
};

exports.updateQuiz = async (req, res) => {
  const allowed = ['title','title_ja','description','course_id','lesson_id','type','time_limit','is_published','mode'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await examDb.from('quizzes').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteQuiz = async (req, res) => {
  try {
    await examDb.from('quizzes').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// Get all questions for a quiz (admin, ignores is_published)
exports.listQuizQuestions = async (req, res) => {
  try {
    const { data, error } = await examDb
      .from('quiz_questions')
      .select('id,question,options,correct_answer,correct_answer_data,question_type,bank_question_id,explanation,order_index')
      .eq('quiz_id', req.params.quizId)
      .order('order_index');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Không thể tải câu hỏi.' }); }
};

// ── Quiz Questions CRUD ──────────────────────────────────────────────────────
exports.createQuestion = async (req, res) => {
  const {
    quiz_id, question, options, correct_answer, correct_answer_data,
    explanation, order_index, question_type, bank_question_id,
  } = req.body;
  if (!quiz_id) return res.status(400).json({ error: 'Thiếu quiz_id.' });
  const typ = question_type || 'single_choice';
  const needsText = !bank_question_id;
  if (needsText && !question) return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  try {
    const { data, error } = await examDb.from('quiz_questions')
      .insert({
        quiz_id,
        question:             question || null,
        options:              options  || null,
        correct_answer:       correct_answer || null,
        correct_answer_data:  correct_answer_data || null,
        explanation:          explanation || null,
        order_index:          order_index ?? 0,
        question_type:        typ,
        bank_question_id:     bank_question_id || null,
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestion = async (req, res) => {
  const allowed = [
    'question','options','correct_answer','correct_answer_data',
    'explanation','order_index','question_type','bank_question_id',
  ];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await examDb.from('quiz_questions').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    await examDb.from('quiz_questions').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// Import multiple questions from question bank into a quiz
exports.importFromBank = async (req, res) => {
  const { quizId } = req.params;
  const { question_ids } = req.body; // array of question_bank IDs
  if (!Array.isArray(question_ids) || !question_ids.length)
    return res.status(400).json({ error: 'Không có câu hỏi được chọn.' });
  try {
    // Fetch max order_index for this quiz
    const { data: existing } = await examDb
      .from('quiz_questions').select('order_index').eq('quiz_id', quizId).order('order_index', { ascending: false }).limit(1);
    let nextIdx = existing && existing.length ? (existing[0].order_index + 1) : 0;

    // Fetch bank rows
    const { data: bankRows, error: fetchErr } = await supabaseAdmin
      .from('question_bank').select('*').in('id', question_ids);
    if (fetchErr) throw fetchErr;

    const rows = bankRows.map((bq, i) => ({
      quiz_id:            quizId,
      bank_question_id:   bq.id,
      question_type:      bq.question_type || 'single_choice',
      question:           bq.question_text,
      options:            bq.options,
      correct_answer:     typeof bq.correct_answer === 'string' ? bq.correct_answer : null,
      correct_answer_data: typeof bq.correct_answer !== 'string' ? bq.correct_answer : null,
      explanation:        bq.explanation || null,
      order_index:        nextIdx + i,
    }));

    const { data, error } = await examDb.from('quiz_questions').insert(rows).select();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể nhập câu hỏi.' }); }
};

// GET /api/admin/quizzes/:quizId/attempts — danh sách bài làm + dữ liệu giám sát
exports.listQuizAttempts = async (req, res) => {
  try {
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
    console.error('List quiz attempts error:', err);
    res.status(500).json({ error: 'Không thể tải bài làm.' });
  }
};
