'use strict';

// ─── Lọc từ vựng JMdict theo JLPT N5-N1 và upsert vào dict_entries ───
// Đọc data/jmdict-eng.json + data/jlpt-index.json, lọc các từ có trong danh sách JLPT,
// sinh romaji bằng wanakana, upsert theo (source, source_id).
// Ghi data/entries-with-senses.json để translate-senses.js dùng ở bước sau.

const fs = require('fs');
const path = require('path');
const wanakana = require('wanakana');
const { DATA_DIR, dictDb, readCheckpoint, writeCheckpoint, chunk, getLimitArg } = require('./_shared');

const BATCH_SIZE = 500;
const CHECKPOINT_FILE = 'import-entries.checkpoint.json';

function findJlptLevel(word, jlptIndex) {
  for (const k of word.kanji) {
    if (jlptIndex[k.text]) return jlptIndex[k.text];
  }
  for (const k of word.kana) {
    if (jlptIndex[k.text]) return jlptIndex[k.text];
  }
  return null;
}

function isCommon(word) {
  return word.kanji.some((k) => k.common) || word.kana.some((k) => k.common);
}

function main() {
  const limit = getLimitArg();

  console.log('→ Đọc jmdict-eng.json và jlpt-index.json...');
  const jmdict = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jmdict-eng.json'), 'utf8'));
  const jlptIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jlpt-index.json'), 'utf8'));

  console.log('→ Lọc từ vựng theo danh sách JLPT...');
  let filtered = jmdict.words
    .map((word) => ({ word, level: findJlptLevel(word, jlptIndex) }))
    .filter((x) => x.level !== null);

  if (limit) filtered = filtered.slice(0, limit);
  console.log(`→ Tìm thấy ${filtered.length} từ thuộc JLPT N5-N1.`);

  const records = filtered.map(({ word, level }) => {
    const kanji = word.kanji[0]?.text || null;
    const kana = word.kana[0]?.text || '';
    return {
      kanji,
      kana,
      romaji: wanakana.toRomaji(kana),
      jlpt_level: level,
      is_common: isCommon(word),
      source: 'jmdict',
      source_id: word.id,
      _word: word, // giữ tạm để sinh senses, sẽ bị loại khi insert
    };
  });

  const batches = chunk(records, BATCH_SIZE);
  let startBatch = readCheckpoint(CHECKPOINT_FILE, { lastBatch: -1 }).lastBatch + 1;
  if (startBatch > 0) console.log(`→ Tiếp tục từ batch ${startBatch}/${batches.length} (checkpoint).`);

  const entriesWithSenses = readCheckpoint('entries-with-senses.json', []);

  (async () => {
    for (let i = startBatch; i < batches.length; i++) {
      const batch = batches[i];
      const rows = batch.map(({ _word, ...rest }) => rest);

      const { data, error } = await dictDb
        .from('dict_entries')
        .upsert(rows, { onConflict: 'source,source_id' })
        .select('id, source_id');

      if (error) {
        console.error(`✗ Lỗi batch ${i}:`, error.message);
        process.exit(1);
      }

      const idBySourceId = new Map(data.map((r) => [r.source_id, r.id]));

      for (const rec of batch) {
        const entryId = idBySourceId.get(rec.source_id);
        if (!entryId) continue;
        entriesWithSenses.push({
          entry_id: entryId,
          source_id: rec.source_id,
          kanji: rec.kanji,
          kana: rec.kana,
          senses: rec._word.sense.map((s) => ({
            pos: s.partOfSpeech.join(', '),
            glosses: s.gloss.filter((g) => g.lang === 'eng').map((g) => g.text),
          })),
        });
      }

      writeCheckpoint('entries-with-senses.json', entriesWithSenses);
      writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      console.log(`✓ Batch ${i + 1}/${batches.length} (${rows.length} từ) đã upsert.`);
    }

    console.log(`\nHoàn tất import-entries. Tổng ${entriesWithSenses.length} entry đã ghi vào entries-with-senses.json.`);
  })().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}

if (require.main === module) main();
