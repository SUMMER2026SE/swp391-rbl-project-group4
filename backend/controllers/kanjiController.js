'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');

// GET /api/kanji
exports.list = async (req, res) => {
  const { level, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from('kanji')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)  query = query.eq('level', level);
    if (search) query = query.or(`character.ilike.%${search}%,meaning_vi.ilike.%${search}%,han_viet.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List kanji error:', err);
    res.status(500).json({ error: 'Không thể tải kanji.' });
  }
};

// POST /api/kanji/score-writing  { image: dataURL, character }
// Dùng model vision Qwen2.5-VL chấm độ giống + chỉ lỗi sai chữ viết tay
exports.scoreWriting = async (req, res) => {
  const { image, character } = req.body || {};
  if (!image || !character) return res.status(400).json({ error: 'Thiếu ảnh hoặc chữ kanji.' });
  if (typeof image !== 'string' || !image.startsWith('data:image/'))
    return res.status(400).json({ error: 'Ảnh không hợp lệ.' });

  const prompt =
`Bạn là giáo viên tiếng Nhật. Hãy nhìn vào ảnh chữ viết tay và so sánh với chữ mẫu 「${character}」.

QUY TẮC QUAN TRỌNG:
- Chỉ liệt kê lỗi khi bạn THỰC SỰ THẤY vấn đề rõ ràng trong ảnh.
- Nếu nét trông ổn → KHÔNG liệt kê nét đó là lỗi.
- Nếu chữ viết đúng và đủ nét → errors = [].
- KHÔNG bịa lỗi để cho có.

CÁCH CHẤM similarity (0-100):
- 90-100: gần như hoàn hảo
- 70-89: đúng chữ, có vài lỗi nhỏ về nét
- 50-69: nhận ra được chữ nhưng có lỗi rõ
- 20-49: sai nhiều hoặc khó nhận ra chữ
- 0-19: không phải chữ 「${character}」 hoặc không có nét

Trả về JSON THUẦN (không markdown):
{"similarity":<int 0-100>,"errors":["<chỉ lỗi nhìn thấy thực sự>",...],"comment":"<1 câu tiếng Việt>"}`;

  try {
    const r = await chatCompletion(
      [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ] }],
      { model: 'Qwen2.5-VL-7B-Instruct', temperature: 0, max_tokens: 300 }
    );
    const txt = r.choices?.[0]?.message?.content || '';
    const m = txt.match(/\{[\s\S]*\}/);
    let parsed = null;
    try { parsed = JSON.parse(m ? m[0] : txt); } catch { /* ignore */ }

    if (!parsed || parsed.similarity == null)
      return res.json({ similarity: null, errors: [], comment: (txt.trim() || 'Không phân tích được kết quả.').slice(0, 300) });

    res.json({
      similarity: Math.max(0, Math.min(100, Math.round(Number(parsed.similarity) || 0))),
      errors: Array.isArray(parsed.errors) ? parsed.errors.map(String).slice(0, 8) : [],
      comment: String(parsed.comment || '').slice(0, 300),
    });
  } catch (err) {
    console.error('Score kanji writing error:', err);
    res.status(500).json({ error: 'Không chấm được, thử lại sau.' });
  }
};

// GET /api/kanji/:id
exports.getOne = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('kanji').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};
