'use strict';

// ─── Dịch nghĩa (gloss tiếng Anh) sang tiếng Việt bằng AI và insert dict_senses ───
// Đọc data/entries-with-senses.json (sinh bởi import-entries.js), gom theo batch,
// gọi chatCompletion() để dịch, rồi insert vào dict_senses.
// Hỗ trợ resume qua checkpoint + ghi log batch lỗi vào failed-batches.json.

const path = require('path');
const { DATA_DIR, dictDb, readCheckpoint, writeCheckpoint, appendFailedBatch, chunk, getLimitArg, sleep } = require('./_shared');
const { chatCompletion } = require('../../config/ai');

const BATCH_SIZE = 20;
const CHECKPOINT_FILE = 'translate-senses.checkpoint.json';
const FAILED_FILE = 'translate-senses.failed-batches.json';

function buildPrompt(items) {
  const input = items.map((it, idx) => ({
    id: idx,
    word: it.kanji || it.kana,
    senses: it.senses.map((s, i) => ({ i, en: s.glosses.join('; ') })),
  }));

  return [
    {
      role: 'system',
      content:
        'Bạn là từ điển Nhật-Việt chuyên nghiệp. Dịch nghĩa tiếng Anh của các từ tiếng Nhật sang tiếng Việt, ' +
        'ngắn gọn theo phong cách định nghĩa từ điển (không dịch nguyên văn câu). ' +
        'Chỉ trả về JSON hợp lệ theo đúng format yêu cầu, không thêm giải thích, không bọc trong markdown.',
    },
    {
      role: 'user',
      content:
        `Dịch nghĩa "en" sang tiếng Việt (trường "vi") cho từng sense của mỗi từ dưới đây. ` +
        `Giữ nguyên "id" và "i". Trả về JSON dạng: [{"id":0,"senses":[{"i":0,"vi":"..."}]}]\n\n` +
        JSON.stringify(input),
    },
  ];
}

function parseResponse(content) {
  let text = content.trim();
  // Bỏ markdown code fence nếu có
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(text);
}

async function main() {
  const limit = getLimitArg();

  let entries = readCheckpoint('entries-with-senses.json', []);
  if (limit) entries = entries.slice(0, limit);

  const batches = chunk(entries, BATCH_SIZE);
  let startBatch = readCheckpoint(CHECKPOINT_FILE, { lastBatch: -1 }).lastBatch + 1;
  if (startBatch > 0) console.log(`→ Tiếp tục từ batch ${startBatch}/${batches.length} (checkpoint).`);

  for (let i = startBatch; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const response = await chatCompletion(buildPrompt(batch), { temperature: 0.2, max_tokens: 2048 });
      const content = response.choices?.[0]?.message?.content || '';
      const parsed = parseResponse(content);

      const rows = [];
      for (const item of parsed) {
        const entry = batch[item.id];
        if (!entry) continue;
        for (const s of item.senses) {
          const original = entry.senses[s.i];
          if (!original || !s.vi) continue;
          rows.push({
            entry_id: entry.entry_id,
            pos: original.pos || null,
            meaning_vi: s.vi,
            order_index: s.i,
          });
        }
      }

      if (rows.length > 0) {
        const { error } = await dictDb.from('dict_senses').upsert(rows, { onConflict: 'entry_id,order_index' });
        if (error) throw error;
      }

      writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      console.log(`✓ Batch ${i + 1}/${batches.length} (${rows.length} sense) đã dịch & lưu.`);
    } catch (err) {
      console.error(`✗ Lỗi batch ${i}:`, err.message);
      appendFailedBatch(FAILED_FILE, { batch: i, error: err.message, entryIds: batch.map((b) => b.source_id) });
      writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
    }

    await sleep(300); // tránh rate-limit
  }

  console.log('\nHoàn tất translate-senses.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}
