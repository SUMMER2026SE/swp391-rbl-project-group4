'use strict';

// Import Excel/CSV vào ngân hàng đề JLPT (jlpt_module.jlpt_bank_questions).
// Hỗ trợ dạng câu đơn (từ vựng/ngữ pháp) + dạng nghe (import transcript, audio
// bổ sung sau bằng TTS/upload trong bank). CHƯA hỗ trợ dạng passage (đọc hiểu).
// Luôn thử map cột trực tiếp trước (alias tiếng Việt/Anh); chỉ nhờ AI chuẩn hóa
// khi không nhận diện được cột bắt buộc. KHÔNG ghi DB — chỉ trả preview.

const XLSX = require('xlsx');
const { MONDAI_TYPES, validateQuestionPayload } = require('./jlptMock');
const { rowsFromCsv, sheetsFromXlsx, normalizeHeader } = require('./fileImportParser');
const { chatCompletion } = require('../config/ai');

const MAX_ROWS = 500;
const MAX_AI_CHARS = 30000;

// Các dạng được import: cột language không passage (text_grammar là ngữ pháp đoạn văn — có passage)
// + toàn bộ dạng nghe (nhập transcript, file audio tạo sau bằng TTS/upload trong bank)
const IMPORTABLE_TYPES = Object.keys(MONDAI_TYPES)
  .filter(t => (MONDAI_TYPES[t].category === 'language' && t !== 'text_grammar')
            || MONDAI_TYPES[t].category === 'listening');

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

function assertImportableType(mondaiType) {
  if (!IMPORTABLE_TYPES.includes(mondaiType))
    throw httpError(400, 'Import file hiện chỉ hỗ trợ dạng câu đơn (từ vựng/ngữ pháp) và dạng nghe, chưa hỗ trợ dạng đọc hiểu/đoạn văn.');
}

// ── Template .xlsx phát hành cho admin ────────────────────────────────────────

function templateHeaders(meta) {
  const n = meta.options_count;
  const headers = [];
  // Dạng nghe không in câu hỏi trên giấy (即時応答/概要理解/発話表現) → bỏ hẳn cột question_text
  if (!meta.no_question_text) headers.push('question_text');
  if (meta.category === 'listening') headers.push('audio_transcript');
  for (let i = 1; i <= n; i++) headers.push(`option_${i}`);
  headers.push(`correct (1-${n})`, 'explanation', 'translation_vi');
  for (let i = 1; i <= n; i++) headers.push(`option_translation_${i}`);
  return headers;
}

