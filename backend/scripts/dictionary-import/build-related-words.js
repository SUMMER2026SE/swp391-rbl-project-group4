'use strict';

// ─── Xây danh sách từ liên quan/đối nghĩa từ JMdict (related/antonym xref) ───
// Đọc data/jmdict-eng.json + entries-with-senses.json, với mỗi sense có "related"/"antonym"
// trỏ tới kanji/kana của từ khác đã import, resolve sang entry_id và insert dict_related_words.

const fs = require('fs');
const path = require('path');
const { DATA_DIR, dictDb, readCheckpoint, chunk, getLimitArg } = require('./_shared');

const BATCH_SIZE = 500;

function main() {
  const limit = getLimitArg();

  console.log('→ Đọc jmdict-eng.json và entries-with-senses.json...');
  const jmdict = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jmdict-eng.json'), 'utf8'));
  let entries = readCheckpoint('entries-with-senses.json', []);
  if (limit) entries = entries.slice(0, limit);

  const sourceIdSet = new Set(entries.map((e) => e.source_id));
  const entryIdBySourceId = new Map(entries.map((e) => [e.source_id, e.entry_id]));

  // Lookup kanji/kana text -> entry_id (chỉ trong tập đã import)
  const entryIdByText = new Map();
  for (const e of entries) {
    if (e.kanji) entryIdByText.set(e.kanji, e.entry_id);
    if (e.kana) entryIdByText.set(e.kana, e.entry_id);
  }

  const pairs = new Map(); // key `${entry_id}:${related_id}:${type}` -> row

  for (const word of jmdict.words) {
    if (!sourceIdSet.has(word.id)) continue;
    const entryId = entryIdBySourceId.get(word.id);

    for (const sense of word.sense) {
      for (const [field, type] of [['related', 'related'], ['antonym', 'antonym']]) {
        for (const xref of sense[field] || []) {
          const text = xref[0];
          const relatedId = entryIdByText.get(text);
          if (!relatedId || relatedId === entryId) continue;

          const key = `${entryId}:${relatedId}:${type}`;
          if (!pairs.has(key)) {
            pairs.set(key, { entry_id: entryId, related_id: relatedId, relation_type: type });
          }
        }
      }
    }
  }

  const rows = [...pairs.values()];
  console.log(`→ Tìm thấy ${rows.length} cặp từ liên quan/đối nghĩa.`);

  const batches = chunk(rows, BATCH_SIZE);

  (async () => {
    for (let i = 0; i < batches.length; i++) {
      const { error } = await dictDb
        .from('dict_related_words')
        .upsert(batches[i], { onConflict: 'entry_id,related_id,relation_type' });

      if (error) {
        console.error(`✗ Lỗi batch ${i}:`, error.message);
        process.exit(1);
      }
      console.log(`✓ Batch ${i + 1}/${batches.length} (${batches[i].length} cặp) đã upsert.`);
    }
    console.log('\nHoàn tất build-related-words.');
  })().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}

if (require.main === module) main();
