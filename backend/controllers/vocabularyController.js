'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/vocabulary
exports.list = async (req, res) => {
  const { level, lesson_id, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from('vocabulary')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)     query = query.eq('level', level);
    if (lesson_id) query = query.eq('lesson_id', lesson_id);
    if (search)    query = query.or(`kanji.ilike.%${search}%,reading.ilike.%${search}%,meaning_vi.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List vocab error:', err);
    res.status(500).json({ error: 'Không thể tải từ vựng.' });
  }
};

// GET /api/vocabulary/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};
