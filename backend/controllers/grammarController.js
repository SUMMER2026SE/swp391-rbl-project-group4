'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/grammar?level=N5&search=&page=1&limit=20
exports.list = async (req, res) => {
  const { level, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabaseAdmin
      .from('lessons')
      .select('id, title, title_ja, content, course_id, courses(id, title, level)')
      .eq('lesson_type', 'grammar')
      .eq('is_published', true)
      .order('order_index');

    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by level in JS (avoid Supabase join-filter complexity)
    const all = level
      ? (data || []).filter(l => l.courses?.level === level)
      : (data || []);

    const total = all.length;
    const paged = all.slice(offset, offset + Number(limit));

    res.json({ data: paged, total });
  } catch (err) {
    console.error('Grammar list error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách ngữ pháp.' });
  }
};

// GET /api/grammar/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('lessons')
      .select('id, title, title_ja, content, courses(id, title, level)')
      .eq('id', req.params.id)
      .eq('lesson_type', 'grammar')
      .eq('is_published', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài ngữ pháp.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải bài ngữ pháp.' });
  }
};
