'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');
const { checkAccess, incrementUsage } = require('../services/quotaService');
const { extractVocabCandidates } = require('../services/jaTokenizer');
const { attachMeaningPreview } = require('./dictionaryController');

// Bảng bài đọc nằm trong schema riêng materials_module — mọi truy vấn dùng client này
const matDb = supabaseAdmin.schema('materials_module');
// Từ điển (dictionary_module) — dùng để khớp từ vựng của bài với từ điển hệ thống
const dictDb = supabaseAdmin.schema('dictionary_module');

// Gắn tên người đăng (public.users nằm khác schema — không embed được, query tay)
async function attachAuthorNames(rows) {
  const ids = [...new Set(rows.map(r => r.created_by).filter(Boolean))];
  if (ids.length === 0) return rows.map(r => ({ ...r, author_name: null }));
  const { data, error } = await supabaseAdmin.from('users').select('id,full_name').in('id', ids);
  if (error) throw error;
  const nameById = new Map((data || []).map(u => [u.id, u.full_name]));
  return rows.map(r => ({ ...r, author_name: nameById.get(r.created_by) || null }));
}

// ── Student: danh sách bài đọc đã publish ─────────────────────────────────────
// GET /api/news?level=&search=&sort=&page=&limit=
exports.list = async (req, res) => {
  const { level, search, sort } = req.query;
  const p   = Math.max(1, Number(req.query.page) || 1);
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const offset = (p - 1) * lim;
  try {
    let query = matDb.from('news_articles')
      .select('id,title,title_vi,summary_vi,level,thumbnail_url,view_count,published_at,created_by', { count: 'exact' })
      .eq('is_published', true)
      .range(offset, offset + lim - 1);

    // Sắp xếp: most_viewed = xem nhiều nhất, mặc định = mới nhất theo ngày đăng
    if (sort === 'most_viewed') {
      query = query.order('view_count', { ascending: false })
                   .order('published_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('published_at', { ascending: false, nullsFirst: false })
                   .order('created_at', { ascending: false });
    }

    if (level) query = query.eq('level', level);
    // Sanitize search trước khi build filter PostgREST .or() (tránh injection cú pháp filter)
    const safe = search ? String(search).replace(/[,()%*]/g, ' ').trim() : '';
    if (safe) query = query.or(`title.ilike.%${safe}%,title_vi.ilike.%${safe}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: await attachAuthorNames(data || []), total: count, page: p, limit: lim });
  } catch (err) {
    console.error('news.list:', err);
    res.status(500).json({ error: 'Không thể tải danh sách bài đọc.' });
  }
};

// ── Student: chi tiết 1 bài đọc (kèm ghi lượt đọc + quota bài mới/ngày) ────────
// GET /api/news/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await matDb.from('news_articles')
      .select('id,title,title_vi,level,source,source_url,thumbnail_url,content,segments,questions,vocab,grammar,view_count,published_at,created_by')
      .eq('id', req.params.id)
      .eq('is_published', true)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });

    // Bài đã đọc rồi → đọc lại tự do; bài mới → check quota rồi ghi nhận lượt đọc
    const userId = req.user.id;
    const { data: read } = await matDb.from('news_article_reads')
      .select('article_id')
      .eq('article_id', data.id).eq('user_id', userId)
      .maybeSingle();

    if (!read) {
      // Lỗi quota service → fail open (không chặn người đọc), giống middleware checkQuota
      let access = null;
      try { access = await checkAccess(userId, 'news_read_daily'); }
      catch (e) { console.error('news.getOne quota:', e.message); }

      if (access && !access.allowed) {
        return res.status(403).json({
          error: 'quota_exceeded',
          message: `Bạn đã đọc hết ${access.used}/${access.limit} bài mới hôm nay. ${access.resetInfo}`,
          feature: 'news_read_daily',
          used: access.used,
          limit: access.limit,
          tier: access.tier,
          resetInfo: access.resetInfo,
          upgradeRequired: access.tier === 'free',
        });
      }

      // 2 request song song có thể đụng PK (article_id,user_id) — coi như đã đọc, bỏ qua
      const { error: insErr } = await matDb.from('news_article_reads')
        .insert({ article_id: data.id, user_id: userId });
      if (!insErr) {
        const { error: vErr } = await matDb.from('news_articles')
          .update({ view_count: data.view_count + 1 }).eq('id', data.id);
        if (!vErr) data.view_count += 1;
        incrementUsage(userId, 'news_read_daily').catch(() => {});
      }
    }

    const [withAuthor] = await attachAuthorNames([data]);
    res.json(withAuthor);
  } catch (err) {
    console.error('news.getOne:', err);
    res.status(500).json({ error: 'Không thể tải bài đọc.' });
  }
};

// ── Admin: AI soạn bài đọc gốc theo chủ đề + level ─────────────────────────────
// POST /api/admin/news/generate-article   Body: { topic, level, length }
exports.generateArticle = async (req, res) => {
  const { topic, level, length } = req.body;
  if (!topic || !topic.trim()) return res.status(400).json({ error: 'Hãy nhập chủ đề bài đọc.' });

  const LENGTH_SPEC = { short: '300–500', medium: '500–800', long: '800–1200' };
  const lengthSpec  = LENGTH_SPEC[length] || LENGTH_SPEC.medium;
  const lv          = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(level) ? level : 'N4';

  const SYSTEM = `Bạn là chuyên gia biên soạn học liệu tiếng Nhật. Soạn MỘT bài đọc tiếng Nhật HOÀN TOÀN MỚI (tự sáng tác, không sao chép từ bất kỳ nguồn nào) theo chủ đề người dùng đưa ra:
- Đúng trình độ JLPT ${lv}: từ vựng, kanji và ngữ pháp phải phù hợp trình độ này.
- Văn phong tự nhiên như bài tạp chí/bản tin dễ hiểu, chia đoạn hợp lý, mỗi câu kết thúc bằng 。
- Độ dài phần "content" khoảng ${lengthSpec} ký tự.
- Tự rà soát lại độ tự nhiên và tính nhất quán của bài trước khi trả lời.
Trả về DUY NHẤT một object JSON:
{ "title": tiêu đề tiếng Nhật, "title_vi": tiêu đề tiếng Việt, "summary_vi": mô tả ngắn 1-2 câu tiếng Việt, "content": toàn văn tiếng Nhật thuần (không furigana, không markdown) }
Không giải thích, không bọc trong code block, không thêm chữ nào ngoài object JSON.`;

  try {
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Chủ đề: ${topic.trim()}` }],
      { max_tokens: 4096, temperature: 0.7 }
    );
    const raw = result.choices?.[0]?.message?.content || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let article;
    try { article = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }
    if (!article.title || !article.content) {
      return res.status(502).json({ error: 'AI trả thiếu tiêu đề hoặc nội dung. Hãy thử lại.' });
    }

    res.json({
      title:      String(article.title).trim(),
      title_vi:   String(article.title_vi || '').trim(),
      summary_vi: String(article.summary_vi || '').trim(),
      content:    String(article.content).trim(),
      usage:      result.usage,
    });
  } catch (err) {
    console.error('news.generateArticle:', err);
    res.status(502).json({ error: err.message || 'Không thể soạn bài bằng AI.' });
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

// ── Admin: AI sinh câu hỏi trắc nghiệm đọc hiểu ────────────────────────────────
// POST /api/admin/news/generate-questions   Body: { content, level }
exports.generateQuestions = async (req, res) => {
  const { content, level } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung bài đọc trống.' });
  if (content.length > 8000)       return res.status(400).json({ error: 'Nội dung quá dài (tối đa 8000 ký tự).' });

  const lv = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(level) ? level : 'N4';
  const SYSTEM = `Bạn là chuyên gia tiếng Nhật. Nhận một bài đọc tiếng Nhật (trình độ ${lv}) và tạo 4 câu hỏi trắc nghiệm kiểm tra độ hiểu bài:
- Câu hỏi và 4 lựa chọn viết bằng TIẾNG NHẬT, độ khó phù hợp trình độ ${lv}.
- Chỉ 1 đáp án đúng; các lựa chọn sai phải hợp lý (dựa trên chi tiết có trong bài).
- "answer" là chỉ số 0-3 của đáp án đúng trong mảng "options".
- "explanation_vi" là giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đó đúng.
Trả về DUY NHẤT một mảng JSON: [{ "question": ..., "options": [4 chuỗi], "answer": 0-3, "explanation_vi": ... }].
Không giải thích, không bọc trong code block, không thêm chữ nào ngoài mảng JSON.`;

  try {
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
      { max_tokens: 3072, temperature: 0.4 }
    );
    const raw = result.choices?.[0]?.message?.content || '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let questions;
    try { questions = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }

    // Chỉ giữ câu hợp lệ: đủ question + 4 options + answer trong khoảng 0-3
    questions = (Array.isArray(questions) ? questions : [])
      .map(q => ({
        question:       String(q.question || '').trim(),
        options:        Array.isArray(q.options) ? q.options.slice(0, 4).map(o => String(o || '').trim()) : [],
        answer:         Number(q.answer),
        explanation_vi: String(q.explanation_vi || '').trim(),
      }))
      .filter(q => q.question && q.options.length === 4 && q.options.every(Boolean)
                && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);

    if (questions.length === 0) return res.status(502).json({ error: 'AI không sinh được câu hỏi hợp lệ. Hãy thử lại.' });
    res.json({ questions, usage: result.usage });
  } catch (err) {
    console.error('news.generateQuestions:', err);
    res.status(502).json({ error: err.message || 'Không thể sinh câu hỏi bằng AI.' });
  }
};

