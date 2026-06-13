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
  try {
    return JSON.parse(text);
  } catch {
    // AI đôi khi trả thừa text sau mảng JSON → cắt lấy đúng mảng đầu tiên
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

// Dịch best-effort danh sách câu → map { sentence_jp: vi }. Nếu JSON cả batch hỏng
// (vd 1 câu khiến AI sinh dấu " chưa escape) thì dịch lẻ từng câu để cô lập câu lỗi.
async function translateSentences(items) {
  const translations = {};
  const toTranslate = items.filter((b) => b.sentenceEn);
  if (toTranslate.length === 0) return translations;

  try {
    const response = await chatCompletion(buildPrompt(toTranslate), { temperature: 0.2, max_tokens: 2048 });
    const parsed = parseResponse(response.choices?.[0]?.message?.content || '');
    for (const item of parsed) translations[toTranslate[item.id]?.sentence_jp] = item.vi;
    return translations;
  } catch (err) {
    console.warn(`  ↳ JSON batch hỏng (${err.message}) — dịch lẻ từng câu...`);
    for (const it of toTranslate) {
      try {
        const r = await chatCompletion(buildPrompt([it]), { temperature: 0.2, max_tokens: 512 });
        const p = parseResponse(r.choices?.[0]?.message?.content || '');
        if (p[0]?.vi) translations[it.sentence_jp] = p[0].vi;
      } catch { /* câu này bỏ trống nghĩa */ }
      await sleep(150);
    }
    return translations;
  }
}

async function main() {
  // --retry-failed: chỉ chạy lại các batch ghi trong FAILED_FILE (không đụng checkpoint chính).
  const retryFailed = process.argv.includes('--retry-failed');
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
      // Dịch best-effort (câu nào lỗi thì để trống nghĩa) — câu ví dụ vẫn luôn được lưu
      const translations = await translateSentences(batch);

      const rows = batch.map((b) => ({
        sense_id: b.sense_id,
        sentence_jp: b.sentence_jp,
        sentence_vi: translations[b.sentence_jp] || null,
      }));

      // Khử trùng (sense_id, sentence_jp) trong cùng batch — tránh lỗi
      // "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const seen = new Set();
      const dedupRows = rows.filter((r) => {
        const key = `${r.sense_id}:${r.sentence_jp}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const { error } = await dictDb.from('dict_examples').upsert(dedupRows, { onConflict: 'sense_id,sentence_jp' });
      if (error) throw error;

      const missing = dedupRows.filter((r) => !r.sentence_vi).length;
      if (!retryFailed) writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      console.log(`✓ Batch ${i + 1}/${batches.length} (${dedupRows.length} câu${missing ? `, ${missing} chưa có nghĩa` : ''}) đã lưu.`);
    } catch (err) {
      // Chỉ vào đây khi lỗi DB (upsert) — lỗi dịch đã được nuốt trong translateSentences
      console.error(`✗ Lỗi batch ${i}:`, err.message);
      if (retryFailed) {
        stillFailed.push({ batch: i, error: err.message });
      } else {
        appendFailedBatch(FAILED_FILE, { batch: i, error: err.message });
        writeCheckpoint(CHECKPOINT_FILE, { lastBatch: i });
      }
    }

    await sleep(300);
  }

  if (retryFailed) {
    writeCheckpoint(FAILED_FILE, stillFailed); // ghi đè danh sách lỗi còn lại ([] nếu xong sạch)
    console.log(`\nHoàn tất retry. Còn ${stillFailed.length} batch lỗi.`);
  } else {
    console.log('\nHoàn tất import-examples.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}
