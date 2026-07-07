'use strict';

// Đọc file import (.json/.csv/.xlsx/.xls/.docx) thành mảng item chuẩn cho
// vocab / kanji / grammar. Luôn thử parse trực tiếp bằng code trước; chỉ gọi AI
// (pattern /ai/check-json) khi không map được cột bắt buộc, quá nhiều dòng thiếu
// field required, hoặc file Word không có bảng. KHÔNG ghi DB — chỉ trả preview.

const XLSX = require('xlsx');
const mammoth = require('mammoth');
const { parse: parseCsv } = require('csv-parse/sync');
const { chatCompletion } = require('../config/ai');

const MAX_ROWS = 500;              // đồng bộ với cap của import JSON hiện tại
const MAX_AI_CHARS = 30000;        // đồng bộ với cap rawText của /ai/check-json
const AI_MISSING_RATIO = 0.2;      // >20% dòng thiếu field required → nhờ AI

// ── Field spec theo loại (field list y hệt schema import JSON hiện tại) ────────
// Alias viết ở dạng đã normalize (thường, không dấu) — xem normalizeHeader().
const FIELD_SPECS = {
  vocab: {
    required: ['reading', 'meaning_vi'],
    fields: {
      kanji:            ['kanji', 'chu han', 'han tu', 'tu vung', 'tu', 'word', '漢字'],
      reading:          ['reading', 'cach doc', 'hiragana', 'furigana', 'yomi', 'phien am', 'よみ'],
      meaning_vi:       ['meaning_vi', 'meaning vi', 'nghia', 'nghia tieng viet', 'nghia viet', 'y nghia', 'meaning', 'vietnamese'],
      meaning_ja:       ['meaning_ja', 'meaning ja', 'nghia tieng nhat', 'nghia nhat', '意味'],
      level:            ['level', 'cap do', 'jlpt', 'trinh do'],
      type:             ['type', 'loai tu', 'tu loai', 'loai', 'pos'],
      topic:            ['topic', 'chu de'],
      example_sentence: ['example_sentence', 'example sentence', 'example', 'vi du', 'cau vi du', '例文'],
    },
  },
  kanji: {
    required: ['character', 'meaning_vi'],
    fields: {
      character:        ['character', 'kanji', 'chu', 'chu han', 'han tu', 'ky tu', '漢字'],
      reading_on:       ['reading_on', 'reading on', 'on', 'onyomi', 'on yomi', 'am on', '音読み'],
      reading_kun:      ['reading_kun', 'reading kun', 'kun', 'kunyomi', 'kun yomi', 'am kun', '訓読み'],
      meaning_vi:       ['meaning_vi', 'meaning vi', 'nghia', 'nghia tieng viet', 'nghia viet', 'y nghia', 'meaning', 'vietnamese'],
      stroke_count:     ['stroke_count', 'stroke count', 'strokes', 'so net', 'net'],
      han_viet:         ['han_viet', 'han viet', 'am han viet'],
      level:            ['level', 'cap do', 'jlpt', 'trinh do'],
    },
  },
  grammar: {
    required: ['title', 'meaning_vi'],
    fields: {
      title:            ['title', 'cau truc', 'mau cau', 'ngu phap', 'mau ngu phap', 'grammar', 'structure'],
      title_ja:         ['title_ja', 'title ja', 'tieu de tieng nhat'],
      meaning_vi:       ['meaning_vi', 'meaning vi', 'nghia', 'nghia tieng viet', 'y nghia', 'meaning', 'vietnamese'],
      explanation:      ['explanation', 'giai thich', 'cach dung', 'usage', 'ghi chu'],
      example_sentence: ['example_sentence', 'example sentence', 'example', 'vi du', 'cau vi du', '例文'],
      level:            ['level', 'cap do', 'jlpt', 'trinh do'],
    },
  },
};

const TYPE_LABEL = { vocab: 'từ vựng', kanji: 'kanji', grammar: 'ngữ pháp' };

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// "Nghĩa Tiếng Việt " → "nghia tieng viet" (giữ nguyên ký tự CJK/kana)
function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_\-./()*:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Parse theo định dạng file → mảng row object { header: value } ─────────────

