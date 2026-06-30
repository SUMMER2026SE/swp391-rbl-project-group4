'use strict';

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('content_module');

// Cột mới (giá / đánh giá / phân loại) nằm ở bảng gốc content_module.courses — view
// compat public.courses chưa expose. Không trả commission_rate ra ngoài (số liệu nội bộ).
const PUBLIC_NEW_FIELDS = 'is_free,price,creator_type,enrollment_count,avg_rating,difficulty_level,reference_curriculum';

// GET /api/courses
exports.list = async (req, res) => {
  const { level, difficulty, is_free, sort = 'newest', search, page = 1, limit = 12 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    // Lọc theo cấp JLPT (level dạng chữ) qua view compat để khỏi map jlpt_level_id thủ công.
    let levelIds = null;
    if (level) {
      const { data: lv } = await supabaseAdmin.from('courses')
        .select('id').eq('is_published', true).eq('level', level);
      levelIds = (lv || []).map(r => r.id);
      if (levelIds.length === 0)
        return res.json({ data: [], total: 0, page: Number(page), limit: Number(limit) });
    }

    let query = contentDb.from('courses')
      .select(`id,title,title_ja,description,jlpt_level_id,thumbnail_url,is_published,created_by,created_at,${PUBLIC_NEW_FIELDS}`, { count: 'exact' })
      .eq('is_published', true);

    if (levelIds)              query = query.in('id', levelIds);
    if (difficulty)            query = query.eq('difficulty_level', difficulty);
    if (is_free !== undefined) query = query.eq('is_free', is_free === 'true');
    if (search)                query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const sortCol = sort === 'popular' ? 'enrollment_count'
                  : sort === 'rating'  ? 'avg_rating'
                  : 'created_at';
    query = query.order(sortCol, { ascending: false }).range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const courses = data || [];
    const ids = courses.map(c => c.id);
    const teacherIds = [...new Set(courses.filter(c => c.creator_type !== 'admin').map(c => c.created_by).filter(Boolean))];

    // Bổ sung: level (chữ) từ view compat, review_count, tên người tạo, is_enrolled.
    const [levelRows, reviewRows, creatorRows, enrolledRows] = await Promise.all([
      ids.length ? supabaseAdmin.from('courses').select('id,level').in('id', ids) : Promise.resolve({ data: [] }),
      ids.length ? contentDb.from('course_reviews').select('course_id').in('course_id', ids) : Promise.resolve({ data: [] }),
      teacherIds.length ? supabaseAdmin.from('users').select('id,full_name').in('id', teacherIds) : Promise.resolve({ data: [] }),
      (req.user && ids.length)
        ? contentDb.from('course_enrollments').select('course_id').eq('student_id', req.user.id).in('course_id', ids)
        : Promise.resolve({ data: [] }),
    ]);

    const levelMap = Object.fromEntries((levelRows.data || []).map(r => [r.id, r.level]));
    const reviewCount = {};
    (reviewRows.data || []).forEach(r => { reviewCount[r.course_id] = (reviewCount[r.course_id] || 0) + 1; });
    const creatorMap = Object.fromEntries((creatorRows.data || []).map(u => [u.id, u.full_name]));
    const enrolledSet = new Set((enrolledRows.data || []).map(e => e.course_id));

    const result = courses.map(c => ({
      ...c,
      level: levelMap[c.id] || null,
      review_count: reviewCount[c.id] || 0,
      is_enrolled: enrolledSet.has(c.id),
      creator_name: c.creator_type === 'admin' ? 'Kizuna Nihongo' : (creatorMap[c.created_by] || null),
    }));

    res.json({ data: result, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List courses error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách khóa học.' });
  }
};

// GET /api/courses/:id  (optionalAuth — khách xem được metadata, không có tiến độ)
exports.getOne = async (req, res) => {
  try {
    const { data: course, error } = await supabaseAdmin
      .from('courses').select('*').eq('id', req.params.id).eq('is_published', true).single();
    if (error || !course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });

    // Cột giá/đánh giá nằm ở bảng gốc content_module (view public.courses chưa có).
    const { data: extra } = await contentDb.from('courses')
      .select(PUBLIC_NEW_FIELDS).eq('id', req.params.id).single();

    const [{ data: units }, { data: items }] = await Promise.all([
      contentDb.from('units').select('id,title,title_ja,sort_order')
        .eq('course_id', req.params.id).order('sort_order'),
      supabaseAdmin.from('lessons')
        .select('id,unit_id,title,title_ja,lesson_type,order_index,duration_minutes,question_count')
        .eq('course_id', req.params.id).order('order_index'),
    ]);

    const allItems = items || [];
    const itemIds = allItems.map(i => i.id);

    // Tiến độ học viên hiện tại — chỉ khi đã đăng nhập (khách không có req.user).
    let completedSet = new Set();
    if (req.user && itemIds.length) {
      const { data: prog } = await contentDb.from('lesson_progress')
        .select('lesson_id').eq('student_id', req.user.id).eq('status', 'completed')
        .in('lesson_id', itemIds);
      completedSet = new Set((prog || []).map(p => p.lesson_id));
    }

    const itemsWithStatus = allItems.map(i => ({ ...i, completed: completedSet.has(i.id) }));
    const unitsWithItems = (units || []).map(u => ({
      ...u,
      lessons: itemsWithStatus.filter(i => i.unit_id === u.id),
    }));
    const progress_pct = itemIds.length ? Math.round((completedSet.size / itemIds.length) * 100) : 0;

    // Đã đăng ký khóa này chưa (khi đã đăng nhập).
    let is_enrolled = false;
    if (req.user) {
      const { data: enr } = await contentDb.from('course_enrollments')
        .select('id').eq('course_id', req.params.id).eq('student_id', req.user.id).maybeSingle();
      is_enrolled = !!enr;
    }

    res.json({ ...course, ...(extra || {}), units: unitsWithItems, progress_pct, is_enrolled });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ error: 'Không thể tải khóa học.' });
  }
};
