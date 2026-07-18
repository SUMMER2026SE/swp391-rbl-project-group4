'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/vocabulary
exports.list = async (req, res) => {
  const { level, lesson_id, search, topic, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from('vocabulary')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)     query = query.eq('level', level);
    if (lesson_id) query = query.eq('lesson_id', lesson_id);
    if (topic)     query = query.eq('topic', topic);
    if (search) {
      const safe = String(search).replace(/[,()%*]/g, ' ').trim();
      if (safe) query = query.or(`kanji.ilike.%${safe}%,reading.ilike.%${safe}%,meaning_vi.ilike.%${safe}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Gắn tên giáo viên tạo (nếu có) — để phân biệt ai sửa được cái nào.
    const creatorIds = [...new Set((data || []).map(v => v.created_by).filter(Boolean))];
    const creatorMap = {};
    if (creatorIds.length) {
      const { data: creators } = await supabaseAdmin.from('users').select('id,full_name').in('id', creatorIds);
      (creators || []).forEach(u => { creatorMap[u.id] = u.full_name; });
    }
    const enriched = (data || []).map(v => ({ ...v, creator_name: v.created_by ? (creatorMap[v.created_by] || null) : null }));

    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) });
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
