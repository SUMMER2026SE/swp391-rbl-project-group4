'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Toàn bộ bảng flashcard nằm trong schema riêng flashcard_module — mọi truy vấn dùng client này
const fcDb = supabaseAdmin.schema('flashcard_module');

// ── Helper: kiểm quyền sở hữu set/folder ──────────────────────────────────────
// Trả về row nếu thuộc về user, ngược lại null (gọi nơi dùng để trả 404).
const ownSet = async (id, userId) => {
  const { data } = await fcDb.from('flashcard_sets')
    .select('id,title,description').eq('id', id).eq('owner_id', userId).single();
  return data || null;
};
const ownFolder = async (id, userId) => {
  const { data } = await fcDb.from('flashcard_folders')
    .select('id,name').eq('id', id).eq('owner_id', userId).single();
  return data || null;
};

// ── Lấy danh sách id thẻ thuộc 1 set ──────────────────────────────────────────
const cardIdsOfSet = async (setId) => {
  const { data, error } = await fcDb.from('flashcards').select('id').eq('set_id', setId);
  if (error) throw error;
  return (data || []).map(c => c.id);
};

// ─── SETS ─────────────────────────────────────────────────────────────────────

// GET /api/flashcards/sets
exports.listSets = async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: sets, error } = await fcDb.from('flashcard_sets')
      .select('id,title,description')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!sets.length) return res.json({ data: [] });

    const setIds = sets.map(s => s.id);
    const { data: cards, error: cErr } = await fcDb.from('flashcards')
      .select('id,set_id').in('set_id', setIds);
    if (cErr) throw cErr;

    // map card_id → set_id để quy đổi progress về từng set
    const cardToSet = new Map(cards.map(c => [c.id, c.set_id]));
    const cardCount = {};
    cards.forEach(c => { cardCount[c.set_id] = (cardCount[c.set_id] || 0) + 1; });

    const masteredCount = {};
    if (cards.length) {
      const { data: prog, error: pErr } = await fcDb.from('flashcard_progress')
        .select('card_id')
        .eq('student_id', userId)
        .eq('status', 'mastered')
        .in('card_id', cards.map(c => c.id));
      if (pErr) throw pErr;
      prog.forEach(p => {
        const sid = cardToSet.get(p.card_id);
        if (sid) masteredCount[sid] = (masteredCount[sid] || 0) + 1;
      });
    }

    const data = sets.map(s => ({
      ...s,
      card_count:     cardCount[s.id]     || 0,
      mastered_count: masteredCount[s.id] || 0,
    }));
    res.json({ data });
  } catch (err) {
    console.error('fc.listSets:', err);
    res.status(500).json({ error: 'Không thể tải danh sách học phần.' });
  }
};

// GET /api/flashcards/sets/:id
exports.getSet = async (req, res) => {
  const userId = req.user.id;
  try {
    const set = await ownSet(req.params.id, userId);
    if (!set) return res.status(404).json({ error: 'Không tìm thấy học phần.' });

    const { data: cards, error } = await fcDb.from('flashcards')
      .select('id,term,definition')
      .eq('set_id', set.id)
      .order('order_index', { ascending: true });
    if (error) throw error;

    res.json({ data: { ...set, cards } });
  } catch (err) {
    console.error('fc.getSet:', err);
    res.status(500).json({ error: 'Không thể tải học phần.' });
  }
};

// POST /api/flashcards/sets   Body: { title, description, cards: [{term, definition}] }
exports.createSet = async (req, res) => {
  const userId = req.user.id;
  const { title, description, cards } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc.' });
  const list = Array.isArray(cards) ? cards.filter(c => c.term?.trim() && c.definition?.trim()) : [];
  if (!list.length) return res.status(400).json({ error: 'Cần ít nhất 1 thẻ có đủ từ vựng và định nghĩa.' });
  try {
    const { data: set, error } = await fcDb.from('flashcard_sets')
      .insert({ owner_id: userId, title: title.trim(), description: description?.trim() || null })
      .select('id').single();
    if (error) throw error;

    const rows = list.map((c, i) => ({
      set_id: set.id, term: c.term.trim(), definition: c.definition.trim(), order_index: i,
    }));
    const { error: cErr } = await fcDb.from('flashcards').insert(rows);
    if (cErr) throw cErr;

    res.status(201).json({ data: { id: set.id } });
  } catch (err) {
    console.error('fc.createSet:', err);
    res.status(500).json({ error: 'Không thể tạo học phần.' });
  }
};

