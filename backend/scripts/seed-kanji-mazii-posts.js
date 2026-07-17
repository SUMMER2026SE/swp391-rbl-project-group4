'use strict';
// Script chạy 1 lần: gom 2173 kanji vừa nhập từ Mazii (seed-kanji-mazii.js) thành
// các bài đăng danh sách (study_list_posts) của giáo viên "Bảo Teacher", chia
// nhỏ mỗi bài 50 kanji để dễ học — đúng luồng "giáo viên up bài đăng".
// Không đụng tới 56 kanji tự soạn cũ (đã có bài đăng riêng từ trước).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { supabaseAdmin } = require('../config/supabase');

const TEACHER_ID = '40a44b95-f5b8-4993-afa8-85bb9c3c322e'; // Bảo Teacher
const CHUNK_SIZE = 50;
const IMPORT_CUTOFF = '2026-07-16T09:50:00Z'; // mốc thời gian chạy seed-kanji-mazii.js
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run() {
  for (const level of LEVELS) {
    // Supabase mặc định trả tối đa 1000 dòng/truy vấn — phân trang thủ công để
    // không bị cắt mất kanji (N1 có 1242 dòng, đã từng bị thiếu 242 dòng cuối).
    const kanjiList = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from('kanji').select('id, character')
        .eq('level', level).gte('created_at', IMPORT_CUTOFF)
        .order('character', { ascending: true })
        .range(from, from + 999);
      if (error) { console.error(`${level}: lỗi lấy danh sách:`, error.message); break; }
      kanjiList.push(...data);
      if (data.length < 1000) break;
    }

    const chunks = chunk(kanjiList, CHUNK_SIZE);
    console.log(`\n=== ${level}: ${kanjiList.length} kanji mới → ${chunks.length} bài đăng ===`);

    for (let i = 0; i < chunks.length; i++) {
      const title = chunks.length > 1
        ? `Kanji ${level} (Mazii) - Phần ${i + 1}/${chunks.length}`
        : `Kanji ${level} (Mazii)`;

      const { data: existingPost } = await supabaseAdmin.from('study_list_posts')
        .select('id').eq('title', title).eq('created_by', TEACHER_ID).maybeSingle();

      let postId = existingPost?.id;
      if (!postId) {
        const { data: post, error } = await supabaseAdmin.from('study_list_posts')
          .insert({ list_type: 'kanji', title, level, creator_type: 'teacher', created_by: TEACHER_ID })
          .select('id').single();
        if (error) { console.error(`  ${title}: insert post lỗi:`, error.message); continue; }
        postId = post.id;
        console.log(`  Đã tạo "${title}".`);
      } else {
        console.log(`  "${title}" đã tồn tại, dùng lại.`);
      }

      const linkRows = chunks[i].map((k, idx) => ({ post_id: postId, item_id: k.id, sort_order: idx }));
      const { error: linkErr } = await supabaseAdmin.from('study_list_items')
        .upsert(linkRows, { onConflict: 'post_id,item_id' });
      if (linkErr) console.error(`  ${title}: link items lỗi:`, linkErr.message);
      else console.log(`  Đã liên kết ${linkRows.length} kanji.`);
    }
  }

  console.log('\nXong.');
}

run().catch((e) => { console.error(e); process.exit(1); });
