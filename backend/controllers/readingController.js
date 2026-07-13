'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');
const { checkAccess, incrementUsage } = require('../services/quotaService');
const { logContentUse } = require('../utils/usageTracker');
const { extractVocabCandidates } = require('../services/jaTokenizer');
const { annotateQuestions, toRubyHtml } = require('../services/furiganaService');
const { attachMeaningPreview } = require('./dictionaryController');

// Bảng bài đọc nằm trong schema riêng reading_module — mọi truy vấn dùng client này
const readDb = supabaseAdmin.schema('reading_module');
// Từ điển (dictionary_module) — dùng để khớp từ vựng của bài với từ điển hệ thống
const dictDb = supabaseAdmin.schema('dictionary_module');

// Gắn furigana cho quiz trước khi lưu; lỗi kuroshiro → ghi questions không furigana (fail open)
async function annotateQuizFurigana(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  try {
    return await annotateQuestions(questions);
  } catch (e) {
    console.error('reading annotateQuizFurigana:', e.message);
    return questions;
  }
}

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
// GET /api/reading?level=&search=&sort=&page=&limit=
exports.list = async (req, res) => {
  const { level, search, sort } = req.query;
  const p   = Math.max(1, Number(req.query.page) || 1);
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const offset = (p - 1) * lim;
  try {
    let query = readDb.from('articles')
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
    console.error('reading.list:', err);
    res.status(500).json({ error: 'Không thể tải danh sách bài đọc.' });
  }
};

// ── Student: chi tiết 1 bài đọc (kèm ghi lượt đọc + quota bài mới/ngày) ────────
// GET /api/reading/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await readDb.from('articles')
      .select('id,title,title_vi,level,thumbnail_url,content,segments,questions,vocab,grammar,view_count,published_at,created_by,creator_type')
      .eq('id', req.params.id)
      .eq('is_published', true)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    logContentUse({ userId: req.user?.id, contentType: 'reading', contentId: data.id,
      creatorType: data.creator_type, ownerId: data.created_by });

    // Bài đã đọc rồi → đọc lại tự do; bài mới → check quota rồi ghi nhận lượt đọc
    const userId = req.user.id;
    const { data: read } = await readDb.from('article_reads')
      .select('article_id')
      .eq('article_id', data.id).eq('user_id', userId)
      .maybeSingle();

    if (!read) {
      // Lỗi quota service → fail open (không chặn người đọc), giống middleware checkQuota
      let access = null;
      try { access = await checkAccess(userId, 'reading_daily'); }
      catch (e) { console.error('reading.getOne quota:', e.message); }

      if (access && !access.allowed) {
        return res.status(403).json({
          error: 'quota_exceeded',
          message: `Bạn đã đọc hết ${access.used}/${access.limit} bài mới hôm nay. ${access.resetInfo}`,
          feature: 'reading_daily',
          used: access.used,
          limit: access.limit,
          tier: access.tier,
          resetInfo: access.resetInfo,
          upgradeRequired: access.tier === 'free',
        });
      }

      // 2 request song song có thể đụng PK (article_id,user_id) — coi như đã đọc, bỏ qua
      const { error: insErr } = await readDb.from('article_reads')
        .insert({ article_id: data.id, user_id: userId });
      if (!insErr) {
        const { error: vErr } = await readDb.from('articles')
          .update({ view_count: data.view_count + 1 }).eq('id', data.id);
        if (!vErr) data.view_count += 1;
        incrementUsage(userId, 'reading_daily').catch(() => {});
      }
    }

    // Backfill furigana cho quiz bài cũ (chưa có question_furigana): sinh 1 lần
    // rồi lưu lại. Lỗi kuroshiro → fail open, quiz hiện text thường như trước.
    if (Array.isArray(data.questions) && data.questions.length > 0
        && data.questions.some(q => q && q.question_furigana === undefined)) {
      try {
        data.questions = await annotateQuestions(data.questions);
        await readDb.from('articles').update({ questions: data.questions }).eq('id', data.id);
      } catch (e) {
        console.error('reading.getOne backfill furigana:', e.message);
      }
    }

    const [withAuthor] = await attachAuthorNames([data]);
    res.json(withAuthor);
  } catch (err) {
    console.error('reading.getOne:', err);
    res.status(500).json({ error: 'Không thể tải bài đọc.' });
  }
};

