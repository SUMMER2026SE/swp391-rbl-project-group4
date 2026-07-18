'use strict';

// Import Excel/CSV vào ngân hàng đề JLPT (jlpt_module.jlpt_bank_*).
// - Câu đơn (từ vựng/ngữ pháp): 1 sheet, mỗi dòng 1 câu.
// - Dạng nghe: như câu đơn + cột audio_transcript (audio tạo sau bằng TTS/upload trong bank).
// - Dạng đọc hiểu/passage: file .xlsx 2 sheet — "Đoạn văn" (mỗi dòng 1 đoạn, có số đoạn)
//   + "Câu hỏi" (mỗi câu tham chiếu số đoạn) → preview theo NHÓM passage.
// Luôn thử map cột trực tiếp trước (alias tiếng Việt/Anh); chỉ nhờ AI chuẩn hóa
// khi không nhận diện được cột bắt buộc (KHÔNG áp dụng cho dạng passage).
// KHÔNG ghi DB — chỉ trả preview.

const XLSX = require('xlsx');
const { MONDAI_TYPES, validateQuestionPayload } = require('./jlptMock');
const { rowsFromCsv, sheetsFromXlsx, normalizeHeader } = require('./fileImportParser');
const { chatCompletion } = require('../config/ai');

const MAX_ROWS = 500;
const MAX_AI_CHARS = 30000;

// Dạng có passage dùng chung (đọc hiểu + ngữ pháp đoạn văn) → import theo nhóm 2 sheet
const PASSAGE_IMPORT_TYPES = Object.keys(MONDAI_TYPES)
  .filter(t => MONDAI_TYPES[t].category === 'reading' || t === 'text_grammar');

// Toàn bộ dạng đều import được: câu đơn (language) + nghe (transcript) + passage (2 sheet)
const IMPORTABLE_TYPES = Object.keys(MONDAI_TYPES);

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

function assertImportableType(mondaiType) {
  if (!IMPORTABLE_TYPES.includes(mondaiType))
    throw httpError(400, 'Loại mondai không hợp lệ.');
}

const isPassageType = t => PASSAGE_IMPORT_TYPES.includes(t);

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
// Đoạn văn mẫu dùng chung cho template dạng passage (nội dung generic, cấp nào cũng đọc được)
const SAMPLE_PASSAGE = 'わたしは毎朝六時に起きます。朝ごはんを食べてから、犬とさんぽに行きます。さんぽのあとで、コーヒーを飲みながら新聞を読みます。';