// → Buffer file .xlsx: sheet "Câu hỏi" (header + 1 dòng ví dụ từ MONDAI_TYPES[type].example)
//   + sheet "Hướng dẫn"
function buildImportTemplate(level, mondaiType) {
  const meta = MONDAI_TYPES[mondaiType];
  const n = meta.options_count;
  const listening = meta.category === 'listening';
  const headers = templateHeaders(meta);

  const rows = [headers];
  try {
    const ex = JSON.parse(meta.example);
    const row = [];
    if (!meta.no_question_text) row.push(ex.question_text || '');
    if (listening) row.push(ex.audio_transcript || '');
    for (let i = 0; i < n; i++) row.push(ex.options?.[i] || '');
    row.push(Number(ex.correct_index) + 1, ex.explanation || '', ex.translation_vi || '');
    for (let i = 0; i < n; i++) row.push(ex.option_translations?.[i] || '');
    rows.push(row);
  } catch { /* example lỗi format → template chỉ có header */ }

  const wsQuestions = XLSX.utils.aoa_to_sheet(rows);
  wsQuestions['!cols'] = headers.map(h =>
    ({ wch: h === 'question_text' ? 45 : h === 'audio_transcript' ? 55 : h.startsWith('option_translation') ? 25 : h === 'explanation' || h === 'translation_vi' ? 35 : 18 }));

  const guide = [
    ['HƯỚNG DẪN NHẬP CÂU HỎI VÀO NGÂN HÀNG JLPT'],
    [`Dạng: ${meta.ja} (${meta.vi}) — cấp ${level}`],
    [''],
    ['- Điền mỗi câu hỏi một dòng vào sheet "Câu hỏi". KHÔNG sửa dòng tiêu đề.'],
    ...(meta.no_question_text
      ? [['- Dạng này câu hỏi chỉ đọc trong bài nghe, KHÔNG in trên giấy → không có cột question_text.']]
      : [['- question_text: nội dung câu hỏi (bắt buộc).']]),
    ...(listening ? [
      ['- audio_transcript: script bài nghe (bắt buộc). Mỗi lượt thoại một dòng, bắt đầu bằng nhãn'],
      ['  「男：」hoặc「女：」(trùng giới thì 男１：/男２：); dòng câu hỏi/đánh số KHÔNG có nhãn.'],
      ['- File audio KHÔNG nằm trong file này — sau khi nhập, dùng nút "Tạo audio (TTS)" hoặc tải'],
      ['  file thu âm lên trong trang Ngân hàng JLPT cho từng câu.'],
    ] : []),
    [`- option_1..option_${n}: các lựa chọn (bắt buộc đủ ${n}).`],
    [`- correct: số thứ tự đáp án đúng, từ 1 đến ${n} (bắt buộc; chấp nhận cả A-${String.fromCharCode(64 + n)}).`],
    ['- explanation: giải thích đáp án bằng tiếng Việt (tùy chọn).'],
    ['- translation_vi: bản dịch tiếng Việt của câu hỏi (tùy chọn).'],
    [`- option_translation_1..option_translation_${n}: bản dịch từng lựa chọn (tùy chọn).`],
    ['- Dòng ví dụ có sẵn trong sheet "Câu hỏi" — xóa hoặc thay bằng câu thật trước khi nhập.'],
    [`- Tối đa ${MAX_ROWS} dòng mỗi lần nhập. Hỗ trợ file .xlsx, .xls và .csv.`],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Câu hỏi');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Hướng dẫn');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Map cột trực tiếp ─────────────────────────────────────────────────────────
// Alias viết ở dạng đã normalize (thường, không dấu) — xem normalizeHeader().

function fieldAliases(n) {
  const f = {
    question_text:    ['question text', 'cau hoi', 'noi dung cau hoi', 'noi dung', 'de bai', 'question'],
    audio_transcript: ['audio transcript', 'transcript', 'script', 'script bai nghe', 'noi dung bai nghe', 'loi thoai', 'kich ban nghe', 'ban ghi loi thoai'],
    correct:          ['correct', `correct 1 ${n}`, 'correct index', 'dap an', 'dap an dung', 'cau tra loi dung'],
    explanation:      ['explanation', 'giai thich', 'giai thich dap an'],
    translation_vi:   ['translation vi', 'ban dich', 'ban dich tieng viet', 'ban dich cau hoi', 'dich cau hoi', 'dich tieng viet'],
  };
  for (let i = 1; i <= n; i++) {
    f[`option_${i}`]             = [`option ${i}`, `lua chon ${i}`, `phuong an ${i}`, `dap an ${i}`];
    f[`option_translation_${i}`] = [`option translation ${i}`, `dich lua chon ${i}`, `ban dich lua chon ${i}`, `dich phuong an ${i}`];
  }
  return f;
}

function requiredFields(meta) {
  const req = ['correct'];
  if (!meta.no_question_text) req.push('question_text');
  if (meta.category === 'listening') req.push('audio_transcript');
  for (let i = 1; i <= meta.options_count; i++) req.push(`option_${i}`);
  return req;
}

// headers gốc của sheet → { mapping: {field: header gốc}, missing: [field bắt buộc chưa map được] }
function buildMapping(headers, meta) {
  const n = meta.options_count;
  const aliases = fieldAliases(n);
  const mapping = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    for (const [field, list] of Object.entries(aliases)) {
      if (list.includes(norm) && mapping[field] === undefined) { mapping[field] = h; break; }
    }
  }
  const missing = requiredFields(meta).filter(f => mapping[f] === undefined);
  return { mapping, missing };
}