// PUT /api/flashcards/sets/:id   Body: { title, description, cards: [{term, definition}] }
exports.updateSet = async (req, res) => {
  const userId = req.user.id;
  const { title, description, cards } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc.' });
  const list = Array.isArray(cards) ? cards.filter(c => c.term?.trim() && c.definition?.trim()) : [];
  if (!list.length) return res.status(400).json({ error: 'Cần ít nhất 1 thẻ có đủ từ vựng và định nghĩa.' });
  try {
    const set = await ownSet(req.params.id, userId);
    if (!set) return res.status(404).json({ error: 'Không tìm thấy học phần.' });

    const { error: uErr } = await fcDb.from('flashcard_sets')
      .update({ title: title.trim(), description: description?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', set.id);
    if (uErr) throw uErr;

    // Đồng bộ thẻ: xóa hết thẻ cũ (CASCADE progress) rồi insert lại theo payload
    const { error: dErr } = await fcDb.from('flashcards').delete().eq('set_id', set.id);
    if (dErr) throw dErr;
    const rows = list.map((c, i) => ({
      set_id: set.id, term: c.term.trim(), definition: c.definition.trim(), order_index: i,
    }));
    const { error: iErr } = await fcDb.from('flashcards').insert(rows);
    if (iErr) throw iErr;

    res.json({ data: { id: set.id } });
  } catch (err) {
    console.error('fc.updateSet:', err);
    res.status(500).json({ error: 'Không thể cập nhật học phần.' });
  }
};

// DELETE /api/flashcards/sets/:id
exports.deleteSet = async (req, res) => {
  const userId = req.user.id;
  try {
    const set = await ownSet(req.params.id, userId);
    if (!set) return res.status(404).json({ error: 'Không tìm thấy học phần.' });

    const { error } = await fcDb.from('flashcard_sets').delete().eq('id', set.id);
    if (error) throw error;
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error('fc.deleteSet:', err);
    res.status(500).json({ error: 'Không thể xóa học phần.' });
  }
};

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

// GET /api/flashcards/sets/:id/progress  → map { card_id: 'learning' | 'mastered' }
exports.getProgress = async (req, res) => {
  const userId = req.user.id;
  try {
    const set = await ownSet(req.params.id, userId);
    if (!set) return res.status(404).json({ error: 'Không tìm thấy học phần.' });

    const cardIds = await cardIdsOfSet(set.id);
    if (!cardIds.length) return res.json({ data: {} });

    const { data, error } = await fcDb.from('flashcard_progress')
      .select('card_id,status')
      .eq('student_id', userId)
      .in('card_id', cardIds);
    if (error) throw error;

    const map = {};
    data.forEach(p => { map[p.card_id] = p.status; });
    res.json({ data: map });
  } catch (err) {
    console.error('fc.getProgress:', err);
    res.status(500).json({ error: 'Không thể tải tiến độ.' });
  }
};

// PUT /api/flashcards/sets/:id/progress   Body: { card_id, status }
exports.upsertProgress = async (req, res) => {
  const userId = req.user.id;
  const { card_id, status } = req.body;
  if (!card_id) return res.status(400).json({ error: 'Thiếu card_id.' });
  if (!['learning', 'mastered'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  try {
    const { error } = await fcDb.from('flashcard_progress')
      .upsert(
        { student_id: userId, card_id, status, last_reviewed_at: new Date().toISOString() },
        { onConflict: 'student_id,card_id' }
      );
    if (error) throw error;
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error('fc.upsertProgress:', err);
    res.status(500).json({ error: 'Không thể lưu tiến độ.' });
  }
};

// DELETE /api/flashcards/sets/:id/progress  → khởi động lại (xóa tiến độ của user cho set)
exports.resetProgress = async (req, res) => {
  const userId = req.user.id;
  try {
    const set = await ownSet(req.params.id, userId);
    if (!set) return res.status(404).json({ error: 'Không tìm thấy học phần.' });

    const cardIds = await cardIdsOfSet(set.id);
    if (cardIds.length) {
      const { error } = await fcDb.from('flashcard_progress')
        .delete().eq('student_id', userId).in('card_id', cardIds);
      if (error) throw error;
    }
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error('fc.resetProgress:', err);
    res.status(500).json({ error: 'Không thể khởi động lại tiến độ.' });
  }
};

// ─── FOLDERS ──────────────────────────────────────────────────────────────────

// GET /api/flashcards/folders
exports.listFolders = async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: folders, error } = await fcDb.from('flashcard_folders')
      .select('id,name')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!folders.length) return res.json({ data: [] });

    const folderIds = folders.map(f => f.id);
    const { data: links, error: lErr } = await fcDb.from('flashcard_folder_sets')
      .select('folder_id').in('folder_id', folderIds);
    if (lErr) throw lErr;

    const setCount = {};
    links.forEach(l => { setCount[l.folder_id] = (setCount[l.folder_id] || 0) + 1; });

    const data = folders.map(f => ({ ...f, set_count: setCount[f.id] || 0 }));
    res.json({ data });
  } catch (err) {
    console.error('fc.listFolders:', err);
    res.status(500).json({ error: 'Không thể tải danh sách thư mục.' });
  }
};

