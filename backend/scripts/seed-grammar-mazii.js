'use strict';
// Script chạy 1 lần: nhập ngữ pháp N5 + N4 vào kho ngữ pháp chung (grammar_points)
// từ API công khai của mazii.net (không cần đăng nhập, không trả phí — khác
// dekiru.vn). Lấy mẫu ngữ pháp + nghĩa + giải thích; KHÔNG lấy được câu ví dụ
// (API ví dụ của họ không lộ qua network request tìm được).
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

const langDb = supabaseAdmin.schema('language_module');

const LEVELS = [
  { code: 5, name: 'N5', total: 193 },
  { code: 4, name: 'N4', total: 436 },
];
const PAGE_SIZE = 100;
const UA = 'KizunaNihongo-EduProject/1.0 (student project; contact: nhuhau2609@gmail.com)';

async function fetchLevel(code, total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const all = [];
  for (let p = 1; p <= pages; p++) {
    const res = await fetch(`https://mazii.net/api/jlptgrammar/${code}/${PAGE_SIZE}/${p}/vi`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    const json = await res.json();
    all.push(...(json.results || []));
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

function parseEntry(entry) {
  const v = entry.value;
  const [ja, vi] = (v.title || '').split('=>').map(s => s.trim());
  const pattern = v.usages?.[0]?.synopsis || '';
  const explanation = (v.usages || [])
    .map(u => u.explain)
    .filter(Boolean)
    .join('\n\n');
  return {
    title: ja || v.title,
    title_ja: pattern || null,
    meaning_vi: vi || v.title,
    explanation: explanation || null,
    example_sentence: null,
    level: v.level,
  };
}

async function run() {
  for (const lvl of LEVELS) {
    console.log(`\n=== ${lvl.name} ===`);
    const entries = await fetchLevel(lvl.code, lvl.total);
    console.log(`  Lấy được ${entries.length} mẫu ngữ pháp từ Mazii.`);

    let inserted = 0, skipped = 0;
    for (const entry of entries) {
      const row = parseEntry(entry);
      if (!row.title || !row.meaning_vi) { skipped++; continue; }

      const { data: existing } = await langDb.from('grammar_points')
        .select('id').eq('title', row.title).eq('level', row.level).maybeSingle();
      if (existing) { skipped++; continue; }

      const { error } = await langDb.from('grammar_points').insert(row);
      if (error) { console.error(`  lỗi (${row.title}):`, error.message); continue; }
      inserted++;
    }
    console.log(`  Đã thêm ${inserted} mẫu mới, bỏ qua ${skipped} (trùng hoặc thiếu dữ liệu).`);
  }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
