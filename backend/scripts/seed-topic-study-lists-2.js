'use strict';
// Script chạy 1 lần: tạo bài đăng danh sách cho các chủ đề còn thiếu, cho
// giáo viên "Bảo Teacher". Từ vựng tự biên soạn (kiến thức JLPT N5 phổ thông),
// KHÔNG tham chiếu/sao chép từ dekiru.vn — phần lớn nội dung của trang đó nằm
// sau paywall trả phí, không thể lấy được.
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

const langDb = supabaseAdmin.schema('language_module');

const TEACHER_ID = '40a44b95-f5b8-4993-afa8-85bb9c3c322e'; // Bảo Teacher

const TOPICS = [
  {
    title: 'Từ vựng về gia đình',
    topic: 'Gia đình',
    level: 'N5',
    words: [
      ['家族', 'かぞく', 'Gia đình'],
      ['父', 'ちち', 'Bố (của mình)'],
      ['母', 'はは', 'Mẹ (của mình)'],
      ['兄', 'あに', 'Anh trai'],
      ['姉', 'あね', 'Chị gái'],
      ['弟', 'おとうと', 'Em trai'],
      ['妹', 'いもうと', 'Em gái'],
      ['両親', 'りょうしん', 'Cha mẹ'],
      ['祖父', 'そふ', 'Ông'],
      ['祖母', 'そぼ', 'Bà'],
    ],
  },
  {
    title: 'Từ vựng đồ ăn & thức uống',
    topic: 'Đồ ăn & thức uống',
    level: 'N5',
    words: [
      ['米', 'こめ', 'Gạo'],
      ['パン', 'パン', 'Bánh mì'],
      ['肉', 'にく', 'Thịt'],
      ['魚', 'さかな', 'Cá'],
      ['野菜', 'やさい', 'Rau'],
      ['果物', 'くだもの', 'Trái cây'],
      ['卵', 'たまご', 'Trứng'],
      ['水', 'みず', 'Nước'],
      ['お茶', 'おちゃ', 'Trà'],
      ['牛乳', 'ぎゅうにゅう', 'Sữa'],
    ],
  },
  {
    title: 'Từ vựng thời gian & ngày tháng',
    topic: 'Thời gian & ngày tháng',
    level: 'N5',
    words: [
      ['今日', 'きょう', 'Hôm nay'],
      ['明日', 'あした', 'Ngày mai'],
      ['昨日', 'きのう', 'Hôm qua'],
      ['今週', 'こんしゅう', 'Tuần này'],
      ['来週', 'らいしゅう', 'Tuần sau'],
      ['先週', 'せんしゅう', 'Tuần trước'],
      ['今年', 'ことし', 'Năm nay'],
      ['毎日', 'まいにち', 'Mỗi ngày'],
      ['時間', 'じかん', 'Thời gian'],
      ['午前', 'ごぜん', 'Buổi sáng'],
    ],
  },
  {
    title: 'Từ vựng màu sắc',
    topic: 'Màu sắc',
    level: 'N5',
    words: [
      ['赤', 'あか', 'Màu đỏ'],
      ['青', 'あお', 'Màu xanh dương'],
      ['黄色', 'きいろ', 'Màu vàng'],
      ['白', 'しろ', 'Màu trắng'],
      ['黒', 'くろ', 'Màu đen'],
      ['緑', 'みどり', 'Màu xanh lá'],
      ['茶色', 'ちゃいろ', 'Màu nâu'],
      ['紫', 'むらさき', 'Màu tím'],
      ['ピンク', 'ピンク', 'Màu hồng'],
      ['オレンジ', 'オレンジ', 'Màu cam'],
    ],
  },
  {
    title: 'Từ vựng bộ phận cơ thể',
    topic: 'Cơ thể',
    level: 'N5',
    words: [
      ['頭', 'あたま', 'Đầu'],
      ['顔', 'かお', 'Mặt'],
      ['目', 'め', 'Mắt'],
      ['耳', 'みみ', 'Tai'],
      ['鼻', 'はな', 'Mũi'],
      ['口', 'くち', 'Miệng'],
      ['手', 'て', 'Tay'],
      ['足', 'あし', 'Chân'],
      ['お腹', 'おなか', 'Bụng'],
      ['髪', 'かみ', 'Tóc'],
    ],
  },
  {
    title: 'Từ vựng động vật',
    topic: 'Động vật',
    level: 'N5',
    words: [
      ['犬', 'いぬ', 'Chó'],
      ['猫', 'ねこ', 'Mèo'],
      ['鳥', 'とり', 'Chim'],
      ['牛', 'うし', 'Bò'],
      ['馬', 'うま', 'Ngựa'],
      ['象', 'ぞう', 'Voi'],
      ['ライオン', 'ライオン', 'Sư tử'],
      ['うさぎ', 'うさぎ', 'Thỏ'],
      ['豚', 'ぶた', 'Heo'],
      ['猿', 'さる', 'Khỉ'],
    ],
  },
  {
    title: 'Từ vựng trường học',
    topic: 'Trường học',
    level: 'N5',
    words: [
      ['学校', 'がっこう', 'Trường học'],
      ['先生', 'せんせい', 'Giáo viên'],
      ['学生', 'がくせい', 'Học sinh, sinh viên'],
      ['教室', 'きょうしつ', 'Phòng học'],
      ['本', 'ほん', 'Sách'],
      ['ノート', 'ノート', 'Vở'],
      ['鉛筆', 'えんぴつ', 'Bút chì'],
      ['試験', 'しけん', 'Kỳ thi'],
      ['宿題', 'しゅくだい', 'Bài tập về nhà'],
      ['授業', 'じゅぎょう', 'Tiết học'],
    ],
  },
  {
    title: 'Từ vựng thời tiết & thiên nhiên',
    topic: 'Thời tiết & thiên nhiên',
    level: 'N5',
    words: [
      ['天気', 'てんき', 'Thời tiết'],
      ['雨', 'あめ', 'Mưa'],
      ['雪', 'ゆき', 'Tuyết'],
      ['風', 'かぜ', 'Gió'],
      ['晴れ', 'はれ', 'Trời nắng'],
      ['曇り', 'くもり', 'Trời nhiều mây'],
      ['台風', 'たいふう', 'Bão'],
      ['山', 'やま', 'Núi'],
      ['川', 'かわ', 'Sông'],
      ['海', 'うみ', 'Biển'],
    ],
  },
  {
    title: 'Từ vựng hành động thường ngày',
    topic: 'Hành động',
    level: 'N5',
    words: [
      ['食べる', 'たべる', 'Ăn'],
      ['飲む', 'のむ', 'Uống'],
      ['行く', 'いく', 'Đi'],
      ['来る', 'くる', 'Đến'],
      ['見る', 'みる', 'Xem, nhìn'],
      ['聞く', 'きく', 'Nghe'],
      ['話す', 'はなす', 'Nói'],
      ['読む', 'よむ', 'Đọc'],
      ['書く', 'かく', 'Viết'],
      ['寝る', 'ねる', 'Ngủ'],
    ],
  },
  {
    title: 'Tính từ mô tả thường dùng',
    topic: 'Tính từ mô tả',
    level: 'N5',
    words: [
      ['大きい', 'おおきい', 'To, lớn'],
      ['小さい', 'ちいさい', 'Nhỏ'],
      ['高い', 'たかい', 'Cao, đắt'],
      ['安い', 'やすい', 'Rẻ'],
      ['新しい', 'あたらしい', 'Mới'],
      ['古い', 'ふるい', 'Cũ'],
      ['いい', 'いい', 'Tốt'],
      ['悪い', 'わるい', 'Xấu, tệ'],
      ['面白い', 'おもしろい', 'Thú vị'],
      ['難しい', 'むずかしい', 'Khó'],
    ],
  },
];

const hasKanji = (s) => /[一-龯]/.test(s);

async function run() {
  for (const t of TOPICS) {
    console.log(`\n=== ${t.title} (${t.level} / ${t.topic}) ===`);

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

    const linkRows = itemIds.map((item_id, i) => ({ post_id: postId, item_id, sort_order: i }));
    const { error: linkErr } = await langDb.from('study_list_items')
      .upsert(linkRows, { onConflict: 'post_id,item_id' });
    if (linkErr) console.error('  link items lỗi:', linkErr.message);
    else console.log(`  Đã liên kết ${linkRows.length} từ.`);
  }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
