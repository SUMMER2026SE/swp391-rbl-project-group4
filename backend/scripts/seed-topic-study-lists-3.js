'use strict';
// Script chạy 1 lần: bổ sung từ vựng N4-N2 vào các bài đăng chủ đề đã có (đang
// chỉ có N5), để 1 chủ đề thực sự có nhiều cấp độ — phần lọc cấp độ trong
// trang chi tiết bài đăng mới có tác dụng. Từ vựng tự biên soạn, không tham
// chiếu dekiru.vn.
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

const TEACHER_ID = '40a44b95-f5b8-4993-afa8-85bb9c3c322e'; // Bảo Teacher

// title (bài đăng đã có, khớp với script 1 & 2) → thêm từ theo cấp độ
const ADDITIONS = [
  {
    title: 'Chào hỏi khi gặp nhau',
    words: [
      ['お世話になります', 'おせわになります', 'Cảm ơn sự giúp đỡ của bạn', 'N4'],
      ['いってきます', 'いってきます', 'Con đi đây (khi ra khỏi nhà)', 'N4'],
      ['ただいま', 'ただいま', 'Tôi về rồi', 'N4'],
      ['よろしくお願いします', 'よろしくおねがいします', 'Mong được giúp đỡ, chỉ bảo', 'N3'],
      ['お疲れ様でした', 'おつかれさまでした', 'Bạn đã vất vả rồi', 'N3'],
      ['ご無沙汰しております', 'ごぶさたしております', 'Đã lâu không liên lạc', 'N2'],
      ['恐れ入ります', 'おそれいります', 'Xin lỗi đã làm phiền (khiêm nhường)', 'N2'],
    ],
  },
  {
    title: 'Từ vựng về gia đình',
    words: [
      ['主人', 'しゅじん', 'Chồng (của mình)', 'N4'],
      ['家内', 'かない', 'Vợ (của mình)', 'N4'],
      ['親戚', 'しんせき', 'Họ hàng', 'N4'],
      ['夫婦', 'ふうふ', 'Vợ chồng', 'N3'],
      ['一人っ子', 'ひとりっこ', 'Con một', 'N3'],
      ['血縁', 'けつえん', 'Huyết thống', 'N2'],
      ['養子', 'ようし', 'Con nuôi', 'N2'],
    ],
  },
  {
    title: 'Từ vựng đồ ăn & thức uống',
    words: [
      ['味', 'あじ', 'Vị', 'N4'],
      ['栄養', 'えいよう', 'Dinh dưỡng', 'N4'],
      ['調味料', 'ちょうみりょう', 'Gia vị', 'N4'],
      ['食欲', 'しょくよく', 'Sự thèm ăn', 'N3'],
      ['偏食', 'へんしょく', 'Kén ăn', 'N3'],
      ['摂取', 'せっしゅ', 'Hấp thụ (dinh dưỡng)', 'N2'],
      ['食生活', 'しょくせいかつ', 'Đời sống ăn uống', 'N2'],
    ],
  },
  {
    title: 'Từ vựng thời gian & ngày tháng',
    words: [
      ['期間', 'きかん', 'Khoảng thời gian', 'N4'],
      ['最近', 'さいきん', 'Gần đây', 'N4'],
      ['以前', 'いぜん', 'Trước đây', 'N4'],
      ['当分', 'とうぶん', 'Tạm thời, trong thời gian tới', 'N3'],
      ['しばらく', 'しばらく', 'Một lúc, một thời gian', 'N3'],
      ['瞬間', 'しゅんかん', 'Khoảnh khắc', 'N2'],
      ['永久', 'えいきゅう', 'Vĩnh viễn', 'N2'],
    ],
  },
  {
    title: 'Từ vựng màu sắc',
    words: [
      ['金色', 'きんいろ', 'Màu vàng kim', 'N4'],
      ['銀色', 'ぎんいろ', 'Màu bạc', 'N4'],
      ['灰色', 'はいいろ', 'Màu xám', 'N4'],
      ['透明', 'とうめい', 'Trong suốt', 'N3'],
      ['鮮やか', 'あざやか', 'Rực rỡ, tươi sáng', 'N3'],
      ['色彩', 'しきさい', 'Sắc màu', 'N2'],
      ['濃淡', 'のうたん', 'Đậm nhạt', 'N2'],
    ],
  },
  {
    title: 'Từ vựng bộ phận cơ thể',
    words: [
      ['骨', 'ほね', 'Xương', 'N4'],
      ['筋肉', 'きんにく', 'Cơ bắp', 'N4'],
      ['皮膚', 'ひふ', 'Da', 'N4'],
      ['内臓', 'ないぞう', 'Nội tạng', 'N3'],
      ['神経', 'しんけい', 'Thần kinh', 'N3'],
      ['免疫', 'めんえき', 'Miễn dịch', 'N2'],
      ['細胞', 'さいぼう', 'Tế bào', 'N2'],
    ],
  },
  {
    title: 'Từ vựng động vật',
    words: [
      ['昆虫', 'こんちゅう', 'Côn trùng', 'N4'],
      ['爬虫類', 'はちゅうるい', 'Bò sát', 'N4'],
      ['哺乳類', 'ほにゅうるい', 'Động vật có vú', 'N4'],
      ['野生動物', 'やせいどうぶつ', 'Động vật hoang dã', 'N3'],
      ['天敵', 'てんてき', 'Thiên địch', 'N3'],
      ['生態系', 'せいたいけい', 'Hệ sinh thái', 'N2'],
      ['繁殖', 'はんしょく', 'Sinh sản', 'N2'],
    ],
  },
  {
    title: 'Từ vựng trường học',
    words: [
      ['卒業', 'そつぎょう', 'Tốt nghiệp', 'N4'],
      ['入学', 'にゅうがく', 'Nhập học', 'N4'],
      ['奨学金', 'しょうがくきん', 'Học bổng', 'N4'],
      ['履修', 'りしゅう', 'Việc học (tín chỉ)', 'N3'],
      ['単位', 'たんい', 'Tín chỉ (học phần)', 'N3'],
      ['教育制度', 'きょういくせいど', 'Hệ thống giáo dục', 'N2'],
      ['学術', 'がくじゅつ', 'Học thuật', 'N2'],
    ],
  },
  {
    title: 'Từ vựng thời tiết & thiên nhiên',
    words: [
      ['気温', 'きおん', 'Nhiệt độ', 'N4'],
      ['湿度', 'しつど', 'Độ ẩm', 'N4'],
      ['虹', 'にじ', 'Cầu vồng', 'N4'],
      ['気候', 'きこう', 'Khí hậu', 'N3'],
      ['自然災害', 'しぜんさいがい', 'Thiên tai', 'N3'],
      ['温暖化', 'おんだんか', 'Sự nóng lên toàn cầu', 'N2'],
      ['環境', 'かんきょう', 'Môi trường', 'N2'],
    ],
  },
  {
    title: 'Từ vựng hành động thường ngày',
    words: [
      ['決める', 'きめる', 'Quyết định', 'N4'],
      ['続ける', 'つづける', 'Tiếp tục', 'N4'],
      ['始める', 'はじめる', 'Bắt đầu', 'N4'],
      ['済ませる', 'すませる', 'Hoàn thành, xong xuôi', 'N3'],
      ['諦める', 'あきらめる', 'Từ bỏ', 'N3'],
      ['携わる', 'たずさわる', 'Tham gia vào (công việc)', 'N2'],
      ['及ぼす', 'およぼす', 'Gây ảnh hưởng', 'N2'],
    ],
  },
  {
    title: 'Tính từ mô tả thường dùng',
    words: [
      ['便利', 'べんり', 'Tiện lợi', 'N4'],
      ['危険', 'きけん', 'Nguy hiểm', 'N4'],
      ['安全', 'あんぜん', 'An toàn', 'N4'],
      ['単純', 'たんじゅん', 'Đơn giản', 'N3'],
      ['複雑', 'ふくざつ', 'Phức tạp', 'N3'],
      ['曖昧', 'あいまい', 'Mơ hồ', 'N2'],
      ['著しい', 'いちじるしい', 'Đáng kể, rõ rệt', 'N2'],
    ],
  },
  {
    title: 'Phương tiện giao thông',
    words: [
      ['渋滞', 'じゅうたい', 'Tắc đường', 'N4'],
      ['運転', 'うんてん', 'Lái xe', 'N4'],
      ['信号', 'しんごう', 'Đèn tín hiệu', 'N4'],
      ['交通機関', 'こうつうきかん', 'Phương tiện giao thông công cộng', 'N3'],
      ['運賃', 'うんちん', 'Cước phí đi lại', 'N3'],
      ['迂回', 'うかい', 'Đường vòng', 'N2'],
      ['往来', 'おうらい', 'Qua lại, giao thông', 'N2'],
    ],
  },
  {
    title: 'Từ vựng chuyên ngành xây dựng',
    words: [
      ['工事', 'こうじ', 'Công trình, thi công', 'N4'],
      ['建物', 'たてもの', 'Tòa nhà', 'N4'],
      ['建設', 'けんせつ', 'Xây dựng', 'N3'],
      ['設計', 'せっけい', 'Thiết kế', 'N3'],
    ],
  },
];

