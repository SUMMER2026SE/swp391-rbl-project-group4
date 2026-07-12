'use strict';
// Script chạy 1 lần: gom 524 mẫu ngữ pháp N5/N4 vừa nhập từ Mazii thành bài
// đăng danh sách (study_list_posts) của giáo viên "Bảo Teacher" — đúng luồng
// "giáo viên up bài đăng", không phải kho admin quản lý riêng.
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

const TEACHER_ID = '40a44b95-f5b8-4993-afa8-85bb9c3c322e'; // Bảo Teacher

const POSTS = [
  { title: 'Ngữ pháp N5 (Mazii)', level: 'N5' },
  { title: 'Ngữ pháp N4 (Mazii)', level: 'N4' },
];

async function run() {
  for (const p of POSTS) {
    console.log(`\n=== ${p.title} ===`);

    const { data: points, error: qErr } = await supabaseAdmin
      .from('grammar_points').select('id').eq('level', p.level);
    if (qErr) { console.error('  lỗi lấy danh sách:', qErr.message); continue; }
    console.log(`  Tìm thấy ${points.length} mẫu ngữ pháp cấp ${p.level}.`);

    const { data: existingPost } = await supabaseAdmin.from('study_list_posts')
      .select('id').eq('title', p.title).eq('created_by', TEACHER_ID).maybeSingle();

    let postId = existingPost?.id;
    if (!postId) {
      const { data: post, error } = await supabaseAdmin.from('study_list_posts')
        .insert({ list_type: 'grammar', title: p.title, level: p.level, creator_type: 'teacher', created_by: TEACHER_ID })
        .select('id').single();
      if (error) { console.error('  insert post lỗi:', error.message); continue; }
      postId = post.id;
      console.log(`  Đã tạo bài đăng.`);
    } else {
      console.log(`  Bài đăng đã tồn tại, dùng lại.`);
    }

    const linkRows = points.map((pt, i) => ({ post_id: postId, item_id: pt.id, sort_order: i }));
    const { error: linkErr } = await supabaseAdmin.from('study_list_items')
      .upsert(linkRows, { onConflict: 'post_id,item_id' });
    if (linkErr) console.error('  link items lỗi:', linkErr.message);
    else console.log(`  Đã liên kết ${linkRows.length} mẫu ngữ pháp vào bài đăng.`);
  }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