// ── Student: chat với trợ lý AI về CHÍNH bài đang đọc ──────────────────────────
// Server tự load bài từ DB (client không gửi nội dung bài → chống prompt injection).
// Không lưu session — UI giữ lịch sử cục bộ, mỗi request gửi lại các lượt gần nhất.
// POST /api/reading/:id/chat   Body: { messages: [{ role: 'user'|'assistant', content }] }
exports.chatWithArticle = async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  }
  // Chỉ nhận role hợp lệ, cắt còn 10 lượt cuối, mỗi lượt tối đa 2000 ký tự
  const trimmed = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  }

  try {
    const { data: article, error } = await readDb.from('articles')
      .select('title,title_vi,level,content,segments')
      .eq('id', req.params.id)
      .eq('is_published', true)
      .single();
    if (error || !article) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });

    const body = (article.content || (article.segments || []).map(s => s.jp).join('\n')).slice(0, 6000);
    const lv = article.level || 'N4';
    const SYSTEM = `Bạn là trợ lý đọc hiểu tiếng Nhật của nền tảng Kizuna Nihongo. Học viên (trình độ khoảng JLPT ${lv}) đang đọc bài luyện đọc sau:

[TIÊU ĐỀ] ${article.title}${article.title_vi ? ` (${article.title_vi})` : ''}
[NỘI DUNG BÀI ĐỌC]
${body}

NHIỆM VỤ — chỉ hỗ trợ xoay quanh bài đọc này:
- Giải thích nghĩa của từ/cụm từ THEO ĐÚNG NGỮ CẢNH trong bài (kèm cách đọc hiragana và nghĩa tiếng Việt); nếu từ có nghĩa khác ngoài bài thì nói rõ nghĩa nào đang dùng trong bài.
- Giải thích các mẫu ngữ pháp xuất hiện trong bài, trích lại câu trong bài có chứa mẫu đó làm ví dụ.
- Tóm tắt hoặc diễn giải lại đoạn học viên chưa hiểu bằng tiếng Việt dễ hiểu.
- Khi học viên yêu cầu, đặt câu hỏi kiểm tra độ hiểu bài (kèm đáp án và giải thích sau khi học viên trả lời).
- Câu hỏi không liên quan đến bài đọc hoặc tiếng Nhật → lịch sự từ chối và mời học viên hỏi về bài đang đọc.

QUY TẮC: trả lời bằng tiếng Việt (trừ khi được yêu cầu khác), ngắn gọn, thân thiện, độ khó phù hợp trình độ ${lv}.`;

    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, ...trimmed],
      { max_tokens: 1024, temperature: 0.6 }
    );
    res.json({ reply: result.choices?.[0]?.message?.content || '' });
  } catch (err) {
    console.error('reading.chatWithArticle:', err);
    res.status(502).json({ error: 'Trợ lý AI đang bận, hãy thử lại sau.' });
  }
};

// ── Admin: AI soạn bài đọc gốc theo chủ đề + level ─────────────────────────────
// POST /api/admin/reading/generate-article   Body: { topic, level, length }
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
    console.error('reading.generateArticle:', err);
    res.status(502).json({ error: err.message || 'Không thể soạn bài bằng AI.' });
  }
};

// ── Admin: AI tách câu + sinh furigana & dịch (gọi 1 lần lúc tạo bài) ──────────
// POST /api/admin/reading/generate-segments   Body: { content }
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
    console.error('reading.generateSegments:', err);
    res.status(502).json({ error: err.message || 'Không thể sinh dữ liệu bằng AI.' });
  }
};

// ── Admin: tách câu THỦ CÔNG không dùng AI (regex + kuroshiro offline) ─────────
// Nhận text dán bất kỳ (chỉ tiếng Nhật, hoặc lẫn Nhật + bản dịch Việt theo mọi bố cục):
// tách câu → phân loại Nhật/Việt theo bảng chữ → ghép cặp theo thứ tự → furigana offline.
// POST /api/admin/reading/segment-manual   Body: { text }
const JA_CHAR = /[ぁ-んァ-ヶ一-龯㐀-䶿ｦ-ﾟ]/;

