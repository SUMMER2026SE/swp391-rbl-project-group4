'use strict';
// Script chạy 1 lần: tạo bài đăng danh sách mẫu theo chủ đề cho giáo viên "Bảo Teacher".
// Dữ liệu từ vựng (từ + đọc + nghĩa) tham khảo cấu trúc chủ đề của dekiru.vn — chỉ lấy
// cặp từ+nghĩa (dữ kiện từ điển), không sao chép ảnh/câu ví dụ/âm thanh của họ.
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

const langDb = supabaseAdmin.schema('language_module');

const TEACHER_ID = '40a44b95-f5b8-4993-afa8-85bb9c3c322e'; // Bảo Teacher

const TOPICS = [
  {
    title: 'Chào hỏi khi gặp nhau',
    topic: 'Chào hỏi',
    level: 'N5',
    words: [
      ['おはよう', 'おはよう', 'Chào buổi sáng'],
      ['こんにちは', 'こんにちは', 'Chào buổi trưa'],
      ['こんばんは', 'こんばんは', 'Chào buổi tối'],
      ['お休み', 'おやすみ', 'Chúc ngủ ngon'],
      ['初めまして', 'はじめまして', 'Rất vui khi được gặp bạn'],
      ['すみません', 'すみません', 'Tôi xin lỗi'],
      ['さよなら', 'さよなら', 'Tạm biệt'],
      ['ありがとう', 'ありがとう', 'Cám ơn'],
      ['どういたしまして', 'どういたしまして', 'Không có gì'],
      ['久しぶり', 'ひさしぶり', 'Lâu rồi không gặp bạn'],
    ],
  },
  {
    title: 'Phương tiện giao thông',
    topic: 'Giao thông',
    level: 'N5',
    words: [
      ['車', 'くるま', 'Ô tô'],
      ['自転車', 'じてんしゃ', 'Xe đạp'],
      ['バイク', 'バイク', 'Xe mô tô'],
      ['バス', 'バス', 'Xe buýt'],
      ['電車', 'でんしゃ', 'Tàu điện'],
      ['タクシー', 'タクシー', 'Xe taxi'],
      ['飛行機', 'ひこうき', 'Máy bay'],
      ['船', 'ふね', 'Thuyền'],
      ['パトカー', 'パトカー', 'Xe cảnh sát'],
      ['救急車', 'きゅうきゅうしゃ', 'Xe cấp cứu'],
    ],
  },
  {
    title: 'Từ vựng chuyên ngành xây dựng',
    topic: 'Xây dựng',
    level: 'N2',
    words: [
      ['立上りコンクリート打設', 'たちあがりコンクリートだせつ', 'Đổ bê tông'],
      ['鉄筋組', 'てっきんぐみ', 'Buộc sắt'],
      ['型枠撤去', 'かたわくてっきょ', 'Tháo dỡ cốp pha'],
      ['コンクリート釘', 'コンクリートくぎ', 'Đinh đóng bê tông'],
      ['鉄筋', 'てっきん', 'Thanh thép'],
      ['トンボ', 'トンボ', 'Là sàn'],
      ['バイブレーター', 'ばいぶれえたあ', 'Máy rung'],
      ['土間コンクリート打設', 'どまコンクリートだせつ', 'Rải bê tông'],
      ['スケール', 'スケール', 'Thước đo chiều dài'],
      ['結束線', 'けっそくせん', 'Dây bó thép'],
      ['墨ツボ', 'すみツボ', 'Bút đánh dấu'],
      ['ブラケット', 'ブラケット', 'Khung chống chữ A'],
      ['足場', 'あしば', 'Giàn thao tác'],
      ['逆タップ', 'ぎゃくたっぷ', 'Mũi khoan taro'],
      ['炭素鋼', 'たんそこう', 'Thép carbon'],
      ['ブルドーザー', 'ブルドーザー', 'Xe ủi đất'],
      ['モルタル', 'モルタル', 'Vữa'],
      ['ロードローラー', 'ロードローラー', 'Xe lu'],
      ['バール', 'バール', 'Xà beng'],
      ['ドライウォール', 'ドライウォール', 'Ván thạch cao'],
    ],
  },
];

const hasKanji = (s) => /[一-龯]/.test(s);

async function run() {
  for (const t of TOPICS) {
    console.log(`\n=== ${t.title} (${t.level} / ${t.topic}) ===`);

    // 1) Đảm bảo từ vựng có trong kho chung, dedup theo kanji+reading
    const itemIds = [];
    for (const [word, kana, meaning] of t.words) {
      const kanji = hasKanji(word) ? word : null;
      const reading = kana;

      let query = supabaseAdmin.from('vocabulary').select('id').eq('reading', reading);
      query = kanji ? query.eq('kanji', kanji) : query.is('kanji', null);
      const { data: existing } = await query.maybeSingle();

      if (existing) {
        itemIds.push(existing.id);
        continue;
      }
      const { data: inserted, error } = await supabaseAdmin.from('vocabulary')
        .insert({ kanji, reading, meaning_vi: meaning, level: t.level, topic: t.topic, created_by: TEACHER_ID, is_public: true })
        .select('id').single();
      if (error) { console.error('  insert vocab lỗi:', word, error.message); continue; }
      itemIds.push(inserted.id);
      console.log(`  + từ mới: ${word} (${reading}) — ${meaning}`);
    }

    // 2) Tạo bài đăng (bỏ qua nếu đã có bài cùng tiêu đề của giáo viên này)
    const { data: existingPost } = await langDb.from('study_list_posts')
      .select('id').eq('title', t.title).eq('created_by', TEACHER_ID).maybeSingle();

    let postId = existingPost?.id;
    if (!postId) {
      const { data: post, error } = await langDb.from('study_list_posts')
        .insert({ list_type: 'vocabulary', title: t.title, level: t.level, topic: t.topic, creator_type: 'teacher', created_by: TEACHER_ID })
        .select('id').single();
      if (error) { console.error('  insert post lỗi:', error.message); continue; }
      postId = post.id;
      console.log(`  Đã tạo bài đăng: ${t.title}`);
    } else {
      console.log(`  Bài đăng đã tồn tại, dùng lại: ${t.title}`);
    }

    // 3) Liên kết từ vào bài đăng
    const linkRows = itemIds.map((item_id, i) => ({ post_id: postId, item_id, sort_order: i }));
    const { error: linkErr } = await langDb.from('study_list_items')
      .upsert(linkRows, { onConflict: 'post_id,item_id' });
    if (linkErr) console.error('  link items lỗi:', linkErr.message);
    else console.log(`  Đã liên kết ${linkRows.length} từ.`);
  }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
