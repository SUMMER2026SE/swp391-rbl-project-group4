'use strict';

// Import Excel tạo NGUYÊN ĐỀ thi thử JLPT theo cấp độ → đề NHÁP.
// Workbook = sheet "Hướng dẫn" + mỗi mondai trong BLUEPRINTS[level] 1 sheet, tên
// "{vị_trí_phần}.{số_mondai} {tên rút gọn}" — parser match theo PREFIX SỐ (đổi tên
// phần chữ thoải mái). Layout từng sheet tái dùng format import bank theo dạng:
// - Câu đơn/nghe: dòng 1 header + mỗi dòng 1 câu (nghe có cột audio_transcript).
// - Dạng đọc/passage: ô A1="passage_text", B1=nội dung đoạn văn dùng chung; bảng
//   câu hỏi (header + dòng) bắt đầu từ dòng 3.
// KHÔNG AI fallback — file phải theo template. KHÔNG ghi DB — chỉ trả preview;
// commit do adminMockExamController xử lý (tạo đề blueprint + đổ câu).

const XLSX = require('xlsx');
const { MONDAI_TYPES, BLUEPRINTS } = require('./jlptMock');
const { normalizeHeader } = require('./fileImportParser');
const { isPassageType, templateHeaders, buildMapping, rowToQuestion, SAMPLE_PASSAGE } = require('./jlptBankImport');

const MAX_ROWS = 500;

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

// ── Template .xlsx nguyên đề ──────────────────────────────────────────────────

// Tên sheet Excel: ≤31 ký tự, không chứa : \ / ? * [ ]
function sheetTitle(sectionPos, mondaiNumber, meta) {
  const vi = String(meta.vi || '').replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ');
  return `${sectionPos}.${mondaiNumber} ${vi}`.slice(0, 31).trim();
}

// Dòng ví dụ cho 1 sheet (parse từ MONDAI_TYPES[type].example, format y hệt import bank)
function exampleRow(meta) {
  const n = meta.options_count;
  try {
    const ex = JSON.parse(meta.example);
    const row = [];
    if (!meta.no_question_text) row.push(ex.question_text || '');
    if (meta.category === 'listening') row.push(ex.audio_transcript || '');
    for (let i = 0; i < n; i++) row.push(ex.options?.[i] || '');
    row.push(Number(ex.correct_index) + 1, ex.explanation || '', ex.translation_vi || '');
    for (let i = 0; i < n; i++) row.push(ex.option_translations?.[i] || '');
    return row;
  } catch { return null; }
}

function colWidths(headers) {
  return headers.map(h =>
    ({ wch: h === 'question_text' ? 45 : h === 'audio_transcript' ? 55 : h.startsWith('option_translation') ? 25 : h === 'explanation' || h === 'translation_vi' ? 35 : 18 }));
}

