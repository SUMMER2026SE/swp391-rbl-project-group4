'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');

const writingDb = () => supabaseAdmin.schema('materials_module').from('writing_submissions');

// POST /api/writing/submit  { topic, level, text }
exports.submit = async (req, res) => {
  const { topic, level, text } = req.body || {};
  if (!topic || !text?.trim()) return res.status(400).json({ error: 'Thiếu chủ đề hoặc nội dung.' });
  if (text.trim().length < 20) return res.status(400).json({ error: 'Bài viết quá ngắn (tối thiểu 20 ký tự).' });

  const prompt =
`Bạn là giáo viên tiếng Nhật chấm bài viết đoạn văn của học viên.

CHỦ ĐỀ: 「${topic}」 (cấp độ ${level || 'N5'})
BÀI VIẾT CỦA HỌC VIÊN:
"""
${text.trim()}
"""

CHẤM ĐIỂM theo 3 tiêu chí:
- grammar_score (0-40): ngữ pháp, cấu trúc câu, trợ từ
- vocabulary_score (0-30): từ vựng đa dạng và phù hợp cấp độ
- coherence_score (0-30): mạch lạc, nội dung liên quan chủ đề, đủ ý

QUY TẮC:
- Chỉ chỉ ra lỗi SÁI THỰC SỰ, không bịa lỗi.
- Nếu một phần không có lỗi → không liệt kê.
- corrected_text: sửa toàn bộ câu sai (giữ nguyên câu đúng), chú thích sửa trong ngoặc [sửa: ...].

Trả về JSON THUẦN (không markdown):
{
  "grammar_score": <int 0-40>,
  "vocabulary_score": <int 0-30>,
  "coherence_score": <int 0-30>,
  "grammar_errors": ["<lỗi ngữ pháp cụ thể>"],
  "vocabulary_suggestions": ["<gợi ý từ vựng>"],
  "corrected_text": "<toàn bộ đoạn văn sau khi sửa, ghi chú bằng [sửa: ...]>",
  "overall_comment": "<nhận xét tổng 1-2 câu tiếng Việt>"
}`;

  let aiResult = null;
  try {
    const r = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { model: process.env.FPT_AI_MODEL || 'gemma-4-31B-it', temperature: 0, max_tokens: 1200 }
    );
    const txt = r.choices?.[0]?.message?.content || '';
    const m = txt.match(/\{[\s\S]*\}/);
    try { aiResult = JSON.parse(m ? m[0] : txt); } catch { /* ignore */ }
  } catch (e) {
    console.error('AI writing grade error:', e.message);
  }

  const grammar    = Math.max(0, Math.min(40, Math.round(Number(aiResult?.grammar_score)    || 0)));
  const vocabulary = Math.max(0, Math.min(30, Math.round(Number(aiResult?.vocabulary_score) || 0)));
  const coherence  = Math.max(0, Math.min(30, Math.round(Number(aiResult?.coherence_score)  || 0)));
  const total      = grammar + vocabulary + coherence;

  // normalize errors — AI đôi khi trả object {error, correction, explanation} thay vì string
  const normalizeErrors = (arr) => (Array.isArray(arr) ? arr : []).map(e =>
    typeof e === 'string' ? e
    : [e.error, e.correction && `→ ${e.correction}`, e.explanation].filter(Boolean).join(' ')
  ).slice(0, 6);

  const { data, error } = await writingDb().insert({
    student_id:      req.user.id,
    topic,
    level:           level || null,
    submission_text: text.trim(),
    ai_score:            aiResult ? total      : null,
    ai_grammar_score:    aiResult ? grammar    : null,
    ai_vocabulary_score: aiResult ? vocabulary : null,
    ai_coherence_score:  aiResult ? coherence  : null,
    ai_feedback_vi:      aiResult?.overall_comment || null,
    ai_corrected_text:   aiResult?.corrected_text  || null,
    ai_model_version:    process.env.FPT_AI_MODEL  || null,
  }).select().single();

  if (error) { console.error('Save writing error:', error); return res.status(500).json({ error: 'Lưu bài thất bại.' }); }

  res.json({
    id: data.id,
    score: aiResult ? total : null,
    grammar_score:    aiResult ? grammar    : null,
    vocabulary_score: aiResult ? vocabulary : null,
    coherence_score:  aiResult ? coherence  : null,
    grammar_errors:         normalizeErrors(aiResult?.grammar_errors),
    vocabulary_suggestions: normalizeErrors(aiResult?.vocabulary_suggestions),
    corrected_text:   aiResult?.corrected_text  || null,
    overall_comment:  aiResult?.overall_comment || null,
    submitted_at: data.submitted_at,
  });
};

// GET /api/writing/history
exports.history = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const { data, error, count } = await writingDb()
    .select('id, topic, level, submission_text, ai_score, ai_feedback_vi, submitted_at', { count: 'exact' })
    .eq('student_id', req.user.id)
    .order('submitted_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);
  if (error) return res.status(500).json({ error: 'Không tải được lịch sử.' });
  res.json({ data, total: count, page: Number(page) });
};

// GET /api/writing/:id
exports.getOne = async (req, res) => {
  const { data, error } = await writingDb()
    .select('*').eq('id', req.params.id).eq('student_id', req.user.id).single();
  if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
  res.json(data);
};
