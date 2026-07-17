'use strict';

// One-off: nhập Kanji đầy đủ N5-N1 từ API công khai của Mazii
// (https://mazii.net/vi-VN/learning-hub/library/jlpt/kanji/{level}).
// Endpoint POST /api/jlptkanji không cần đăng nhập, CORS mở (access-control-allow-origin: *),
// không có paywall — xác nhận qua network inspection, khác hẳn dekiru.vn.
// Dedup theo character: bỏ qua kanji đã có sẵn (giữ nguyên dữ liệu tự soạn cũ, không ghi đè).
// Chạy: node scripts/seed-kanji-mazii.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');

const PAGE_SIZE = 100; // server cap thực tế, dù gửi limit lớn hơn vẫn chỉ trả tối đa 100/trang
const LEVELS = [5, 4, 3, 2, 1]; // query=5 → N5 ... query=1 → N1
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(level, page) {
  const r = await fetch('https://mazii.net/api/jlptkanji', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: level, limit: PAGE_SIZE, page, language: 'vi', keyword: '' }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Nghĩa tiếng Việt ngắn: ưu tiên ví dụ mà từ ghép trùng đúng 1 kanji (bare reading),
// nếu không có thì lấy câu đầu của "detail" (bỏ số thứ tự + phần "VD:" phía sau).
function extractMeaningVi(row) {
  const bare = (row.examples || []).find((e) => e.w === row.kanji && e.m);
  if (bare) return bare.m;
  if (row.detail) {
    const firstLine = row.detail.split('\n')[0].replace(/^\d+\.\s*/, '').trim();
    if (firstLine) return firstLine;
  }
  return row.mean || null;
}

(async () => {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: existingRows } = await client.query('SELECT character FROM public.kanji');
  const existing = new Set(existingRows.map((r) => r.character));
  console.log(`Đã có sẵn ${existing.size} kanji trong DB — sẽ bỏ qua trùng.`);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkippedDup = 0;
  const toInsert = [];

  for (const level of LEVELS) {
    let page = 1;
    let total = Infinity;
    while ((page - 1) * PAGE_SIZE < total) {
      const data = await fetchPage(level, page);
      if (data.status !== 200) throw new Error(`API lỗi ở N${level} trang ${page}: ${JSON.stringify(data)}`);
      total = data.total ?? data.results.length;

      for (const row of data.results) {
        totalFetched++;
        if (!row.kanji) continue;
        if (existing.has(row.kanji)) { totalSkippedDup++; continue; }
        existing.add(row.kanji); // tự dedup trong chính đợt cào (1 kanji có thể xuất hiện lại)

        toInsert.push({
          character: row.kanji,
          reading_on: row.on ? row.on.split(/\s+/).filter(Boolean) : [],
          reading_kun: row.kun ? row.kun.split(/\s+/).filter(Boolean) : [],
          han_viet: row.mean || null,
          meaning_vi: extractMeaningVi(row),
          stroke_count: row.stroke_count ? Number(row.stroke_count) : null,
          level: `N${level}`,
        });
      }

      console.log(`N${level} trang ${page}: +${data.results.length} (tổng đã lấy N${level}: ${Math.min(page * PAGE_SIZE, total)}/${total})`);
      page++;
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nĐã lấy tổng cộng ${totalFetched} dòng từ Mazii, bỏ trùng ${totalSkippedDup}, sẽ thêm mới ${toInsert.length}.`);

  const BATCH = 200;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const values = [];
    const placeholders = batch.map((k, idx) => {
      const base = idx * 7;
      values.push(k.character, k.reading_on, k.reading_kun, k.han_viet, k.meaning_vi, k.stroke_count, k.level);
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},true)`;
    }).join(',');
    await client.query(
      `INSERT INTO public.kanji (character, reading_on, reading_kun, han_viet, meaning_vi, stroke_count, level, is_public) VALUES ${placeholders}`,
      values
    );
    totalInserted += batch.length;
    console.log(`Đã ghi ${totalInserted}/${toInsert.length}`);
  }

  console.log('\n=== HOÀN TẤT ===');
  console.log(`Kanji mới thêm: ${totalInserted}`);

  await client.end();
})().catch((e) => { console.error('Fatal:', e); process.exit(1); });