function buildExamImportTemplate(level) {
  const bp = BLUEPRINTS[level];
  if (!bp) throw httpError(400, 'Cấp độ JLPT không hợp lệ.');

  const wb = XLSX.utils.book_new();

  const guide = [
    ['HƯỚNG DẪN TẠO NGUYÊN ĐỀ THI THỬ JLPT TỪ FILE EXCEL'],
    [`Cấp độ: ${level} — tổng ${bp.total_questions} câu theo chuẩn JLPT.`],
    [''],
    ['- Mỗi sheet là MỘT mondai của đề, tên sheet dạng "1.2 Chính tả" = phần 1, mondai 2.'],
    ['  KHÔNG đổi phần SỐ ở đầu tên sheet (hệ thống nhận diện mondai theo số đó).'],
    ['- Điền mỗi câu một dòng, KHÔNG sửa dòng tiêu đề. Dòng ví dụ có sẵn — xóa/thay bằng câu thật.'],
    ['- correct: số thứ tự đáp án đúng (1-4, chấp nhận cả A-D).'],
    ['- explanation / translation_vi / option_translation_..: giải thích & bản dịch tiếng Việt (tùy chọn).'],
    ['- Sheet dạng ĐỌC HIỂU: ô B1 (cạnh nhãn passage_text) là đoạn văn dùng chung của mondai;'],
    ['  bảng câu hỏi bắt đầu từ dòng 3. Thay đoạn văn ví dụ bằng nội dung thật.'],
    ['- Sheet dạng NGHE: cột audio_transcript là script bài nghe (bắt buộc), mỗi lượt thoại một dòng'],
    ['  bắt đầu bằng nhãn 「男：」/「女：」. File audio KHÔNG nằm trong Excel — sau khi tạo đề,'],
    ['  vào trình soạn đề bấm "Tạo audio (TTS)" hoặc tải file thu âm lên cho từng câu.'],
    ['- Ảnh minh họa (発話表現, 情報検索…) cũng bổ sung sau trong trình soạn đề.'],
    ['- Sheet nào bỏ trống/xóa đi → mondai đó để trống, soạn tiếp trong trình soạn đề.'],
    ['- Đề tạo ra luôn là BẢN NHÁP — kiểm tra lại rồi mới xuất bản (hệ thống validate khi xuất bản).'],
    [`- Tối đa ${MAX_ROWS} dòng dữ liệu toàn file.`],
    [''],
    ['Số câu chuẩn từng mondai:'],
    ...bp.sections.flatMap((s, si) =>
      s.groups.map((g, gi) => [`  ${si + 1}.${gi + 1} ${MONDAI_TYPES[g.mondai_type].ja} (${MONDAI_TYPES[g.mondai_type].vi}): ${g.question_count} câu`])),
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Hướng dẫn');

  bp.sections.forEach((s, si) => {
    s.groups.forEach((g, gi) => {
      const meta = MONDAI_TYPES[g.mondai_type];
      const headers = templateHeaders(meta);
      const ex = exampleRow(meta);
      let rows;
      if (isPassageType(g.mondai_type)) {
        rows = [['passage_text', SAMPLE_PASSAGE], [], headers];
        if (ex) rows.push(ex);
      } else {
        rows = [headers];
        if (ex) rows.push(ex);
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = colWidths(headers);
      XLSX.utils.book_append_sheet(wb, ws, sheetTitle(si + 1, gi + 1, meta));
    });
  });

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Parse workbook → preview nguyên đề ────────────────────────────────────────
// → { level, mondais: [{section_position, mondai_number, mondai_type, passage_text,
//     questions: [{row, question}]}], errors: [{sheet, row, message}], warnings }

// Nhãn ô đoạn văn ở A1 của sheet passage (đã normalize)
const PASSAGE_CELL_ALIASES = ['passage text', 'noi dung doan van', 'doan van', 'van ban'];

function parseExamImport({ buffer, filename, level }) {
  const bp = BLUEPRINTS[level];
  if (!bp) throw httpError(400, 'Cấp độ JLPT không hợp lệ.');
  const ext = (filename.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls')
    throw httpError(400, 'Import nguyên đề cần file .xlsx nhiều sheet theo file mẫu — hãy tải file mẫu.');

  let wb;
  try { wb = XLSX.read(buffer, { type: 'buffer' }); }
  catch { throw httpError(400, 'Không thể đọc file — file có thể bị hỏng hoặc sai định dạng.'); }

  // Map "vị_trí_phần.số_mondai" → slot blueprint
  const slots = {};
  bp.sections.forEach((s, si) => s.groups.forEach((g, gi) => {
    slots[`${si + 1}.${gi + 1}`] = {
      section_position: si + 1, mondai_number: gi + 1,
      mondai_type: g.mondai_type, std: g.question_count,
    };
  }));

  const errors = [];
  const warnings = [];
  const mondais = [];
  const speakerWarnRows = [];
  const seen = new Set();
  let totalRows = 0;

  for (const name of wb.SheetNames) {
    if (normalizeHeader(name) === 'huong dan') continue;
    const m = name.match(/^\s*(\d+)\s*\.\s*(\d+)/);
    if (!m) { warnings.push(`Bỏ qua sheet "${name}" — tên không bắt đầu bằng "số_phần.số_mondai" như file mẫu.`); continue; }
    const key = `${Number(m[1])}.${Number(m[2])}`;
    const slot = slots[key];
    if (!slot) { warnings.push(`Bỏ qua sheet "${name}" — không khớp mondai nào của khung đề ${level}.`); continue; }
    if (seen.has(key)) { warnings.push(`Bỏ qua sheet "${name}" — mondai ${key} đã có sheet khác.`); continue; }
    seen.add(key);

    const meta = MONDAI_TYPES[slot.mondai_type];
    const ws = wb.Sheets[name];
    const entry = { ...slot, passage_text: null, questions: [] };
    delete entry.std;

    // Câu/đoạn văn ví dụ của template — chặn nhập nhầm
    let exampleText = null, exampleTranscript = null;
    try {
      const ex = JSON.parse(meta.example);
      exampleText = ex.question_text || null;
      exampleTranscript = ex.audio_transcript || null;
    } catch { /* bỏ qua */ }

    // Sheet → danh sách row object {header: value} + (passage nếu là dạng đọc)
    let rows;   // object rows
    let headerRowNo = 1; // dòng Excel của header (để báo lỗi "dòng N" đúng vị trí)
    if (isPassageType(slot.mondai_type)) {
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      let headerIdx = -1;
      let headers = null;
      for (let i = 0; i < aoa.length; i++) {
        const first = normalizeHeader(aoa[i][0]);
        if (entry.passage_text === null && PASSAGE_CELL_ALIASES.includes(first)) {
          entry.passage_text = String(aoa[i][1] || '').trim() || null;
          continue;
        }
        const probe = buildMapping(aoa[i].map(c => String(c)), meta);
        if (probe.missing.length === 0) { headerIdx = i; headers = aoa[i].map(c => String(c)); break; }
      }
      if (headerIdx === -1) {
        errors.push({ sheet: name, row: '-', message: 'Không nhận diện được bảng câu hỏi — dùng đúng cấu trúc file mẫu (ô đoạn văn ở đầu + bảng câu hỏi từ dòng 3).' });
        mondais.push(entry); continue;
      }
      if (entry.passage_text === SAMPLE_PASSAGE) {
        errors.push({ sheet: name, row: 1, message: 'Đoạn văn vẫn là nội dung ví dụ của file mẫu — hãy thay bằng đoạn văn thật.' });
        entry.passage_text = null;
      }
      headerRowNo = headerIdx + 1;
      rows = aoa.slice(headerIdx + 1).map(r => {
        const obj = {};
        headers.forEach((h, ci) => { if (h) obj[h] = r[ci]; });
        return obj;
      });
    } else {
      rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    }

    totalRows += rows.length;
    const headerNames = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const { mapping, missing } = buildMapping(headerNames, meta);
    if (missing.length > 0) {
      if (rows.length > 0)
        errors.push({ sheet: name, row: '-', message: `Không nhận diện được cột bắt buộc (${missing.join(', ')}) — dùng đúng file mẫu.` });
      mondais.push(entry); continue;
    }

    rows.forEach((row, i) => {
      const rowNo = headerRowNo + 1 + i;
      const parsed = rowToQuestion(row, mapping, meta);
      if (!parsed) return; // dòng trống
      if (parsed.error) { errors.push({ sheet: name, row: rowNo, message: parsed.error }); return; }
      const qs = parsed.question;
      if ((exampleText && qs.question_text === exampleText)
          || (!exampleText && exampleTranscript && qs.audio_transcript === exampleTranscript)) {
        errors.push({ sheet: name, row: rowNo, message: 'Trùng câu ví dụ trong file mẫu — hãy xóa hoặc thay bằng câu thật.' });
        return;
      }
      if (parsed.warning) speakerWarnRows.push(`${name} dòng ${rowNo}`);
      entry.questions.push({ row: rowNo, question: qs });
    });

    if (entry.questions.length > 0 && entry.questions.length !== slot.std)
      warnings.push(`Sheet "${name}": ${entry.questions.length} câu — chuẩn JLPT là ${slot.std} câu (không chặn, có thể bổ sung sau).`);
    mondais.push(entry);
  }

  if (totalRows > MAX_ROWS)
    throw httpError(400, `Tối đa ${MAX_ROWS} dòng dữ liệu mỗi lần nhập (file có ${totalRows} dòng).`);

  if (speakerWarnRows.length > 0)
    warnings.push(`${speakerWarnRows.join(', ')}: script không có nhãn giọng 「男：」/「女：」 — TTS sẽ đọc toàn bộ bằng một giọng.`);

  const missingSlots = Object.keys(slots).filter(k => !seen.has(k) || !mondais.find(e => `${e.section_position}.${e.mondai_number}` === k)?.questions.length);
  if (missingSlots.length > 0)
    warnings.push(`${missingSlots.length} mondai chưa có câu (${missingSlots.join(', ')}) — sẽ để trống trong đề nháp, soạn tiếp trong trình soạn đề.`);

  const totalQuestions = mondais.reduce((sum, e) => sum + e.questions.length, 0);
  if (totalQuestions === 0 && errors.length === 0)
    throw httpError(400, 'File không có câu hỏi hợp lệ nào — kiểm tra lại theo file mẫu.');

  const hasAudioQuestions = mondais.some(e =>
    MONDAI_TYPES[e.mondai_type].category === 'listening' && e.questions.length > 0);
  if (hasAudioQuestions)
    warnings.push('Các câu nghe CHƯA có file audio — sau khi tạo đề, dùng nút "Tạo audio (TTS)" hoặc tải file thu âm lên cho từng câu trong trình soạn đề.');

  return { level, total_questions: totalQuestions, mondais, errors, warnings };
}

module.exports = { buildExamImportTemplate, parseExamImport };
