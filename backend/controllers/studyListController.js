'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Bảng nguồn tương ứng mỗi list_type — không có FK cứng ở DB vì item_id có thể trỏ
// tới 1 trong 3 bảng này, validate ở đây thay vì ở tầng DB.
const TABLE_BY_TYPE = { vocabulary: 'vocabulary', kanji: 'kanji', grammar: 'grammar_points' };
const LIST_TYPES = Object.keys(TABLE_BY_TYPE);
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

// GET /api/study-lists?type=&level=&sort=newest|popular&search=&page=&limit=
exports.list = async (req, res) => {
  const { type, level, sort = 'newest', search, mine } = req.query;
  if (!LIST_TYPES.includes(type)) return res.status(400).json({ error: 'type phải là vocabulary, kanji hoặc grammar.' });

  const p   = Math.max(1, Number(req.query.page) || 1);
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (p - 1) * lim;

  try {
    let query = supabaseAdmin.from('study_list_posts')
      .select('*', { count: 'exact' })
      .eq('list_type', type);

    if (level) query = query.eq('level', level);

    // mine=true — chỉ giáo viên/admin xem bài đăng của chính mình (trang quản lý)
    if (mine === 'true' && req.user) query = query.eq('created_by', req.user.id);

    const safe = search ? String(search).replace(/[,()%*]/g, ' ').trim() : '';
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);

    const sortCol = sort === 'popular' ? 'view_count' : 'created_at';
    query = query.order(sortCol, { ascending: false }).range(offset, offset + lim - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const posts = data || [];
    const ids = posts.map(p => p.id);
    const teacherIds = [...new Set(posts.filter(p => p.creator_type !== 'admin').map(p => p.created_by))];

    const [itemRows, creatorRows] = await Promise.all([
      ids.length ? supabaseAdmin.from('study_list_items').select('post_id').in('post_id', ids) : Promise.resolve({ data: [] }),
      teacherIds.length ? supabaseAdmin.from('users').select('id,full_name').in('id', teacherIds) : Promise.resolve({ data: [] }),
    ]);

    const itemCount = {};
    (itemRows.data || []).forEach(r => { itemCount[r.post_id] = (itemCount[r.post_id] || 0) + 1; });
    const creatorMap = Object.fromEntries((creatorRows.data || []).map(u => [u.id, u.full_name]));

    const result = posts.map(post => ({
      ...post,
      item_count: itemCount[post.id] || 0,
      creator_name: post.creator_type === 'admin' ? 'Kizuna Nihongo' : (creatorMap[post.created_by] || null),
    }));

    res.json({ data: result, total: count, page: p, limit: lim });
  } catch (err) {
    console.error('studyList.list:', err);
    res.status(500).json({ error: 'Không thể tải danh sách.' });
  }
};

