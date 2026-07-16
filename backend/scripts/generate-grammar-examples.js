'use strict';

// One-off: sinh câu ví dụ tiếng Nhật bằng AI cho các grammar_points còn thiếu
// example_sentence (Mazii API không cung cấp được câu ví dụ khi cào dữ liệu).
// Chạy: node scripts/generate-grammar-examples.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');
const { chatCompletion } = require('../config/ai');

const BATCH_SIZE = 12;
const DELAY_MS = 500; // giữa các batch — tránh dồn dập gọi AI

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Output AI đôi khi lẫn markdown/HTML — cấm trong prompt, strip phòng hờ ở output.
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

function buildPrompt(batch) {
  const list = batch.map((g, i) =>
    `${i + 1}. id="${g.id}" | Mẫu: 「${g.title}」 | Cấp độ: ${g.level || '?'} | Nghĩa: ${g.meaning_vi || ''} | Cách dùng: ${stripHtml(g.explanation).slice(0, 200) || '(không có)'}`
  ).join('\n');

  return `Bạn là giáo viên tiếng Nhật soạn câu ví dụ minh họa ngữ pháp JLPT.

Dưới đây là danh sách mẫu ngữ pháp cần câu ví dụ:
${list}

Với MỖI mục, viết 1 câu ví dụ tiếng Nhật TỰ NHIÊN, dùng đúng mẫu ngữ pháp đó, độ khó từ vựng phù hợp với cấp độ JLPT ghi kèm (N5 dùng từ cơ bản nhất, N1 có thể dùng từ phức tạp hơn).
Câu ví dụ PHẢI chứa chữ Hán (kanji) thông thường, KHÔNG chỉ toàn hiragana/katakana.
TUYỆT ĐỐI không dùng markdown, không dùng thẻ HTML, không thêm bản dịch hay chú thích — chỉ câu tiếng Nhật thuần.

Trả về JSON THUẦN (không markdown, không giải thích thêm), đúng định dạng mảng:
[{"id": "<id giữ nguyên>", "example_sentence": "<câu ví dụ tiếng Nhật>"}, ...]`;
}

async function processBatch(client, batch) {
  const prompt = buildPrompt(batch);
  const r = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { model: process.env.FPT_AI_MODEL || 'gemma-4-31B-it', temperature: 0.5, max_tokens: 2200 }
  );
  const txt = r.choices?.[0]?.message?.content || '';
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('AI không trả về JSON array hợp lệ: ' + txt.slice(0, 200));
  const parsed = JSON.parse(m[0]);

  const validIds = new Set(batch.map((g) => g.id));
  let updated = 0;
  for (const row of parsed) {
    if (!row || !validIds.has(row.id)) continue;
    const sentence = stripHtml(row.example_sentence);
    if (!sentence) continue;
    await client.query('UPDATE public.grammar_points SET example_sentence = $1 WHERE id = $2', [sentence, row.id]);
    updated++;
  }
  return updated;
}

(async () => {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: targets } = await client.query(
    `SELECT id, title, level, meaning_vi, explanation FROM public.grammar_points
     WHERE example_sentence IS NULL OR btrim(example_sentence) = ''
     ORDER BY level, title`
  );
  console.log(`Cần sinh ví dụ cho ${targets.length} mục ngữ pháp.`);

  let totalUpdated = 0;
  let totalFailed = 0;
  const failedBatches = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    try {
      const updated = await processBatch(client, batch);
      totalUpdated += updated;
      console.log(`[${batchNo}/${totalBatches}] +${updated}/${batch.length} (tổng: ${totalUpdated})`);
    } catch (e) {
      totalFailed += batch.length;
      failedBatches.push({ batchNo, ids: batch.map((g) => g.id), error: e.message });
      console.error(`[${batchNo}/${totalBatches}] LỖI: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log('\n=== HOÀN TẤT ===');
  console.log(`Đã cập nhật: ${totalUpdated}`);
  console.log(`Thất bại: ${totalFailed}`);
  if (failedBatches.length) {
    console.log('Các batch lỗi (chạy lại script sẽ tự retry vì chỉ lấy mục còn thiếu):');
    failedBatches.forEach((b) => console.log(`  batch #${b.batchNo}: ${b.error}`));
  }

  await client.end();
})().catch((e) => { console.error('Fatal:', e); process.exit(1); });
