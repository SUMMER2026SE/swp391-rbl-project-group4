'use strict';

const { supabaseAdmin } = require('../config/supabase');

const langDb = supabaseAdmin.schema('language_module');

// GET /api/grammar-points
exports.list = async (req, res) => {
  const { level, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = langDb.from('grammar_points')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level) query = query.eq('level', level);
    if (search) {
      const safe = String(search).replace(/[,()%*]/g, ' ').trim();
      if (safe) query = query.or(`title.ilike.%${safe}%,meaning_vi.ilike.%${safe}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Gắn tên giáo viên tạo (nếu có) — để phân biệt ai sửa được cái nào.
    const creatorIds = [...new Set((data || []).map(g => g.created_by).filter(Boolean))];
    const creatorMap = {};
    if (creatorIds.length) {
      const { data: creators } = await supabaseAdmin.from('users').select('id,full_name').in('id', creatorIds);
      (creators || []).forEach(u => { creatorMap[u.id] = u.full_name; });
    }
    const enriched = (data || []).map(g => ({ ...g, creator_name: g.created_by ? (creatorMap[g.created_by] || null) : null }));

    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List grammar points error:', err);
    res.status(500).json({ error: 'Không thể tải ngữ pháp.' });
  }
};

// GET /api/grammar-points/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await langDb.from('grammar_points').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};