// ── Admin: sinh từ vựng (kuromoji + từ điển hệ thống) & ngữ pháp (AI) của bài ──
// POST /api/admin/news/generate-vocab-grammar   Body: { content, level }
exports.generateVocabGrammar = async (req, res) => {
  const { content, level } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung bài đọc trống.' });
  if (content.length > 8000)       return res.status(400).json({ error: 'Nội dung quá dài (tối đa 8000 ký tự).' });

  try {
    // 1) Từ vựng: tách từ offline rồi khớp với từ điển hệ thống (không tốn token AI)
    const candidates = await extractVocabCandidates(content, 40);
    const bases = candidates.map(c => c.word);

    let entryByWord = new Map();
    if (bases.length > 0) {
      const [byKanji, byKana] = await Promise.all([
        dictDb.from('dict_entries').select('id,kanji,kana,jlpt_level')
          .in('kanji', bases).order('is_common', { ascending: false }),
        dictDb.from('dict_entries').select('id,kanji,kana,jlpt_level')
          .in('kana', bases).order('is_common', { ascending: false }),
      ]);
      if (byKanji.error) throw byKanji.error;
      if (byKana.error)  throw byKana.error;

      // Ưu tiên khớp theo kanji; mỗi từ lấy entry phổ biến nhất (đã order is_common desc)
      const entries = [];
      for (const e of byKanji.data || []) {
        if (!entryByWord.has(e.kanji)) { entryByWord.set(e.kanji, e); entries.push(e); }
      }
      for (const e of byKana.data || []) {
        if (!entryByWord.has(e.kana)) { entryByWord.set(e.kana, e); entries.push(e); }
      }
      // Gắn nghĩa tiếng Việt đầu tiên cho các entry đã khớp
      const withMeaning = await attachMeaningPreview(entries);
      const meaningById = new Map(withMeaning.map(e => [e.id, e.meaning_vi]));
      for (const e of entryByWord.values()) e.meaning_vi = meaningById.get(e.id) || null;
    }

    // Từ có trong từ điển xếp trước (giữ thứ tự xuất hiện trong bài), tối đa 20 từ
    const matched = [], unmatched = [];
    for (const c of candidates) {
      const e = entryByWord.get(c.word);
      if (e) matched.push({ word: c.word, reading: e.kana || c.reading, meaning_vi: e.meaning_vi || '', entry_id: e.id, jlpt_level: e.jlpt_level || null });
      else   unmatched.push({ word: c.word, reading: c.reading, meaning_vi: '', entry_id: null, jlpt_level: null });
    }
    const vocab = [...matched, ...unmatched].slice(0, 20);

    // 2) Ngữ pháp: AI chọn mẫu ngữ pháp nổi bật trong bài (lỗi AI không làm mất phần từ vựng)
    let grammar = [];
    let grammarError = null;
    try {
      const lv = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(level) ? level : 'N4';
      const SYSTEM = `Bạn là chuyên gia ngữ pháp tiếng Nhật. Nhận một bài đọc tiếng Nhật (trình độ ${lv}), chọn ra 3-6 mẫu ngữ pháp đáng chú ý xuất hiện TRONG bài (phù hợp trình độ ${lv}):
- "pattern": mẫu ngữ pháp (ví dụ 「〜ながら」, 「〜てから」).
- "explanation_vi": giải thích ngắn gọn cách dùng bằng tiếng Việt.
- "example_jp": câu ví dụ trích từ CHÍNH bài đọc có chứa mẫu đó.
Trả về DUY NHẤT một mảng JSON: [{ "pattern": ..., "explanation_vi": ..., "example_jp": ... }].
Không giải thích, không bọc trong code block, không thêm chữ nào ngoài mảng JSON.`;
      const result = await chatCompletion(
        [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
        { max_tokens: 2048, temperature: 0.3 }
      );
      const raw = result.choices?.[0]?.message?.content || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        grammar = (JSON.parse(match[0]) || [])
          .map(g => ({
            pattern:        String(g.pattern || '').trim(),
            explanation_vi: String(g.explanation_vi || '').trim(),
            example_jp:     String(g.example_jp || '').trim(),
          }))
          .filter(g => g.pattern && g.explanation_vi);
      } else {
        grammarError = 'AI không trả về JSON ngữ pháp hợp lệ.';
      }
    } catch (e) {
      console.error('news.generateVocabGrammar (grammar):', e);
      grammarError = 'Không thể sinh ngữ pháp bằng AI. Hãy thử lại.';
    }

    res.json({ vocab, grammar, grammarError });
  } catch (err) {
    console.error('news.generateVocabGrammar:', err);
    res.status(500).json({ error: 'Không thể sinh từ vựng & ngữ pháp.' });
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
      .select('id,title,title_vi,level,thumbnail_url,view_count,is_published,published_at,created_at,updated_at', { count: 'exact' })
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
      .select('id,title,title_vi,summary_vi,level,source,source_url,thumbnail_url,content,segments,questions,vocab,grammar,view_count,is_published,published_at,created_by,created_at,updated_at')
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
  const { title, title_vi, summary_vi, level, source, source_url, thumbnail_url, content, segments, questions, vocab, grammar, is_published } = req.body;
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
        segments:      Array.isArray(segments)  ? segments  : [],
        questions:     Array.isArray(questions) ? questions : [],
        vocab:         Array.isArray(vocab)     ? vocab     : [],
        grammar:       Array.isArray(grammar)   ? grammar   : [],
        is_published:  !!is_published,
        published_at:  is_published ? new Date().toISOString() : null,
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
  const allowed = ['title', 'title_vi', 'summary_vi', 'level', 'source', 'source_url', 'thumbnail_url', 'content', 'segments', 'questions', 'vocab', 'grammar', 'is_published'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date().toISOString();
  try {
    // Ngày đăng: set 1 lần khi publish lần đầu, các lần re-publish sau giữ nguyên
    if (updates.is_published === true) {
      const { data: cur } = await matDb.from('news_articles')
        .select('published_at').eq('id', req.params.id).maybeSingle();
      if (cur && !cur.published_at) updates.published_at = new Date().toISOString();
    }

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
