'use strict';

// ─── Import câu ví dụ từ jmdict-examples-eng vào dict_examples ───
// Với mỗi entry đã import (entries-with-senses.json), tìm các sense có "examples"
// trong jmdict-examples-eng.json, dịch câu tiếng Anh sang tiếng Việt bằng AI (batch),
// tối đa MAX_EXAMPLES_PER_SENSE câu/sense, rồi insert vào dict_examples.

const fs = require('fs');
const path = require('path');
const { DATA_DIR, dictDb, readCheckpoint, writeCheckpoint, appendFailedBatch, chunk, getLimitArg, sleep } = require('./_shared');
const { chatCompletion } = require('../../config/ai');

const MAX_EXAMPLES_PER_SENSE = 3;
const TRANSLATE_BATCH_SIZE = 25;
const CHECKPOINT_FILE = 'import-examples.checkpoint.json';
const FAILED_FILE = 'import-examples.failed-batches.json';

function buildPrompt(items) {
  const input = items.map((it, idx) => ({ id: idx, en: it.sentenceEn }));
  return [
    {
      role: 'system',
      content:
        'Bạn là dịch giả Nhật-Việt. Dịch các câu tiếng Anh sang tiếng Việt tự nhiên, ngắn gọn. ' +
        'Chỉ trả về JSON hợp lệ theo đúng format yêu cầu, không thêm giải thích, không bọc markdown.',
    },
    {
      role: 'user',
      content:
        `Dịch trường "en" sang tiếng Việt (trường "vi"), giữ nguyên "id". ` +
        `Trả về JSON dạng: [{"id":0,"vi":"..."}]\n\n` + JSON.stringify(input),
    },
  ];
}

function parseResponse(content) {
  let text = content.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(text);
}

async function main() {
  const limit = getLimitArg();

  console.log('→ Đọc entries-with-senses.json và jmdict-examples-eng.json...');
  let entries = readCheckpoint('entries-with-senses.json', []);
  if (limit) entries = entries.slice(0, limit);

  const examplesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jmdict-examples-eng.json'), 'utf8'));
  const wordById = new Map(examplesData.words.map((w) => [w.id, w]));

  // Lấy danh sách dict_senses (id, entry_id, order_index) cho các entry liên quan
  const entryIds = entries.map((e) => e.entry_id);
  const senseByEntryOrder = new Map();
  for (const idsBatch of chunk(entryIds, 100)) {
    const { data, error } = await dictDb
      .from('dict_senses')
      .select('id, entry_id, order_index')
      .in('entry_id', idsBatch);
    if (error) throw error;
    for (const s of data) senseByEntryOrder.set(`${s.entry_id}:${s.order_index}`, s.id);
  }

  // Thu thập câu ví dụ thô (chưa dịch) cho từng sense
  const pending = []; // { sense_id, sentence_jp, sentenceEn }

  for (const entry of entries) {
    const word = wordById.get(entry.source_id);
    if (!word) continue;

    word.sense.forEach((sense, orderIndex) => {
      const senseId = senseByEntryOrder.get(`${entry.entry_id}:${orderIndex}`);
      if (!senseId || !sense.examples?.length) return;

      for (const ex of sense.examples.slice(0, MAX_EXAMPLES_PER_SENSE)) {
        const jp = ex.sentences.find((s) => s.lang === 'jpn')?.text;
        const en = ex.sentences.find((s) => s.lang === 'eng')?.text;
        if (!jp) continue;
        pending.push({ sense_id: senseId, sentence_jp: jp, sentenceEn: en || '' });
      }
    });
  }

  console.log(`→ Tìm thấy ${pending.length} câu ví dụ cần dịch & lưu.`);

  const batches = chunk(pending, TRANSLATE_BATCH_SIZE);
  let startBatch = readCheckpoint(CHECKPOINT_FILE, { lastBatch: -1 }).lastBatch + 1;
  if (startBatch > 0) console.log(`→ Tiếp tục từ batch ${startBatch}/${batches.length} (checkpoint).`);

  for (let i = startBatch; i < batches.length; i++) {
    const batch = batches[i];

    try {
      let translations = {};
      const toTranslate = batch.filter((b) => b.sentenceEn);
      if (toTranslate.length > 0) {
        const response = await chatCompletion(buildPrompt(toTranslate), { temperature: 0.2, max_tokens: 2048 });
        const content = response.choices?.[0]?.message?.content || '';
        const parsed = parseResponse(content);
        for (const item of parsed) translations[toTranslate[item.id]?.sentence_jp] = item.vi;
      }

      const rows = batch.map((b) => ({
        sense_id: b.sense_id,
        sentence_jp: b.sentence_jp,
        sentence_vi: translations[b.sentence_jp] || null,
      }));

      const { error } = await dictDb.from('dict_examples').upsert(rows, { onConflict: 'sense_id,sentence_jp' });
      if (error) throw error;

      writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      console.log(`✓ Batch ${i + 1}/${batches.length} (${rows.length} câu) đã lưu.`);
    } catch (err) {
      console.error(`✗ Lỗi batch ${i}:`, err.message);
      appendFailedBatch(FAILED_FILE, { batch: i, error: err.message });
      writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
    }

    await sleep(300);
  }

  console.log('\nHoàn tất import-examples.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}