const hasKanji = (s) => /[一-龯]/.test(s);

async function run() {
  for (const t of ADDITIONS) {
    console.log(`\n=== ${t.title} ===`);

    const { data: post } = await supabaseAdmin.from('study_list_posts')
      .select('id, topic').eq('title', t.title).eq('created_by', TEACHER_ID).maybeSingle();
    if (!post) { console.error('  Không tìm thấy bài đăng, bỏ qua.'); continue; }

    const { count: currentCount } = await supabaseAdmin
      .from('study_list_items').select('id', { count: 'exact', head: true }).eq('post_id', post.id);

    const itemIds = [];
    for (const [word, kana, meaning, level] of t.words) {
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
        .insert({ kanji, reading, meaning_vi: meaning, level, topic: post.topic, created_by: TEACHER_ID, is_public: true })
        .select('id').single();
      if (error) { console.error('  insert vocab lỗi:', word, error.message); continue; }
      itemIds.push(inserted.id);
      console.log(`  + từ mới (${level}): ${word} (${reading}) — ${meaning}`);
    }

    const linkRows = itemIds.map((item_id, i) => ({ post_id: post.id, item_id, sort_order: (currentCount || 0) + i }));
    const { error: linkErr } = await supabaseAdmin.from('study_list_items')
      .upsert(linkRows, { onConflict: 'post_id,item_id' });
    if (linkErr) console.error('  link items lỗi:', linkErr.message);
    else console.log(`  Đã liên kết thêm ${linkRows.length} từ.`);
  }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