function rowsFromCsv(buffer) {
  return parseCsv(buffer, {
    columns: true, bom: true, skip_empty_lines: true, trim: true,
    relax_column_count: true, relax_quotes: true,
  });
}

function rowsFromXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function decodeHtmlText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Docx: ưu tiên bảng đầu tiên (mammoth xuất HTML table sạch, parse bằng regex đủ
// tin cậy); không có bảng → trả rawText để đi đường AI.
async function rowsFromDocx(buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/);
  if (!tableMatch) {
    const { value: rawText } = await mammoth.extractRawText({ buffer });
    return { rows: null, rawText };
  }
  const trMatches = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
  const grid = trMatches.map(tr =>
    (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || []).map(decodeHtmlText)
  );
  if (grid.length < 2) {
    const { value: rawText } = await mammoth.extractRawText({ buffer });
    return { rows: null, rawText };
  }
  const headers = grid[0];
  const rows = grid.slice(1)
    .filter(cells => cells.some(c => c !== ''))
    .map(cells => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
  return { rows, rawText: null };
}

// ── Map header → field chuẩn ──────────────────────────────────────────────────

function buildHeaderMapping(headers, spec) {
  const mapping = {}; // header gốc → field chuẩn (nhiều header có thể trỏ cùng field,
                      // vd JSON mỗi dòng dùng tên key khác nhau — giá trị đầu tiên thắng)
  for (const h of headers) {
    const norm = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(spec.fields)) {
      if (aliases.includes(norm)) {
        mapping[h] = field;
        break;
      }
    }
  }
  return mapping;
}

function rowsToItems(rows, mapping) {
  return rows.map(row => {
    const item = {};
    for (const [header, field] of Object.entries(mapping)) {
      const v = row[header];
      const s = v === undefined || v === null ? '' : String(v).trim();
      if (s !== '' && item[field] === undefined) item[field] = s;
    }
    if (item.level) {
      const m = item.level.toUpperCase().match(/N[1-5]/);
      item.level = m ? m[0] : item.level;
    }
    return item;
  }).filter(item => Object.keys(item).length > 0);
}

// ── AI fallback: chuẩn hóa dữ liệu lộn xộn thành mảng item chuẩn ───────────────

function aiPrompt(type) {
  const spec = FIELD_SPECS[type];
  const fieldList = Object.keys(spec.fields).join(', ');
  const required = spec.required.join(', ');
  return `Bạn là chuyên gia tiếng Nhật. Dữ liệu đầu vào là nội dung file ${TYPE_LABEL[type]} do giáo viên soạn, có thể lộn xộn (thiếu cột, gộp nhiều thông tin một dòng, không có cấu trúc bảng).

Nhiệm vụ: trích xuất và chuẩn hóa thành mảng JSON, mỗi phần tử là một ${TYPE_LABEL[type]} với các trường: ${fieldList}.
- Trường bắt buộc: ${required} — suy ra từ ngữ cảnh nếu dòng gốc thiếu.
- level nếu có phải là N5/N4/N3/N2/N1.${type === 'vocab' ? '\n- type nếu có phải là: DANH TỪ/ĐỘNG TỪ/TÍNH TỪ/PHÓ TỪ/LIÊN TỪ.' : ''}${type === 'kanji' ? '\n- reading_on (katakana) và reading_kun (hiragana) là mảng chuỗi.' : ''}
- Bỏ qua dòng tiêu đề, ghi chú, dòng không phải dữ liệu.
- Mỗi phần tử thêm "_notes": mô tả ngắn (tiếng Việt) những gì đã suy ra/sửa, "" nếu giữ nguyên; và "_changed": true nếu có chỉnh sửa/suy ra, ngược lại false.

Trả về ĐÚNG mảng JSON hợp lệ, không giải thích gì ngoài JSON.`;
}

