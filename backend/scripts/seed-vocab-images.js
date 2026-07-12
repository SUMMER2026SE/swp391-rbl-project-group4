'use strict';
// Script chạy 1 lần: gắn ảnh minh họa cho các từ vựng cụ thể, dễ minh họa
// (động vật, bộ phận cơ thể, đồ ăn, thời tiết/thiên nhiên) bằng ảnh đại diện
// từ Wikipedia (đều có giấy phép tự do rõ ràng — CC BY-SA / public domain),
// và ô màu tự tạo cho chủ đề Màu sắc (không cần tìm ảnh, chính xác tuyệt đối).
// Các từ trừu tượng (hành động, tính từ, khái niệm N3/N2...) giữ nguyên icon.
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

const WIKI_WORDS = [
  // Động vật
  ['犬', 'Dog'], ['猫', 'Cat'], ['鳥', 'Bird'], ['牛', 'Cattle'], ['馬', 'Horse'],
  ['象', 'Elephant'], ['ライオン', 'Lion'], ['うさぎ', 'Rabbit'], ['豚', 'Pig'], ['猿', 'Macaque'],
  ['昆虫', 'Insect'], ['爬虫類', 'Reptile'], ['哺乳類', 'Mammal'], ['野生動物', 'Wildlife'],
  // Cơ thể
  ['頭', 'Human head'], ['顔', 'Face'], ['目', 'Human eye'], ['耳', 'Ear'], ['鼻', 'Nose'],
  ['口', 'Mouth'], ['手', 'Hand'], ['足', 'Human leg'], ['お腹', 'Abdomen'], ['髪', 'Human hair'],
  ['骨', 'Bone'], ['筋肉', 'Muscle'], ['皮膚', 'Skin'],
  // Đồ ăn & thức uống
  ['米', 'Rice'], ['パン', 'Bread'], ['肉', 'Meat'], ['魚', 'Fish'], ['野菜', 'Vegetable'],
  ['果物', 'Fruit'], ['卵', 'Egg (food)'], ['水', 'Water'], ['お茶', 'Tea'], ['牛乳', 'Milk'],
  ['調味料', 'Seasoning'],
  // Thời tiết & thiên nhiên
  ['雨', 'Rain'], ['雪', 'Snow'], ['台風', 'Tropical cyclone'], ['山', 'Mountain'],
  ['川', 'River'], ['海', 'Sea'], ['虹', 'Rainbow'],
];

const COLORS = [
  ['赤', '#DC2626'], ['青', '#2563EB'], ['黄色', '#FBBF24'], ['白', '#F9FAFB'],
  ['黒', '#111827'], ['緑', '#16A34A'], ['茶色', '#92400E'], ['紫', '#7C3AED'],
  ['ピンク', '#EC4899'], ['オレンジ', '#EA580C'], ['金色', '#D4AF37'], ['銀色', '#C0C0C0'],
  ['灰色', '#6B7280'],
];

async function uploadBuffer(filename, buffer, contentType) {
  const { error } = await supabaseAdmin.storage.from('passage-images')
    .upload(filename, buffer, { contentType, upsert: true });
  if (error) throw error;
  return supabaseAdmin.storage.from('passage-images').getPublicUrl(filename).data.publicUrl;
}

async function setImageByKanji(kanji, url) {
  let { data, error } = await supabaseAdmin.from('vocabulary')
    .update({ image_url: url }).eq('kanji', kanji).select('id');
  if (error) { console.error(`  update lỗi (${kanji}):`, error.message); return 0; }
  if (data.length === 0) {
    // Từ thuần katakana (không có kanji riêng) được lưu với kanji=null, reading=chính từ đó.
    const r = await supabaseAdmin.from('vocabulary')
      .update({ image_url: url }).is('kanji', null).eq('reading', kanji).select('id');
    if (r.error) { console.error(`  update lỗi (${kanji}):`, r.error.message); return 0; }
    data = r.data;
  }
  return data.length;
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function colorSvg(hex) {
  const stroke = hex === '#F9FAFB' ? '#D1D5DB' : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${hex}" stroke="${stroke}" stroke-width="4"/></svg>`;
}

async function run() {
  console.log('=== Màu sắc (ô màu tự tạo, data URI — không cần upload) ===');
  for (const [kanji, hex] of COLORS) {
    const url = `data:image/svg+xml;base64,${Buffer.from(colorSvg(hex)).toString('base64')}`;
    const n = await setImageByKanji(kanji, url);
    console.log(`  ${kanji} (${hex}) → cập nhật ${n} từ`);
  }

  const UA = 'KizunaNihongo-EduProject/1.0 (student project; contact: nhuhau2609@gmail.com)';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  console.log('\n=== Từ cụ thể (ảnh từ Wikipedia) ===');
  for (const [kanji, term] of WIKI_WORDS) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) { console.log(`  ${kanji} (${term}) → API không trả JSON (${res.status}), bỏ qua`); await sleep(400); continue; }
      const info = await res.json();
      const imgUrl = info.thumbnail?.source || info.originalimage?.source;
      if (!imgUrl) { console.log(`  ${kanji} (${term}) → không có ảnh, bỏ qua`); await sleep(400); continue; }

      const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } });
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const ext = (imgUrl.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
      const filename = `vocab-${slugify(term)}-${Date.now()}.${ext}`;
      const url = await uploadBuffer(filename, buf, imgRes.headers.get('content-type') || 'image/jpeg');
      const n = await setImageByKanji(kanji, url);
      console.log(`  ${kanji} (${term}) → cập nhật ${n} từ`);
    } catch (e) {
      console.error(`  ${kanji} (${term}) lỗi:`, e.message);
    }
    await sleep(400);
  }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
