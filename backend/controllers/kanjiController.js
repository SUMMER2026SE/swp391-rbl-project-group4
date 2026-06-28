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
`Bạn là giáo viên tiếng Nhật chấm bài luyện viết kanji.
Ảnh đính kèm là chữ kanji học viên VIẾT TAY (nét đen trên nền trắng).
Chữ mẫu đúng cần viết là: 「${character}」.
So sánh nét viết của học viên với chữ mẫu và đánh giá:
- similarity: độ giống tổng thể, số nguyên 0-100 (%). Nếu trong ảnh không có nét nào hoặc nguệch ngoạc vô nghĩa thì cho điểm rất thấp.
- errors: liệt kê các lỗi sai cụ thể (nét thiếu, nét thừa, sai thứ tự/hướng nét, sai tỉ lệ, lệch vị trí, viết sai chữ...). Nếu viết đúng và đẹp thì để mảng rỗng.
- comment: một câu nhận xét ngắn gọn bằng tiếng Việt.
CHỈ trả về JSON thuần, không kèm giải thích:
{"similarity": <int 0-100>, "errors": ["<lỗi>", ...], "comment": "<nhận xét>"}`;

  try {
    const r = await chatCompletion(
      [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ] }],
      { model: 'Qwen2.5-VL-7B-Instruct', temperature: 0.2, max_tokens: 500 }
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