async function aiNormalize(type, rawText) {
  if (rawText.length > MAX_AI_CHARS)
    throw httpError(400, `Nội dung quá dài để AI xử lý (tối đa ${MAX_AI_CHARS} ký tự). Hãy chia nhỏ file hoặc dùng đúng cột chuẩn.`);

  let result;
  try {
    result = await chatCompletion(
      [{ role: 'system', content: aiPrompt(type) }, { role: 'user', content: 'Chuẩn hóa dữ liệu sau:\n' + rawText }],
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

// ── Entry point ───────────────────────────────────────────────────────────────
// → { items, source: 'direct' | 'ai', warnings: string[] }

async function parseImportFile({ buffer, filename, type }) {
  const spec = FIELD_SPECS[type];
  if (!spec) throw httpError(400, 'Loại import không hợp lệ.');

  const ext = (filename.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
  const warnings = [];
  let rows = null;      // mảng row object theo header
  let rawText = null;   // fallback cho AI khi không có cấu trúc bảng

  try {
    if (ext === 'json') {
      const text = buffer.toString('utf8');
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('not-array');
        rows = parsed;
      } catch {
        rawText = text; // JSON hỏng format → AI sửa
      }
    } else if (ext === 'csv') {
      rows = rowsFromCsv(buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      rows = rowsFromXlsx(buffer);
    } else if (ext === 'docx') {
      ({ rows, rawText } = await rowsFromDocx(buffer));
    } else {
      throw httpError(400, 'Định dạng không hỗ trợ. Chỉ chấp nhận .json, .csv, .xlsx, .xls, .docx.');
    }
  } catch (err) {
    if (err.status) throw err;
    throw httpError(400, 'Không thể đọc file — file có thể bị hỏng hoặc sai định dạng.');
  }

  if (rows && rows.length === 0 && !rawText)
    throw httpError(400, 'File không có dữ liệu.');
  if (rows && rows.length > MAX_ROWS)
    throw httpError(400, `Tối đa ${MAX_ROWS} dòng mỗi lần nhập (file có ${rows.length} dòng).`);

  // ── Thử map trực tiếp ────────────────────────────────────────────────────────
  if (rows) {
    const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const mapping = buildHeaderMapping(headers, spec);
    const mappedFields = Object.values(mapping);
    const missingRequiredCols = spec.required.filter(f => !mappedFields.includes(f));

    if (missingRequiredCols.length === 0) {
      const items = rowsToItems(rows, mapping);
      const missingCount = items.filter(it => spec.required.some(f => !it[f])).length;
      if (items.length > 0 && missingCount / items.length <= AI_MISSING_RATIO) {
        const unmapped = headers.filter(h => !(h in mapping));
        if (unmapped.length)
          warnings.push(`Bỏ qua cột không nhận diện được: ${unmapped.join(', ')}.`);
        if (missingCount > 0)
          warnings.push(`${missingCount} dòng thiếu trường bắt buộc (${spec.required.join(', ')}) — hãy sửa hoặc xóa trước khi nhập.`);
        return { items, source: 'direct', warnings };
      }
      warnings.push(`Hơn ${Math.round(AI_MISSING_RATIO * 100)}% dòng thiếu trường bắt buộc — đã nhờ AI chuẩn hóa.`);
    } else {
      warnings.push(`Không nhận diện được cột bắt buộc: ${missingRequiredCols.join(', ')} — đã nhờ AI chuẩn hóa.`);
    }
    rawText = JSON.stringify(rows, null, 1);
  } else {
    warnings.push('File không có cấu trúc bảng rõ ràng — đã nhờ AI trích xuất nội dung.');
  }

  // ── AI fallback ──────────────────────────────────────────────────────────────
  const items = await aiNormalize(type, rawText);
  if (!Array.isArray(items) || items.length === 0)
    throw httpError(400, 'AI không trích xuất được mục nào từ file.');
  if (items.length > MAX_ROWS)
    throw httpError(400, `Tối đa ${MAX_ROWS} dòng mỗi lần nhập.`);
  return { items, source: 'ai', warnings };
}

module.exports = { parseImportFile };