function splitSentences(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Giữ dấu kết câu; đoạn cuối không có dấu vẫn lấy
    const parts = trimmed.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g) || [];
    for (const p of parts) {
      const s = p.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

exports.segmentManual = async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Nội dung bài đọc trống.' });
  if (text.length > 20000)   return res.status(400).json({ error: 'Nội dung quá dài (tối đa 20000 ký tự).' });

  try {
    const jpList = [], viList = [];
    for (const s of splitSentences(text)) {
      (JA_CHAR.test(s) ? jpList : viList).push(s);
    }
    if (jpList.length === 0) return res.status(400).json({ error: 'Không tìm thấy câu tiếng Nhật nào trong nội dung.' });

    // Ghép cặp câu Nhật thứ i với câu Việt thứ i; furigana sinh offline (không tốn token AI).
    // Lỗi kuroshiro → fail open: giữ jp làm furigana, admin vẫn sửa tay được.
    const segments = [];
    for (let i = 0; i < jpList.length; i++) {
      let furigana = jpList[i];
      try { furigana = await toRubyHtml(jpList[i]); }
      catch (e) { console.error('reading.segmentManual furigana:', e.message); }
      segments.push({ jp: jpList[i], furigana, vi: viList[i] || '' });
    }

    // content trả về chỉ còn tiếng Nhật thuần (dùng cho AI sinh quiz/từ vựng về sau)
    res.json({ segments, content: jpList.join('\n') });
  } catch (err) {
    console.error('reading.segmentManual:', err);
    res.status(500).json({ error: 'Không thể tách câu.' });
  }
};

// ── Admin: đọc text từ file tải lên (.txt / .docx) để đổ vào ô nội dung ────────
// POST /api/admin/reading/parse-file   (multipart, field "file")
exports.parseFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn file.' });
  const name = (req.file.originalname || '').toLowerCase();
  try {
    let text = '';
    if (name.endsWith('.docx')) {
      const mammoth = require('mammoth');
      const r = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = r.value || '';
    } else if (name.endsWith('.txt')) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Chỉ hỗ trợ file .txt hoặc .docx.' });
    }
    text = text.replace(/^﻿/, '').trim();
    if (!text) return res.status(400).json({ error: 'File không có nội dung.' });
    res.json({ text });
  } catch (err) {
    console.error('reading.parseFile:', err);
    res.status(500).json({ error: 'Không thể đọc nội dung file.' });
  }
};

// ── Admin: AI sinh câu hỏi trắc nghiệm đọc hiểu (kèm bản dịch tiếng Việt) ──────
// POST /api/admin/reading/generate-questions   Body: { content, level }
exports.generateQuestions = async (req, res) => {
  const { content, level } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Nội dung bài đọc trống.' });
  if (content.length > 8000)       return res.status(400).json({ error: 'Nội dung quá dài (tối đa 8000 ký tự).' });

  const lv = ['N5', 'N4', 'N3', 'N2', 'N1'].includes(level) ? level : 'N4';
  const SYSTEM = `Bạn là chuyên gia tiếng Nhật. Nhận một bài đọc tiếng Nhật (trình độ ${lv}) và tạo 4 câu hỏi trắc nghiệm kiểm tra độ hiểu bài:
- Câu hỏi và 4 lựa chọn viết bằng TIẾNG NHẬT, độ khó phù hợp trình độ ${lv}.
- Chỉ 1 đáp án đúng; các lựa chọn sai phải hợp lý (dựa trên chi tiết có trong bài).
- "answer" là chỉ số 0-3 của đáp án đúng trong mảng "options".
- "question_vi" là bản dịch tiếng Việt tự nhiên của câu hỏi.
- "options_vi" là mảng 4 bản dịch tiếng Việt tương ứng từng lựa chọn trong "options" (đúng thứ tự).
- "explanation_vi" là giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đó đúng.
Trả về DUY NHẤT một mảng JSON: [{ "question": ..., "question_vi": ..., "options": [4 chuỗi], "options_vi": [4 chuỗi], "answer": 0-3, "explanation_vi": ... }].
Không giải thích, không bọc trong code block, không thêm chữ nào ngoài mảng JSON.`;

  try {
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
      { max_tokens: 4096, temperature: 0.4 }
    );
    const raw = result.choices?.[0]?.message?.content || '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let questions;
    try { questions = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }

    // Chỉ giữ câu hợp lệ: đủ question + 4 options + answer trong khoảng 0-3.
    // options_vi/question_vi là phụ trợ — thiếu thì để rỗng, không loại câu.
    questions = (Array.isArray(questions) ? questions : [])
      .map(q => {
        const options_vi = Array.isArray(q.options_vi) ? q.options_vi.slice(0, 4).map(o => String(o || '').trim()) : [];
        return {
          question:       String(q.question || '').trim(),
          question_vi:    String(q.question_vi || '').trim(),
          options:        Array.isArray(q.options) ? q.options.slice(0, 4).map(o => String(o || '').trim()) : [],
          options_vi:     options_vi.length === 4 ? options_vi : ['', '', '', ''],
          answer:         Number(q.answer),
          explanation_vi: String(q.explanation_vi || '').trim(),
        };
      })
      .filter(q => q.question && q.options.length === 4 && q.options.every(Boolean)
                && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);

    if (questions.length === 0) return res.status(502).json({ error: 'AI không sinh được câu hỏi hợp lệ. Hãy thử lại.' });
    res.json({ questions, usage: result.usage });
  } catch (err) {
    console.error('reading.generateQuestions:', err);
    res.status(502).json({ error: err.message || 'Không thể sinh câu hỏi bằng AI.' });
  }
};