// GET /api/study-lists/:id
exports.getOne = async (req, res) => {
  try {
    const { data: post, error } = await supabaseAdmin.from('study_list_posts').select('*').eq('id', req.params.id).single();
    if (error || !post) return res.status(404).json({ error: 'Không tìm thấy.' });

    const { data: itemRows } = await supabaseAdmin.from('study_list_items')
      .select('item_id,sort_order').eq('post_id', post.id).order('sort_order', { ascending: true });

    const itemIds = (itemRows || []).map(r => r.item_id);
    const table = TABLE_BY_TYPE[post.list_type];
    const [{ data: items }, { data: creatorRows }] = await Promise.all([
      itemIds.length ? supabaseAdmin.from(table).select('*').in('id', itemIds) : Promise.resolve({ data: [] }),
      post.creator_type !== 'admin'
        ? supabaseAdmin.from('users').select('full_name').eq('id', post.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const itemMap = Object.fromEntries((items || []).map(i => [i.id, i]));
    const orderedItems = itemIds.map(id => itemMap[id]).filter(Boolean);
    const creator_name = post.creator_type === 'admin' ? 'Kizuna Nihongo' : (creatorRows?.full_name || null);

    // Tăng view_count — không cần dedup, mỗi lượt xem trang chi tiết tính 1 view.
    // Trừ chính chủ (giáo viên/admin mở modal "Quản lý mục" của bài đăng mình tạo).
    const isOwnerViewing = req.user && req.user.id === post.created_by;
    if (!isOwnerViewing) {
      supabaseAdmin.from('study_list_posts').update({ view_count: post.view_count + 1 }).eq('id', post.id)
        .then(({ error }) => { if (error) console.error('studyList view_count bump:', error); });
    }

    res.json({ ...post, view_count: post.view_count + (isOwnerViewing ? 0 : 1), items: orderedItems, creator_name });
  } catch (err) {
    console.error('studyList.getOne:', err);
    res.status(500).json({ error: 'Không thể tải bài đăng.' });
  }
};

// POST /api/study-lists  { list_type, title, description, level }
exports.create = async (req, res) => {
  const { list_type, title, description, level } = req.body;
  if (!LIST_TYPES.includes(list_type)) return res.status(400).json({ error: 'list_type phải là vocabulary, kanji hoặc grammar.' });
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc.' });
  if (!LEVELS.includes(level)) return res.status(400).json({ error: 'level phải là N5, N4, N3, N2 hoặc N1.' });

  const creator_type = req.user.user_metadata?.role === 'admin' ? 'admin' : 'teacher';
  try {
    const { data, error } = await supabaseAdmin.from('study_list_posts')
      .insert({ list_type, title: title.trim(), description: description || null, level, creator_type, created_by: req.user.id })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('studyList.create:', err);
    res.status(500).json({ error: 'Không thể tạo bài đăng.' });
  }
};

async function loadOwnedPost(id, user) {
  const { data: post } = await supabaseAdmin.from('study_list_posts').select('*').eq('id', id).single();
  if (!post) return { post: null, allowed: false };
  const allowed = post.created_by === user.id || user.user_metadata?.role === 'admin';
  return { post, allowed };
}

// PUT /api/study-lists/:id  { title, description }
exports.update = async (req, res) => {
  try {
    const { post, allowed } = await loadOwnedPost(req.params.id, req.user);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy.' });
    if (!allowed) return res.status(403).json({ error: 'Bạn không có quyền sửa bài đăng này.' });

    if (req.body.level !== undefined && !LEVELS.includes(req.body.level))
      return res.status(400).json({ error: 'level phải là N5, N4, N3, N2 hoặc N1.' });

    const allowedFields = ['title', 'description', 'level'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowedFields.includes(k)));
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from('study_list_posts').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('studyList.update:', err);
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

// DELETE /api/study-lists/:id
exports.remove = async (req, res) => {
  try {
    const { post, allowed } = await loadOwnedPost(req.params.id, req.user);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy.' });
    if (!allowed) return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này.' });

    await supabaseAdmin.from('study_list_posts').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    console.error('studyList.remove:', err);
    res.status(500).json({ error: 'Không thể xóa.' });
  }
};

// POST /api/study-lists/:id/items  { item_id }
exports.addItem = async (req, res) => {
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id là bắt buộc.' });
  try {
    const { post, allowed } = await loadOwnedPost(req.params.id, req.user);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy.' });
    if (!allowed) return res.status(403).json({ error: 'Bạn không có quyền sửa bài đăng này.' });

    const table = TABLE_BY_TYPE[post.list_type];
    const { data: exists } = await supabaseAdmin.from(table).select('id').eq('id', item_id).maybeSingle();
    if (!exists) return res.status(400).json({ error: 'item_id không tồn tại.' });

    const { count } = await supabaseAdmin.from('study_list_items').select('id', { count: 'exact', head: true }).eq('post_id', post.id);

    const { data, error } = await supabaseAdmin.from('study_list_items')
      .insert({ post_id: post.id, item_id, sort_order: count || 0 })
      .select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Mục này đã có trong danh sách.' });
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('studyList.addItem:', err);
    res.status(500).json({ error: 'Không thể thêm mục.' });
  }
};

// DELETE /api/study-lists/:id/items/:itemId
exports.removeItem = async (req, res) => {
  try {
    const { post, allowed } = await loadOwnedPost(req.params.id, req.user);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy.' });
    if (!allowed) return res.status(403).json({ error: 'Bạn không có quyền sửa bài đăng này.' });

    await supabaseAdmin.from('study_list_items').delete().eq('post_id', post.id).eq('item_id', req.params.itemId);
    res.json({ message: 'Đã xóa mục.' });
  } catch (err) {
    console.error('studyList.removeItem:', err);
    res.status(500).json({ error: 'Không thể xóa mục.' });
  }
};
