'use strict';

// Extract text from an uploaded teacher document (DOCX / PDF / image) and run an
// AI review of the applicant's profile. Mirrors the prompt/parse/error idiom used
// in utils/questionGen.js and controllers/kanjiController.js (vision model).

const mammoth = require('mammoth');
const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // lib path avoids debug-mode file read
const { chatCompletion } = require('../config/ai');

const MAX_DOC_CHARS = 30000;   // total extracted text sent to the reviewer
const VISION_MODEL  = 'Qwen2.5-VL-7B-Instruct';

// Extract plain text from one document buffer. Returns { text, ok }.
// ok=false when we could not read meaningful text (never auto-approve on failure).
async function extractDocText({ buffer, mime = '', name = '' }) {
  try {
    if (mime.includes('word') || mime.includes('officedocument.wordprocessingml') || /\.docx?$/i.test(name)) {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = (value || '').trim();
      return { text, ok: text.length > 0 };
    }
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
      const data = await pdfParse(buffer);
      const text = (data.text || '').trim();
      // Scanned (image-only) PDFs yield ~no text → treat as unreadable.
      return { text, ok: text.length > 20 };
    }
    if (mime.startsWith('image/')) {
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      const r = await chatCompletion(
        [{ role: 'user', content: [
          { type: 'text', text: 'Trích xuất TOÀN BỘ chữ nhìn thấy trong ảnh tài liệu này (giữ nguyên ngôn ngữ). Chỉ trả về phần chữ, không thêm giải thích.' },
          { type: 'image_url', image_url: { url: dataUri } },
        ] }],
        { model: VISION_MODEL, temperature: 0, max_tokens: 1200 }
      );
      const text = (r.choices?.[0]?.message?.content || '').trim();
      return { text, ok: text.length > 10 };
    }
    return { text: '', ok: false };
  } catch (e) {
    console.error('extractDocText failed:', name, e.message);
    return { text: '', ok: false };
  }
}

// Extract text from every document, returning a combined string + per-doc status.
async function extractAllDocs(files) {
  const parts = [];
  const perDoc = [];
  for (const f of files) {
    const { text, ok } = await extractDocText({ buffer: f.buffer, mime: f.mimetype, name: f.originalname });
    perDoc.push({ name: f.originalname, ok });
    parts.push(`### Tài liệu: ${f.originalname}\n${ok ? text : '[Không đọc được nội dung]'}`);
  }
  let combined = parts.join('\n\n');
  if (combined.length > MAX_DOC_CHARS) combined = combined.slice(0, MAX_DOC_CHARS);
  const anyReadable = perDoc.some(d => d.ok);
  return { combined, perDoc, anyReadable };
}

const SYSTEM = `Bạn là chuyên viên xét duyệt hồ sơ ứng tuyển GIÁO VIÊN TIẾNG NHẬT. Bạn nhận thông tin ứng viên tự khai và nội dung tài liệu họ tải lên (CV, bằng cấp, chứng chỉ).

Nhiệm vụ: đánh giá xem hồ sơ có ĐỦ và ĐÁNG TIN để cấp quyền giáo viên không.
- Kiểm tra tính đầy đủ: có bằng cấp/chứng chỉ chứng minh trình độ tiếng Nhật hoặc năng lực giảng dạy không; thông tin khai có sơ sài không.
- Kiểm tra bất thường: mâu thuẫn giữa thông tin khai và tài liệu, dấu hiệu giả mạo, nội dung không liên quan, tài liệu không đọc được.

CHỈ trả về MỘT object JSON hợp lệ, KHÔNG kèm văn bản nào khác:
{"verdict":"approve"|"review","missing":["..."],"anomalies":["..."],"summary":"2-3 câu tiếng Việt tóm tắt hồ sơ và lý do","confidence":<số 0-100>}

Quy tắc verdict:
- "approve" CHỈ khi: có bằng cấp/chứng chỉ rõ ràng, thông tin đầy đủ, KHÔNG có mâu thuẫn, và bạn tự tin cao (confidence >= 80).
- Mọi trường hợp thiếu tài liệu, thông tin sơ sài, không đọc được nội dung, hoặc nghi ngờ → "review".`;

// Run the AI review. Always returns a safe object; never throws.
// On any failure returns a conservative "review" verdict (so we never auto-approve).
async function reviewApplication({ fields, docsText, anyReadable }) {
  const fallback = {
    verdict: 'review',
    missing: [],
    anomalies: [],
    summary: 'Không tự phân tích được hồ sơ, cần admin duyệt thủ công.',
    confidence: 0,
    ai_model: null,
  };
  try {
    const userMsg = `THÔNG TIN ỨNG VIÊN TỰ KHAI:
- Bằng cấp cao nhất: ${fields.highest_qualification || '(trống)'}
- Chuyên môn: ${fields.specialization || '(trống)'}
- Số năm kinh nghiệm: ${fields.years_experience ?? '(trống)'}
- Học vấn: ${fields.education || '(trống)'}
- Giới thiệu bản thân: ${fields.bio || '(trống)'}
- Số tài liệu tải lên: ${fields.doc_count} (loại: ${fields.doc_types || 'không rõ'})
${anyReadable ? '' : '\nLƯU Ý: KHÔNG đọc được nội dung của bất kỳ tài liệu nào.'}

NỘI DUNG TÀI LIỆU:
${docsText || '[Không có nội dung đọc được]'}

Hãy đánh giá và trả về ĐÚNG một object JSON.`;

    const model = process.env.FPT_AI_MODEL || 'gemma-4-31B-it';
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
      { temperature: 0.2, max_tokens: 800 }
    );
    const raw = result.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return fallback;

    const parsed = JSON.parse(match[0]);
    const verdict = parsed.verdict === 'approve' ? 'approve' : 'review';
    return {
      verdict,
      missing:    Array.isArray(parsed.missing)   ? parsed.missing.map(String).slice(0, 10)   : [],
      anomalies:  Array.isArray(parsed.anomalies) ? parsed.anomalies.map(String).slice(0, 10) : [],
      summary:    String(parsed.summary || '').slice(0, 800) || fallback.summary,
      confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
      ai_model:   model,
    };
  } catch (e) {
    console.error('reviewApplication failed:', e.message);
    return fallback;
  }
}

module.exports = { extractAllDocs, reviewApplication, MAX_DOC_CHARS };