// ── Admin: sinh từ vựng (kuromoji + từ điển hệ thống) & ngữ pháp (AI) của bài ──
// POST /api/admin/reading/generate-vocab-grammar   Body: { content, level }
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
      console.error('reading.generateVocabGrammar (grammar):', e);
      grammarError = 'Không thể sinh ngữ pháp bằng AI. Hãy thử lại.';
    }

    res.json({ vocab, grammar, grammarError });
  } catch (err) {
    console.error('reading.generateVocabGrammar:', err);
    res.status(500).json({ error: 'Không thể sinh từ vựng & ngữ pháp.' });
  }
};

// ── Admin: danh sách bài (cả nháp; published=1 + sort dùng cho trang xem thử) ──
// GET /api/admin/reading?level=&search=&sort=&published=&page=&limit=
exports.adminList = async (req, res) => {
  const { level, search, sort, published } = req.query;
  const p   = Math.max(1, Number(req.query.page) || 1);
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (p - 1) * lim;
  try {
    let query = readDb.from('articles')
      .select('id,title,title_vi,summary_vi,level,thumbnail_url,view_count,is_published,published_at,created_by,created_at,updated_at', { count: 'exact' })
      .range(offset, offset + lim - 1);

    // Sắp xếp: giống trang student khi xem thử; mặc định = mới tạo trước (trang quản lý)
    if (sort === 'most_viewed') {
      query = query.order('view_count', { ascending: false })
                   .order('published_at', { ascending: false, nullsFirst: false });
    } else if (sort === 'newest') {
      query = query.order('published_at', { ascending: false, nullsFirst: false })
                   .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (published === '1') query = query.eq('is_published', true);
    if (level) query = query.eq('level', level);
    const safe = search ? String(search).replace(/[,()%*]/g, ' ').trim() : '';
    if (safe) query = query.or(`title.ilike.%${safe}%,title_vi.ilike.%${safe}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: await attachAuthorNames(data || []), total: count, page: p, limit: lim });
  } catch (err) {
    console.error('reading.adminList:', err);
    res.status(500).json({ error: 'Không thể tải danh sách bài đọc.' });
  }
};

// ── Admin: chi tiết 1 bài (cả nháp) ───────────────────────────────────────────
// GET /api/admin/reading/:id
exports.adminGetOne = async (req, res) => {
  try {
    const { data, error } = await readDb.from('articles')
      .select('id,title,title_vi,summary_vi,level,thumbnail_url,content,segments,questions,vocab,grammar,view_count,is_published,published_at,created_by,created_at,updated_at')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    const [withAuthor] = await attachAuthorNames([data]);
    res.json(withAuthor);
  } catch (err) {
    console.error('reading.adminGetOne:', err);
    res.status(500).json({ error: 'Không thể tải bài đọc.' });
  }
};

// ── Admin: tạo bài ────────────────────────────────────────────────────────────
// POST /api/admin/reading
exports.create = async (req, res) => {
  const { title, title_vi, summary_vi, level, thumbnail_url, content, segments, questions, vocab, grammar, is_published } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc.' });
  try {
    const questionsWithFuri = await annotateQuizFurigana(questions);
    const { data, error } = await readDb.from('articles')
      .insert({
        title,
        title_vi:      title_vi      || null,
        summary_vi:    summary_vi    || null,
        level:         level         || null,
        thumbnail_url: thumbnail_url || null,
        content:       content       || null,
        segments:      Array.isArray(segments)  ? segments  : [],
        questions:     questionsWithFuri,
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
    console.error('reading.create:', err);
    res.status(500).json({ error: 'Không thể tạo bài đọc.' });
  }
};

// ── Admin: cập nhật bài ───────────────────────────────────────────────────────
// PUT /api/admin/reading/:id
exports.update = async (req, res) => {
  const allowed = ['title', 'title_vi', 'summary_vi', 'level', 'thumbnail_url', 'content', 'segments', 'questions', 'vocab', 'grammar', 'is_published'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date().toISOString();
  try {
    // Sinh lại furigana cho quiz mỗi khi questions được gửi lên (admin có thể sửa tay text)
    if ('questions' in updates) updates.questions = await annotateQuizFurigana(updates.questions);

    // Ngày đăng: set 1 lần khi publish lần đầu, các lần re-publish sau giữ nguyên
    if (updates.is_published === true) {
      const { data: cur } = await readDb.from('articles')
        .select('published_at').eq('id', req.params.id).maybeSingle();
      if (cur && !cur.published_at) updates.published_at = new Date().toISOString();
    }

    const { data, error } = await readDb.from('articles')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('reading.update:', err);
    res.status(500).json({ error: 'Không thể cập nhật bài đọc.' });
  }
};

// ── Admin: xóa bài ────────────────────────────────────────────────────────────
// DELETE /api/admin/reading/:id
exports.remove = async (req, res) => {
  try {
    const { error } = await readDb.from('articles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    console.error('reading.remove:', err);
    res.status(500).json({ error: 'Không thể xóa bài đọc.' });
  }
};

// ── Teacher: own reading-article CRUD (created_by scoped) ─────────────────────
// (FE đang ẩn phía giáo viên — giữ nguyên BE để bật lại sau.)

async function ownsArticle(id, user) {
  const { data } = await readDb.from('articles').select('created_by').eq('id', id).maybeSingle();
  if (!data) return false;
  return data.created_by === user.id || user.user_metadata?.role === 'admin';
}

// GET /api/teacher/my-reading
exports.teacherList = async (req, res) => {
  try {
    const { data, error } = await readDb.from('articles')
      .select('id,title,title_vi,level,thumbnail_url,view_count,is_published,published_at,created_at,updated_at')
      .eq('created_by', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) {
    console.error('reading.teacherList:', err);
    res.status(500).json({ error: 'Không thể tải danh sách bài đọc.' });
  }
};

// GET /api/teacher/my-reading/:id
exports.teacherGetOne = async (req, res) => {
  if (!(await ownsArticle(req.params.id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  return exports.adminGetOne(req, res);
};

// POST /api/teacher/my-reading
exports.teacherCreate = async (req, res) => {
  const { title, title_vi, summary_vi, level, thumbnail_url, content, segments, questions, vocab, grammar, is_published } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Tiêu đề là bắt buộc.' });
  try {
    const questionsWithFuri = await annotateQuizFurigana(questions);
    const publish = is_published !== false; // teachers publish directly by default
    const { data, error } = await readDb.from('articles')
      .insert({
        title,
        title_vi:      title_vi      || null,
        summary_vi:    summary_vi    || null,
        level:         level         || null,
        thumbnail_url: thumbnail_url || null,
        content:       content       || null,
        segments:      Array.isArray(segments)  ? segments  : [],
        questions:     questionsWithFuri,
        vocab:         Array.isArray(vocab)     ? vocab     : [],
        grammar:       Array.isArray(grammar)   ? grammar   : [],
        is_published:  publish,
        published_at:  publish ? new Date().toISOString() : null,
        created_by:    req.user.id,
        creator_type:  'teacher',
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('reading.teacherCreate:', err);
    res.status(500).json({ error: 'Không thể tạo bài đọc.' });
  }
};

// PUT /api/teacher/my-reading/:id
exports.teacherUpdate = async (req, res) => {
  if (!(await ownsArticle(req.params.id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  return exports.update(req, res);
};

// DELETE /api/teacher/my-reading/:id
exports.teacherRemove = async (req, res) => {
  if (!(await ownsArticle(req.params.id, req.user))) return res.status(403).json({ error: 'Không có quyền.' });
  return exports.remove(req, res);
};