// Transcript có ít nhất 1 dòng bắt đầu bằng nhãn giọng (男：/女：/男１：...) không?
// Nhãn cần cho TTS chọn giọng nam/nữ — thiếu chỉ WARNING, không chặn.
function hasSpeakerLabel(transcript) {
  return /^(男|女)[０-９0-9]?[：:]/m.test(transcript);
}

// 1 row đã map → { question, warning? } hoặc { error } hoặc null (dòng trống)
function rowToQuestion(row, mapping, meta) {
  const get = f => {
    const h = mapping[f];
    const v = h === undefined ? undefined : row[h];
    return v === undefined || v === null ? '' : String(v).trim();
  };
  const n = meta.options_count;

  const allEmpty = Object.values(mapping).every(h => {
    const v = row[h];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (allEmpty) return null;

  const listening = meta.category === 'listening';
  const question_text = get('question_text');
  if (!question_text && !meta.no_question_text)
    return { error: 'Thiếu nội dung câu hỏi (question_text).' };

  let audio_transcript = null;
  let warning = null;
  if (listening) {
    audio_transcript = get('audio_transcript');
    if (!audio_transcript)
      return { error: 'Thiếu script bài nghe (audio_transcript) — dạng nghe bắt buộc phải có.' };
    if (!hasSpeakerLabel(audio_transcript))
      warning = 'Script không có nhãn giọng 「男：」/「女：」 — TTS sẽ đọc toàn bộ bằng một giọng.';
  }

  const options = [];
  for (let i = 1; i <= n; i++) {
    const o = get(`option_${i}`);
    if (!o) return { error: `Thiếu lựa chọn ${i} (option_${i}) — dạng này cần đủ ${n} lựa chọn.` };
    options.push(o);
  }

  const rawCorrect = get('correct');
  let ci = -1;
  if (/^[1-9]\d*$/.test(rawCorrect)) ci = Number(rawCorrect) - 1;
  else if (/^[a-dA-D]$/.test(rawCorrect)) ci = rawCorrect.toUpperCase().charCodeAt(0) - 65;
  if (ci < 0 || ci >= n)
    return { error: `Đáp án đúng "${rawCorrect || '(trống)'}" không hợp lệ — phải từ 1 đến ${n}.` };

  const translations = [];
  let hasTranslation = false;
  for (let i = 1; i <= n; i++) {
    const t = get(`option_translation_${i}`);
    if (t) hasTranslation = true;
    translations.push(t);
  }

  const question = {
    question_text:       question_text || null,
    audio_transcript,
    options,
    correct_index:       ci,
    explanation:         get('explanation') || null,
    translation_vi:      get('translation_vi') || null,
    option_translations: hasTranslation ? translations : null,
  };
  const msg = validateQuestionPayload(question);
  if (msg) return { error: msg };
  return { question, warning };
}

// ── AI fallback khi header không nhận diện được ───────────────────────────────

function aiPrompt(meta) {
  const n = meta.options_count;
  const listening = meta.category === 'listening';
  const schema = `{"question_text":${meta.no_question_text ? 'null' : '"..."'},${listening ? '"audio_transcript":"...",' : ''}"options":[đúng ${n} chuỗi],"correct_index":0-${n - 1},"explanation":"... hoặc null","translation_vi":"... hoặc null","option_translations":[${n} chuỗi] hoặc null}`;
  return `Bạn là chuyên gia đề thi JLPT. Dữ liệu đầu vào là danh sách câu hỏi trắc nghiệm dạng 「${meta.ja}」 (${meta.vi}) do admin soạn trong file Excel/CSV, tên cột có thể đặt tùy ý.

Nhiệm vụ: trích xuất thành mảng JSON, mỗi phần tử:
${schema}
- correct_index tính từ 0. Nếu dữ liệu ghi đáp án dạng 1-${n} hoặc A-${String.fromCharCode(64 + n)} thì quy đổi.
- explanation/translation_vi/option_translations bằng tiếng Việt; dữ liệu gốc thiếu thì để null (KHÔNG tự sáng tác).${listening ? '\n- audio_transcript: script bài nghe trong dữ liệu gốc — GIỮ NGUYÊN nội dung, không viết lại.' : ''}
- Bỏ qua dòng tiêu đề, ghi chú, dòng trống.

Trả về ĐÚNG mảng JSON hợp lệ, không giải thích gì ngoài JSON.`;
}

async function aiNormalizeQuestions(meta, rows) {
  const rawText = JSON.stringify(rows, null, 1);
  if (rawText.length > MAX_AI_CHARS)
    throw httpError(400, `Nội dung quá dài để AI xử lý (tối đa ${MAX_AI_CHARS} ký tự). Hãy dùng file mẫu với đúng cột chuẩn.`);
  let result;
  try {
    result = await chatCompletion(
      [{ role: 'system', content: aiPrompt(meta) }, { role: 'user', content: 'Chuẩn hóa dữ liệu sau:\n' + rawText }],
      { max_tokens: 4096, temperature: 0.1 }
    );
  } catch (err) {
    throw httpError(502, 'AI chuẩn hóa thất bại: ' + err.message);
  }
  const raw = result.choices?.[0]?.message?.content || '';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw httpError(502, 'AI không trả về JSON hợp lệ.');
  try {
    return JSON.parse(match[0]);
  } catch {
    throw httpError(502, 'Không thể parse JSON từ AI.');
  }
}

// ── Entry point parse file → preview ──────────────────────────────────────────
// → { valid: [{row, question}], errors: [{row, message}], warnings: string[], source: 'direct'|'ai' }

async function parseJlptBankImport({ buffer, filename, mondaiType }) {
  const meta = MONDAI_TYPES[mondaiType];
  const ext = (filename.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();

  // Đọc file → danh sách sheet có dữ liệu (bỏ sheet "Hướng dẫn" của template)
  let sheets;
  try {
    if (ext === 'xlsx' || ext === 'xls') {
      sheets = sheetsFromXlsx(buffer).filter(s => normalizeHeader(s.name) !== 'huong dan');
    } else if (ext === 'csv') {
      sheets = [{ name: 'File', rows: rowsFromCsv(buffer) }];
    } else {
      throw httpError(400, 'Định dạng không hỗ trợ. Chỉ chấp nhận .xlsx, .xls, .csv.');
    }
  } catch (err) {
    if (err.httpStatus) throw err;
    throw httpError(400, 'Không thể đọc file — file có thể bị hỏng hoặc sai định dạng.');
  }

  sheets = sheets.filter(s => Array.isArray(s.rows) && s.rows.length > 0);
  if (sheets.length === 0) throw httpError(400, 'File không có dữ liệu.');
  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows > MAX_ROWS)
    throw httpError(400, `Tối đa ${MAX_ROWS} dòng mỗi lần nhập (file có ${totalRows} dòng).`);

  // Câu ví dụ trong template — chặn nhập nhầm (dạng không in câu hỏi → so bằng transcript)
  let exampleText = null;
  let exampleTranscript = null;
  try {
    const ex = JSON.parse(meta.example);
    exampleText = ex.question_text || null;
    exampleTranscript = ex.audio_transcript || null;
  } catch { /* bỏ qua */ }

  const valid = [];
  const errors = [];
  const warnings = [];
  const multiSheet = sheets.length > 1;
  const unmappedSheets = [];
  const labelWarningRows = [];

  for (const { name, rows } of sheets) {
    const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const { mapping, missing } = buildMapping(headers, meta);
    if (missing.length > 0) { unmappedSheets.push({ name, rows, missing }); continue; }

    rows.forEach((row, i) => {
      const label = multiSheet ? `${name} · dòng ${i + 2}` : `${i + 2}`;
      const parsed = rowToQuestion(row, mapping, meta);
      if (!parsed) return; // dòng trống
      if (parsed.error) { errors.push({ row: label, message: parsed.error }); return; }
      const q = parsed.question;
      if ((exampleText && q.question_text === exampleText)
          || (!exampleText && exampleTranscript && q.audio_transcript === exampleTranscript)) {
        errors.push({ row: label, message: 'Trùng câu ví dụ trong file mẫu — hãy xóa hoặc thay bằng câu thật.' });
        return;
      }
      if (parsed.warning) labelWarningRows.push(label);
      valid.push({ row: label, question: q });
    });
  }
  if (labelWarningRows.length > 0)
    warnings.push(`Dòng ${labelWarningRows.join(', ')}: script không có nhãn giọng 「男：」/「女：」 — TTS sẽ đọc toàn bộ bằng một giọng.`);

  // Không sheet nào map được cột bắt buộc → nhờ AI ánh xạ toàn bộ
  if (valid.length === 0 && errors.length === 0 && unmappedSheets.length > 0) {
    warnings.push('Không nhận diện được cột chuẩn — đã nhờ AI ánh xạ dữ liệu, hãy kiểm tra kỹ từng câu trước khi lưu.');
    const allRows = unmappedSheets.flatMap(s => s.rows);
    const items = await aiNormalizeQuestions(meta, allRows);
    if (!Array.isArray(items) || items.length === 0)
      throw httpError(400, 'AI không trích xuất được câu hỏi nào từ file.');
    const listening = meta.category === 'listening';
    items.forEach((it, i) => {
      const question = {
        question_text:       typeof it.question_text === 'string' ? it.question_text.trim() || null : null,
        audio_transcript:    typeof it.audio_transcript === 'string' ? it.audio_transcript.trim() || null : null,
        options:             Array.isArray(it.options) ? it.options.map(o => String(o).trim()) : [],
        correct_index:       Number(it.correct_index),
        explanation:         it.explanation || null,
        translation_vi:      it.translation_vi || null,
        option_translations: Array.isArray(it.option_translations) ? it.option_translations.map(t => String(t)) : null,
      };
      const msg =
        (!question.question_text && !meta.no_question_text) ? 'Thiếu nội dung câu hỏi.'
        : (listening && !question.audio_transcript) ? 'Thiếu script bài nghe (audio_transcript).'
        : validateQuestionPayload(question);
      if (msg) errors.push({ row: `${i + 1}`, message: msg });
      else valid.push({ row: `${i + 1}`, question });
    });
    appendListeningAudioWarning(meta, valid, warnings);
    return { valid, errors, warnings, source: 'ai' };
  }

  if (unmappedSheets.length > 0)
    warnings.push(`Bỏ qua ${unmappedSheets.length} sheet không nhận diện được cột bắt buộc: ${unmappedSheets.map(s => `"${s.name}"`).join(', ')}.`);
  if (valid.length === 0 && errors.length === 0)
    throw httpError(400, 'File không có dòng dữ liệu nào.');
  appendListeningAudioWarning(meta, valid, warnings);
  return { valid, errors, warnings, source: 'direct' };
}

// Dạng nghe import qua file luôn CHƯA có audio — nhắc admin bước tiếp theo
function appendListeningAudioWarning(meta, valid, warnings) {
  if (meta.category === 'listening' && valid.length > 0)
    warnings.push('Câu nghe sau khi nhập CHƯA có file audio — vào từng câu trong ngân hàng để bấm "Tạo audio từ transcript (TTS)" hoặc tải file thu âm lên.');
}

module.exports = { IMPORTABLE_TYPES, assertImportableType, buildImportTemplate, parseJlptBankImport };
