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
  try {
    return JSON.parse(text);
  } catch {
    // AI đôi khi trả thừa text sau mảng JSON → cắt lấy đúng mảng đầu tiên
    // (đếm ngoặc cân bằng, bỏ qua ngoặc nằm trong chuỗi)
    return JSON.parse(extractFirstJsonArray(text));
  }
}

// Trích mảng JSON đầu tiên (cân bằng [ ]), bỏ qua ngoặc trong chuỗi và ký tự escape
function extractFirstJsonArray(text) {
  const start = text.indexOf('[');
  if (start === -1) throw new Error('Không tìm thấy mảng JSON trong phản hồi');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Mảng JSON không cân bằng ngoặc');
}

async function main() {
  // --retry-failed: chỉ chạy lại các batch ghi trong FAILED_FILE (không đụng checkpoint chính).
  // Dùng để chạy bù các batch lỗi sau khi import full (AI trả JSON hỏng / trùng khóa upsert).
  const retryFailed = process.argv.includes('--retry-failed');
  const limit = getLimitArg();

  let entries = readCheckpoint('entries-with-senses.json', []);
  if (limit) entries = entries.slice(0, limit);

  const batches = chunk(entries, BATCH_SIZE);

  // Xác định danh sách index batch cần xử lý
  let targets;
  if (retryFailed) {
    targets = readCheckpoint(FAILED_FILE, []).map((f) => f.batch);
    if (targets.length === 0) { console.log('→ Không có batch lỗi nào để chạy lại.'); return; }
    console.log(`→ Chạy lại ${targets.length} batch lỗi: ${targets.join(', ')}`);
  } else {
    const startBatch = readCheckpoint(CHECKPOINT_FILE, { lastBatch: -1 }).lastBatch + 1;
    if (startBatch > 0) console.log(`→ Tiếp tục từ batch ${startBatch}/${batches.length} (checkpoint).`);
    targets = [];
    for (let i = startBatch; i < batches.length; i++) targets.push(i);
  }

  const stillFailed = []; // chỉ dùng ở chế độ retry

  for (const i of targets) {
    const batch = batches[i];
    if (!batch) continue;

    try {
      const response = await chatCompletion(buildPrompt(batch), { temperature: 0.2, max_tokens: 2048 });
      const content = response.choices?.[0]?.message?.content || '';
      const parsed = parseResponse(content);

      const rows = [];
      for (const item of parsed) {
        const entry = batch[item.id];
        if (!entry || !Array.isArray(item.senses)) continue; // bỏ qua phần tử AI trả thiếu/sai "senses"
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

      // Khử trùng (entry_id, order_index) trong cùng batch — tránh lỗi
      // "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const seen = new Set();
      const dedupRows = rows.filter((r) => {
        const key = `${r.entry_id}:${r.order_index}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (dedupRows.length > 0) {
        const { error } = await dictDb.from('dict_senses').upsert(dedupRows, { onConflict: 'entry_id,order_index' });
        if (error) throw error;
      }

      if (!retryFailed) writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      console.log(`✓ Batch ${i + 1}/${batches.length} (${dedupRows.length} sense) đã dịch & lưu.`);
    } catch (err) {
      console.error(`✗ Lỗi batch ${i}:`, err.message);
      if (retryFailed) {
        stillFailed.push({ batch: i, error: err.message, entryIds: batch.map((b) => b.source_id) });
      } else {
        appendFailedBatch(FAILED_FILE, { batch: i, error: err.message, entryIds: batch.map((b) => b.source_id) });
        writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      }
    }

    await sleep(300); // tránh rate-limit
  }

  if (retryFailed) {
    writeCheckpoint(FAILED_FILE, stillFailed); // ghi đè danh sách lỗi còn lại ([] nếu xong sạch)
    console.log(`\nHoàn tất retry. Còn ${stillFailed.length} batch lỗi.`);
  } else {
    console.log('\nHoàn tất translate-senses.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}
