'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');

// Bảng bài đọc báo nằm trong schema riêng materials_module — mọi truy vấn dùng client này
const matDb = supabaseAdmin.schema('materials_module');

// ── Student: danh sách bài đọc đã publish ─────────────────────────────────────
// GET /api/news?level=&search=&page=&limit=
exports.list = async (req, res) => {
  const { level, search } = req.query;
  const p   = Math.max(1, Number(req.query.page) || 1);
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const offset = (p - 1) * lim;
  try {
    let query = matDb.from('news_articles')
      .select('id,title,title_vi,summary_vi,level,thumbnail_url', { count: 'exact' })
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (level) query = query.eq('level', level);
    // Sanitize search trước khi build filter PostgREST .or() (tránh injection cú pháp filter)
    const safe = search ? String(search).replace(/[,()%*]/g, ' ').trim() : '';
    if (safe) query = query.or(`title.ilike.%${safe}%,title_vi.ilike.%${safe}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: p, limit: lim });
  } catch (err) {
    console.error('news.list:', err);
    res.status(500).json({ error: 'Không thể tải danh sách bài đọc.' });
  }
};

// ── Student: chi tiết 1 bài đọc ───────────────────────────────────────────────
// GET /api/news/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await matDb.from('news_articles')
      .select('id,title,title_vi,level,source,source_url,thumbnail_url,content,segments')
      .eq('id', req.params.id)
      .eq('is_published', true)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    res.json(data);
  } catch (err) {
    console.error('news.getOne:', err);
    res.status(500).json({ error: 'Không thể tải bài đọc.' });
  }
};

// ── Admin: AI tách câu + sinh furigana & dịch (gọi 1 lần lúc tạo bài) ──────────
// POST /api/admin/news/generate-segments   Body: { content }
exports.generateSegments = async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung bài đọc trống.' });
  if (content.length > 8000)       return res.status(400).json({ error: 'Nội dung quá dài (tối đa 8000 ký tự).' });

  const SYSTEM = `Bạn là chuyên gia tiếng Nhật. Nhận một bài đọc tiếng Nhật và xử lý:
1. Tách nội dung thành từng câu (ngắt theo 。！？ và xuống dòng). Giữ nguyên dấu câu trong câu.
2. Với mỗi câu, tạo một object JSON gồm:
   - "jp": câu tiếng Nhật thuần (giữ nguyên, không thêm furigana)
   - "furigana": HTML có gắn ruby cho MỌI kanji theo dạng <ruby>漢字<rt>よみ</rt></ruby>.
     Chỉ gắn ruby cho kanji; hiragana, katakana, số, ký hiệu, dấu câu giữ nguyên không bọc.
   - "vi": bản dịch tiếng Việt tự nhiên, sát nghĩa của câu đó.
Trả về DUY NHẤT một mảng JSON các object [{ "jp": ..., "furigana": ..., "vi": ... }].
Không giải thích, không bọc trong code block, không thêm chữ nào ngoài mảng JSON.`;

  try {
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
      { max_tokens: Math.min(8192, Math.max(2048, content.length * 6)), temperature: 0.2 }
    );
    const raw = result.choices?.[0]?.message?.content || '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let segments;
    try { segments = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }

    // Chỉ giữ các trường cần thiết, loại câu rỗng
    segments = (Array.isArray(segments) ? segments : [])
      .map(s => ({ jp: String(s.jp || '').trim(), furigana: String(s.furigana || s.jp || '').trim(), vi: String(s.vi || '').trim() }))
      .filter(s => s.jp);

    res.json({ segments, usage: result.usage });
  } catch (err) {
    console.error('news.generateSegments:', err);
    res.status(502).json({ error: err.message || 'Không thể sinh dữ liệu bằng AI.' });
  }
};

// ── Admin: danh sách bài (cả nháp) ────────────────────────────────────────────
// GET /api/admin/news?level=&search=&page=&limit=
exports.adminList = async (req, res) => {
  const { level, search } = req.query;
  const p   = Math.max(1, Number(req.query.page) || 1);
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (p - 1) * lim;
  try {
    let query = matDb.from('news_articles')
      .select('id,title,title_vi,level,thumbnail_url,is_published,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (level) query = query.eq('level', level);
    const safe = search ? String(search).replace(/[,()%*]/g, ' ').trim() : '';
    if (safe) query = query.or(`title.ilike.%${safe}%,title_vi.ilike.%${safe}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: p, limit: lim });
  } catch (err) {
    console.error('news.adminList:', err);
    res.status(500).json({ error: 'Không thể tải danh sách bài đọc.' });
  }
};

// ── Admin: chi tiết 1 bài (cả nháp) ───────────────────────────────────────────
// GET /api/admin/news/:id
exports.adminGetOne = async (req, res) => {
  try {
    const { data, error } = await matDb.from('news_articles')
      .select('id,title,title_vi,summary_vi,level,source,source_url,thumbnail_url,content,segments,is_published,created_by,created_at,updated_at')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    res.json(data);
  } catch (err) {
    console.error('news.adminGetOne:', err);
    res.status(500).json({ error: 'Không thể tải bài đọc.' });
  }
};

// ── Admin: tạo bài ────────────────────────────────────────────────────────────
// POST /api/admin/news
exports.create = async (req, res) => {
  const { title, title_vi, summary_vi, level, source, source_url, thumbnail_url, content, segments, is_published } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc.' });
  try {
    const { data, error } = await matDb.from('news_articles')
      .insert({
        title,
        title_vi:      title_vi      || null,
        summary_vi:    summary_vi    || null,
        level:         level         || null,
        source:        source        || null,
        source_url:    source_url    || null,
        thumbnail_url: thumbnail_url || null,
        content:       content       || null,
        segments:      Array.isArray(segments) ? segments : [],
        is_published:  !!is_published,
        created_by:    req.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('news.create:', err);
    res.status(500).json({ error: 'Không thể tạo bài đọc.' });
  }
};

// ── Admin: cập nhật bài ───────────────────────────────────────────────────────
// PUT /api/admin/news/:id
exports.update = async (req, res) => {
  const allowed = ['title', 'title_vi', 'summary_vi', 'level', 'source', 'source_url', 'thumbnail_url', 'content', 'segments', 'is_published'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date().toISOString();
  try {
    const { data, error } = await matDb.from('news_articles')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('news.update:', err);
    res.status(500).json({ error: 'Không thể cập nhật bài đọc.' });
  }
};

// ── Admin: xóa bài ────────────────────────────────────────────────────────────
// DELETE /api/admin/news/:id
exports.remove = async (req, res) => {
  try {
    const { error } = await matDb.from('news_articles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    console.error('news.remove:', err);
    res.status(500).json({ error: 'Không thể xóa bài đọc.' });
  }
};
