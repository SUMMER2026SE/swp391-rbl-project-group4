'use strict';

// ─── Import âm Hán Việt + nghĩa + cách đọc on/kun từ KanjiDictVN vào dict_kanji ───
// Đọc data/kanjidic-vi/kanji_bank_*.json (Hán Việt + nghĩa tiếng Việt) và
// data/kanjidic-en/kanji_bank_*.json (on/kun reading),
// ghép theo ký tự, upsert vào dict_kanji (onConflict: character).

const fs = require('fs');
const path = require('path');
const { DATA_DIR, dictDb, chunk, getLimitArg } = require('./_shared');

const BATCH_SIZE = 500;

function loadBankFiles(dirName) {
  const dir = path.join(DATA_DIR, dirName);
  const files = fs.readdirSync(dir).filter((f) => /^kanji_bank_\d+\.json$/.test(f));
  let entries = [];
  for (const f of files) {
    entries = entries.concat(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  return entries;
}

// Loại bỏ tiền tố "[âm] " trong các nghĩa tiếng Việt và nối lại
function cleanViMeanings(meanings) {
  return meanings
    .map((m) => m.replace(/^\[[^\]]*\]\s*/, '').trim())
    .filter(Boolean)
    .join('; ');
}

function main() {
  const limit = getLimitArg();

  console.log('→ Đọc kanjidic-vi và kanjidic-en...');
  const viEntries = loadBankFiles('kanjidic-vi');
  const enEntries = loadBankFiles('kanjidic-en');

  const enByChar = new Map(enEntries.map((e) => [e[0], e]));

  let records = viEntries.map((vi) => {
    const character = vi[0];
    const en = enByChar.get(character);

    const hanViet = (vi[1] || '').trim().split(/\s+/).filter(Boolean).join(', ') || null;
    const meaningVi = cleanViMeanings(vi[4] || []) || null;

    const readingOn = en ? (en[1] || '').trim().split(/\s+/).filter(Boolean) : [];
    const readingKun = en ? (en[2] || '').trim().split(/\s+/).filter(Boolean) : [];

    return {
      character,
      sino_vi: hanViet,
      meaning_vi: meaningVi,
      reading_on: readingOn,
      reading_kun: readingKun,
    };
  });

  if (limit) records = records.slice(0, limit);
  console.log(`→ Chuẩn bị upsert ${records.length} ký tự kanji.`);

  const batches = chunk(records, BATCH_SIZE);

  (async () => {
    for (let i = 0; i < batches.length; i++) {
      const { error } = await dictDb
        .from('dict_kanji')
        .upsert(batches[i], { onConflict: 'character' });

      if (error) {
        console.error(`✗ Lỗi batch ${i}:`, error.message);
        process.exit(1);
      }
      console.log(`✓ Batch ${i + 1}/${batches.length} (${batches[i].length} kanji) đã upsert.`);
    }
    console.log('\nHoàn tất import-kanji-readings.');
  })().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}

if (require.main === module) main();
