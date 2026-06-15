'use strict';

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('content_module');

// GET /api/courses
exports.list = async (req, res) => {
  const { level, search, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from('courses')
      .select('id,title,title_ja,description,level,thumbnail_url,is_published,created_at', { count: 'exact' })
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level) query = query.eq('level', level);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List courses error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách khóa học.' });
  }
};

// GET /api/courses/:id
exports.getOne = async (req, res) => {
  try {
    const { data: course, error } = await supabaseAdmin
      .from('courses').select('*').eq('id', req.params.id).eq('is_published', true).single();
    if (error || !course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });

    const [{ data: units }, { data: items }] = await Promise.all([
      contentDb.from('units').select('id,title,title_ja,sort_order')
        .eq('course_id', req.params.id).order('sort_order'),
      supabaseAdmin.from('lessons')
        .select('id,unit_id,title,title_ja,lesson_type,order_index,duration_minutes,question_count')
        .eq('course_id', req.params.id).order('order_index'),
    ]);

    const allItems = items || [];
    const itemIds = allItems.map(i => i.id);

    // Tiến độ của học viên hiện tại
    let completedSet = new Set();
    if (itemIds.length) {
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

    res.json({ ...course, units: unitsWithItems, progress_pct });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ error: 'Không thể tải khóa học.' });
  }
};
