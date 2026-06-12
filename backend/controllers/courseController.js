'use strict';

const { supabaseAdmin } = require('../config/supabase');

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

    const [{ data: modules }, { data: lessons }] = await Promise.all([
      supabaseAdmin.from('modules').select('id,title,order_index')
        .eq('course_id', req.params.id).order('order_index'),
      supabaseAdmin.from('lessons').select('id,title,title_ja,order_index,module_id,lesson_type')
        .eq('course_id', req.params.id).order('order_index'),
    ]);

    const allLessons = lessons || [];
    const allModules = (modules || []).map(m => ({
      ...m,
      lessons: allLessons.filter(l => l.module_id === m.id),
    }));
    const unassigned = allLessons.filter(l => !l.module_id);

    res.json({ ...course, modules: allModules, lessons: unassigned });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ error: 'Không thể tải khóa học.' });
  }
};
