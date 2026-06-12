'use strict';

// ─── Xây chỉ mục JLPT từ elzup/jlpt-word-list ───
// Đọc data/jlpt-all.csv, tạo map { "kanji_hoặc_kana" -> "N5".."N1" }
// và ghi ra data/jlpt-index.json để import-entries.js dùng lọc từ vựng.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CSV_PATH = path.join(DATA_DIR, 'jlpt-all.csv');
const OUT_PATH = path.join(DATA_DIR, 'jlpt-index.json');

// Parse 1 dòng CSV đơn giản, hỗ trợ field bọc trong dấu " có chứa dấu phẩy
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

// Trích level "N1".."N5" từ chuỗi tags, ví dụ "JLPT JLPT_5 JLPT_N5" hoặc "JLPT_1 JLPT"
function extractLevel(tags) {
  const nMatch = tags.match(/JLPT_N([1-5])/);
  if (nMatch) return `N${nMatch[1]}`;
  const numMatch = tags.match(/JLPT_([1-5])(?!\d)/);
  if (numMatch) return `N${numMatch[1]}`;
  return null;
}

// Mức độ khó tăng dần N5 (dễ) -> N1 (khó); khi 1 từ xuất hiện nhiều lần, giữ level khó nhất
const LEVEL_RANK = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };

function main() {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim());
  const header = parseCsvLine(lines[0]);
  const idx = {
    expression: header.indexOf('expression'),
    reading: header.indexOf('reading'),
    tags: header.indexOf('tags'),
  };

  const index = {};
  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const expression = fields[idx.expression]?.trim();
    const reading = fields[idx.reading]?.trim();
    const tags = fields[idx.tags] || '';
    const level = extractLevel(tags);
    if (!level) continue;

    for (const key of [expression, reading]) {
      if (!key) continue;
      const existing = index[key];
      if (!existing || LEVEL_RANK[level] > LEVEL_RANK[existing]) {
        index[key] = level;
      }
    }
    count++;
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(index, null, 0));
  console.log(`Đã lập chỉ mục ${count} dòng JLPT -> ${Object.keys(index).length} khoá (kanji/kana) trong ${OUT_PATH}`);
}

if (require.main === module) main();

module.exports = { parseCsvLine, extractLevel };
