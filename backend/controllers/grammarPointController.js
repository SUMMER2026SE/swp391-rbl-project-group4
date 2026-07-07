'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/grammar-points
exports.list = async (req, res) => {
  const { level, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from('grammar_points')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level) query = query.eq('level', level);
    if (search) query = query.or(`title.ilike.%${search}%,meaning_vi.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List grammar points error:', err);
    res.status(500).json({ error: 'Không thể tải ngữ pháp.' });
  }
};

// GET /api/grammar-points/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('grammar_points').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};