// Template dạng passage: 3 sheet — "Đoạn văn" + "Câu hỏi" (tham chiếu passage_no) + "Hướng dẫn"
function buildPassageTemplate(level, mondaiType) {
  const meta = MONDAI_TYPES[mondaiType];
  const n = meta.options_count;

  const passageHeaders = ['passage_no', 'title', 'passage_text'];
  const passageRows = [passageHeaders, [1, 'Ví dụ: thói quen buổi sáng', SAMPLE_PASSAGE]];
  const wsPassages = XLSX.utils.aoa_to_sheet(passageRows);
  wsPassages['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 80 }];

  const qHeaders = ['passage_no', ...templateHeaders(meta)];
  const qRows = [qHeaders];
  try {
    const ex = JSON.parse(meta.example);
    const row = [1, ex.question_text || ''];
    for (let i = 0; i < n; i++) row.push(ex.options?.[i] || '');
    row.push(Number(ex.correct_index) + 1, ex.explanation || '', ex.translation_vi || '');
    for (let i = 0; i < n; i++) row.push(ex.option_translations?.[i] || '');
    qRows.push(row);
  } catch { /* example lỗi format → chỉ header */ }
  const wsQuestions = XLSX.utils.aoa_to_sheet(qRows);
  wsQuestions['!cols'] = qHeaders.map(h =>
    ({ wch: h === 'question_text' ? 45 : h === 'passage_no' ? 10 : h.startsWith('option_translation') ? 25 : h === 'explanation' || h === 'translation_vi' ? 35 : 18 }));

  const guide = [
    ['HƯỚNG DẪN NHẬP NHÓM ĐỌC HIỂU VÀO NGÂN HÀNG JLPT'],
    [`Dạng: ${meta.ja} (${meta.vi}) — cấp ${level}`],
    [''],
    ['- Sheet "Đoạn văn": mỗi dòng 1 đoạn văn. passage_no là SỐ THỨ TỰ đoạn (1, 2, 3...) — không trùng nhau.'],
    ['  title: tiêu đề nhóm (tùy chọn). passage_text: nội dung đoạn văn (bắt buộc).'],
    ['- Sheet "Câu hỏi": mỗi dòng 1 câu, cột passage_no ghi số đoạn mà câu thuộc về.'],
    ['- question_text: nội dung câu hỏi (bắt buộc).'],
    [`- option_1..option_${n}: các lựa chọn (bắt buộc đủ ${n}).`],
    [`- correct: số thứ tự đáp án đúng, từ 1 đến ${n} (bắt buộc; chấp nhận cả A-${String.fromCharCode(64 + n)}).`],
    ['- explanation / translation_vi / option_translation_1..: giải thích & bản dịch tiếng Việt (tùy chọn).'],
    ['- Ảnh minh họa (nếu có) tải lên sau trong trang Ngân hàng JLPT — không nằm trong file này.'],
    ['- Dòng ví dụ có sẵn ở 2 sheet — xóa hoặc thay bằng nội dung thật trước khi nhập.'],
    [`- Tối đa ${MAX_ROWS} dòng mỗi lần nhập. Dạng này chỉ hỗ trợ file .xlsx (cần 2 sheet).`],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 95 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPassages, 'Đoạn văn');
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Câu hỏi');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Hướng dẫn');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildImportTemplate(level, mondaiType) {
  if (isPassageType(mondaiType)) return buildPassageTemplate(level, mondaiType);
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

// Alias cột sheet "Đoạn văn" (dạng passage) + cột tham chiếu trong sheet "Câu hỏi"
const PASSAGE_NO_ALIASES = ['passage no', 'doan so', 'so doan', 'so thu tu doan', 'stt doan', 'doan'];
const PASSAGE_FIELD_ALIASES = {
  passage_no:   PASSAGE_NO_ALIASES,
  title:        ['title', 'tieu de', 'ten nhom', 'tieu de nhom'],
  passage_text: ['passage text', 'noi dung doan van', 'doan van', 'van ban', 'noi dung'],
};

// headers → mapping sheet Đoạn văn; thiếu passage_no/passage_text → null (không phải sheet đoạn văn)
function buildPassageMapping(headers) {
  const mapping = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    for (const [field, list] of Object.entries(PASSAGE_FIELD_ALIASES)) {
      if (list.includes(norm) && mapping[field] === undefined) { mapping[field] = h; break; }
    }
  }
  return (mapping.passage_no !== undefined && mapping.passage_text !== undefined) ? mapping : null;
}

// header passage_no trong sheet Câu hỏi (nếu có)
function findPassageNoHeader(headers) {
  return headers.find(h => PASSAGE_NO_ALIASES.includes(normalizeHeader(h)));
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

// ── Parse dạng passage (2 sheet Đoạn văn + Câu hỏi) → preview theo nhóm ───────
// → { groups: [{passage_no, title, passage_text, questions: [{row, question}]}],
//     errors, warnings, source: 'direct' }  (KHÔNG có AI fallback cho dạng này)

function parsePassageImport(sheets, meta) {
  let exampleText = null;
  try { exampleText = JSON.parse(meta.example).question_text || null; } catch { /* bỏ qua */ }

  // Phân loại sheet: đoạn văn (map đủ passage_no+passage_text) / câu hỏi (map đủ cột câu + passage_no)
  let passageSheet = null;
  let questionSheet = null;
  for (const s of sheets) {
    const headers = [...new Set(s.rows.flatMap(r => Object.keys(r)))];
    const pMap = buildPassageMapping(headers);
    const { mapping, missing } = buildMapping(headers, meta);
    const pnoHeader = findPassageNoHeader(headers);
    if (missing.length === 0 && pnoHeader && !questionSheet) { questionSheet = { ...s, mapping, pnoHeader }; continue; }
    if (pMap && !passageSheet) { passageSheet = { ...s, mapping: pMap }; }
  }
  if (!passageSheet || !questionSheet)
    throw httpError(400, 'Dạng đọc hiểu cần file .xlsx theo đúng file mẫu: sheet "Đoạn văn" (passage_no, passage_text) và sheet "Câu hỏi" (có cột passage_no tham chiếu). Hãy tải lại file mẫu.');

  const errors = [];
  const warnings = [];

  // Sheet Đoạn văn → map passage_no → group
  const groupsByNo = new Map();
  passageSheet.rows.forEach((row, i) => {
    const label = `Đoạn văn · dòng ${i + 2}`;
    const get = f => {
      const h = passageSheet.mapping[f];
      const v = h === undefined ? undefined : row[h];
      return v === undefined || v === null ? '' : String(v).trim();
    };
    const no = get('passage_no');
    const text = get('passage_text');
    if (!no && !text) return; // dòng trống
    if (!no) { errors.push({ row: label, message: 'Thiếu số đoạn (passage_no).' }); return; }
    if (!text) { errors.push({ row: label, message: 'Thiếu nội dung đoạn văn (passage_text).' }); return; }
    if (groupsByNo.has(no)) { errors.push({ row: label, message: `Số đoạn "${no}" bị trùng — passage_no phải duy nhất.` }); return; }
    if (text === SAMPLE_PASSAGE) { errors.push({ row: label, message: 'Trùng đoạn văn ví dụ trong file mẫu — hãy xóa hoặc thay bằng nội dung thật.' }); return; }
    groupsByNo.set(no, { passage_no: no, title: get('title') || null, passage_text: text, questions: [] });
  });

  // Sheet Câu hỏi → gắn vào nhóm theo passage_no
  questionSheet.rows.forEach((row, i) => {
    const label = `Câu hỏi · dòng ${i + 2}`;
    const parsed = rowToQuestion(row, questionSheet.mapping, meta);
    const rawNo = row[questionSheet.pnoHeader];
    const no = rawNo === undefined || rawNo === null ? '' : String(rawNo).trim();
    if (!parsed && !no) return; // dòng trống
    if (parsed?.error) { errors.push({ row: label, message: parsed.error }); return; }
    if (!parsed) { errors.push({ row: label, message: 'Dòng có passage_no nhưng thiếu nội dung câu hỏi.' }); return; }
    if (!no) { errors.push({ row: label, message: 'Thiếu số đoạn (passage_no) — câu phải thuộc về một đoạn văn.' }); return; }
    const group = groupsByNo.get(no);
    if (!group) { errors.push({ row: label, message: `Không tìm thấy đoạn văn số "${no}" trong sheet "Đoạn văn".` }); return; }
    if (exampleText && parsed.question.question_text === exampleText) {
      errors.push({ row: label, message: 'Trùng câu ví dụ trong file mẫu — hãy xóa hoặc thay bằng câu thật.' });
      return;
    }
    group.questions.push({ row: label, question: parsed.question });
  });

  const groups = [...groupsByNo.values()];
  const emptyGroups = groups.filter(g => g.questions.length === 0);
  if (emptyGroups.length > 0)
    warnings.push(`Đoạn văn số ${emptyGroups.map(g => `"${g.passage_no}"`).join(', ')} không có câu hỏi nào — sẽ bị bỏ qua khi nhập.`);

  const usable = groups.filter(g => g.questions.length > 0);
  if (usable.length === 0 && errors.length === 0)
    throw httpError(400, 'File không có nhóm đoạn văn + câu hỏi hợp lệ nào.');
  return { groups, errors, warnings, source: 'direct' };
}

// ── Entry point parse file → preview ──────────────────────────────────────────
// Câu đơn/nghe → { valid: [{row, question}], errors, warnings, source: 'direct'|'ai' }
// Dạng passage → { groups: [...], errors, warnings, source: 'direct' } (xem parsePassageImport)

async function parseJlptBankImport({ buffer, filename, mondaiType }) {
  const meta = MONDAI_TYPES[mondaiType];
  const ext = (filename.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
  if (isPassageType(mondaiType) && ext === 'csv')
    throw httpError(400, 'Dạng đọc hiểu cần file .xlsx có 2 sheet (Đoạn văn + Câu hỏi) — file .csv không hỗ trợ.');

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

  if (isPassageType(mondaiType)) return parsePassageImport(sheets, meta);

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

module.exports = {
  IMPORTABLE_TYPES, PASSAGE_IMPORT_TYPES, isPassageType, assertImportableType,
  buildImportTemplate, parseJlptBankImport,
  // Dùng lại cho import NGUYÊN ĐỀ (jlptExamImport.js)
  templateHeaders, buildMapping, rowToQuestion, SAMPLE_PASSAGE,
};