// GET /api/flashcards/folders/:id
exports.getFolder = async (req, res) => {
  const userId = req.user.id;
  try {
    const folder = await ownFolder(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: 'Không tìm thấy thư mục.' });

    const { data: links, error: lErr } = await fcDb.from('flashcard_folder_sets')
      .select('set_id').eq('folder_id', folder.id);
    if (lErr) throw lErr;
    const setIds = links.map(l => l.set_id);
    if (!setIds.length) return res.json({ data: { ...folder, set_count: 0, sets: [] } });

    const { data: sets, error: sErr } = await fcDb.from('flashcard_sets')
      .select('id,title,description').in('id', setIds);
    if (sErr) throw sErr;

    // Đếm số thẻ mỗi set + map card_id → set_id để quy đổi progress
    const { data: cards, error: cErr } = await fcDb.from('flashcards')
      .select('id,set_id').in('set_id', setIds);
    if (cErr) throw cErr;
    const cardToSet = new Map(cards.map(c => [c.id, c.set_id]));
    const cardCount = {};
    cards.forEach(c => { cardCount[c.set_id] = (cardCount[c.set_id] || 0) + 1; });

    // Đếm số thẻ đã thuộc của user theo từng set (để vẽ thanh tiến độ)
    const masteredCount = {};
    if (cards.length) {
      const { data: prog, error: pErr } = await fcDb.from('flashcard_progress')
        .select('card_id')
        .eq('student_id', userId)
        .eq('status', 'mastered')
        .in('card_id', cards.map(c => c.id));
      if (pErr) throw pErr;
      prog.forEach(p => {
        const sid = cardToSet.get(p.card_id);
        if (sid) masteredCount[sid] = (masteredCount[sid] || 0) + 1;
      });
    }

    const setsOut = sets.map(s => ({
      ...s,
      card_count:     cardCount[s.id]     || 0,
      mastered_count: masteredCount[s.id] || 0,
    }));
    res.json({ data: { ...folder, set_count: setsOut.length, sets: setsOut } });
  } catch (err) {
    console.error('fc.getFolder:', err);
    res.status(500).json({ error: 'Không thể tải thư mục.' });
  }
};

// POST /api/flashcards/folders   Body: { name }
exports.createFolder = async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thư mục là bắt buộc.' });
  try {
    const { data, error } = await fcDb.from('flashcard_folders')
      .insert({ owner_id: userId, name: name.trim() })
      .select('id').single();
    if (error) throw error;
    res.status(201).json({ data: { id: data.id } });
  } catch (err) {
    console.error('fc.createFolder:', err);
    res.status(500).json({ error: 'Không thể tạo thư mục.' });
  }
};

// PUT /api/flashcards/folders/:id   Body: { name }
exports.updateFolder = async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thư mục là bắt buộc.' });
  try {
    const folder = await ownFolder(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: 'Không tìm thấy thư mục.' });

    const { error } = await fcDb.from('flashcard_folders')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', folder.id);
    if (error) throw error;
    res.json({ data: { id: folder.id } });
  } catch (err) {
    console.error('fc.updateFolder:', err);
    res.status(500).json({ error: 'Không thể cập nhật thư mục.' });
  }
};

// DELETE /api/flashcards/folders/:id  (không xóa các set bên trong)
exports.deleteFolder = async (req, res) => {
  const userId = req.user.id;
  try {
    const folder = await ownFolder(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: 'Không tìm thấy thư mục.' });

    const { error } = await fcDb.from('flashcard_folders').delete().eq('id', folder.id);
    if (error) throw error;
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error('fc.deleteFolder:', err);
    res.status(500).json({ error: 'Không thể xóa thư mục.' });
  }
};

// POST /api/flashcards/folders/:id/sets   Body: { set_id }  (idempotent)
exports.addSetToFolder = async (req, res) => {
  const userId = req.user.id;
  const { set_id } = req.body;
  if (!set_id) return res.status(400).json({ error: 'Thiếu set_id.' });
  try {
    const folder = await ownFolder(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: 'Không tìm thấy thư mục.' });
    const set = await ownSet(set_id, userId);
    if (!set) return res.status(404).json({ error: 'Không tìm thấy học phần.' });

    const { error } = await fcDb.from('flashcard_folder_sets')
      .upsert({ folder_id: folder.id, set_id }, { onConflict: 'folder_id,set_id' });
    if (error) throw error;
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error('fc.addSetToFolder:', err);
    res.status(500).json({ error: 'Không thể thêm học phần vào thư mục.' });
  }
};

// DELETE /api/flashcards/folders/:id/sets/:setId
exports.removeSetFromFolder = async (req, res) => {
  const userId = req.user.id;
  try {
    const folder = await ownFolder(req.params.id, userId);
    if (!folder) return res.status(404).json({ error: 'Không tìm thấy thư mục.' });

    const { error } = await fcDb.from('flashcard_folder_sets')
      .delete().eq('folder_id', folder.id).eq('set_id', req.params.setId);
    if (error) throw error;
    res.json({ data: { ok: true } });
  } catch (err) {
    console.error('fc.removeSetFromFolder:', err);
    res.status(500).json({ error: 'Không thể gỡ học phần khỏi thư mục.' });
  }
};
