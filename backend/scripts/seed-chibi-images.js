'use strict';
// Script chạy 1 lần: gắn ảnh chibi dễ thương từ Irasutoya (www.irasutoya.com)
// cho 1 số từ vựng tiêu biểu. CHỈ dùng đúng 10 ảnh (dưới giới hạn 21 ảnh miễn
// phí/dự án của họ), không tải hàng loạt, không dùng để bán/phân phối lại.
require('dotenv').config({ path: '../.env' });
const { supabaseAdmin } = require('../config/supabase');

// kanji (hoặc reading nếu là từ thuần kana) → URL ảnh gốc trên irasutoya
const CHIBI = [
  ['犬', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgYlb7vToxsWcJX6d3aSgj1OmCi5hBjIzhvuy7fM6pIL2XzXjH0aYc5-2oA1ZKfnYy3xlLQ_UqK0H0z-Uq4W88GYlIm8K4BiJYhcg2BPpXpZOXhqHoNDRFpCB2rb9CmLCyJwkBdrsqhgR8/s1600/frame_animal_dog_tate.jpg'],
  ['猫', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiaZ4DulOvgZBOHhhdXiO4UEycZXkGLuw6M2przT5jMfAwoH2Y6kTNE18zSKsEOqy7nzCCWM7rPvJWYoJtpym6pCn7ixi4cDfLeANYRpLc1okp4ZSqfAl1NOrHjYcs4JRfme24SQK8ESHpc/s195/thumbnail_cat_moyou.jpg'],
  ['鳥', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEic9_sFh_0EEo1uSDBVLVCK3rtdy-Rsbdg2gPnX8jETzZG48LURH0WdaE8g2a0qBms2i4cofc4txXbPXbE_8r1atLcBzdraGMsQhMkROaCPZ9jPh9iv2THRZ7ZL-OLqGhGoclpG62aT4hU/s1/thumbnail_maruitori.jpg'],
  ['うさぎ', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiofywA44EM7IlWA5LLw0bI4ldFfMrDeINyP57YXK83IEgB2bQoYMAcXeQZDmQYQ6Nijh86OEG47BrecvTg0ai3paWfmJ0-RX1e7THI11fhhO2YX7FuRDr4LyvUa6RZWftJB4uNUrR7WXlj/s400/animalface_usagi.png'],
  ['豚', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhnYn31GVDz-F4UYaaE0HV_O68wphyphenhyphendD9MmEY3Kw35p8xw0zyhgDATzFgVh91F_bmGYVt96M00gNF6o2eU-XEKYBI7qNwobf-QnNWWfTKxbmIlEinloe7on0gVAkwphDsxFmjXC83iJ96g/s400/animal_kurobuta_pig.png'],
  ['おはよう', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhATiEsS_2vqdunv3SJD8gNfHTJyrY4UmruGcTzOKJFTpIGPz1t22jv3gQ_dzz1MSQP4YbvsY1R2HAPyUhRnZe69ZmnverTv6mjBigjW_S-9MJNTsYRNhux7SLd08DPJuVpXk3kq8JH9wk/s800/aisatsu1_ohayou.png'],
  ['ありがとう', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjOgF2CUDnU64UpkWSrOrBbts98i8_kr-E5XfTnz0znR4NgQ-UpOK4abjYU2BTdFv6dFY9xaI3TDxn3kv-NKBsyvcxi0qsskmOlFJRsp1GRS-sK9VY0fLDll8Zrw0SwVqFPUO90ns6ODcU/s800/aisatsu_arigatou.png'],
  ['食べる', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjGvIgSG_Z2dHgFj-A2zYEXDPY79c0pD_AiCwWc40RvYLHeTaHNNEtFU5AGJOMKh3DbBfG1mQNa3mb2dL_qwZQW5Un2TE49jKUbD1OrZfJijjqRFjnkLiQR6Co1EVcO9LD0uu_C214KqJB4/s195/thumbnail_syokuji_hashi.jpg'],
  ['話す', 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjeC8oExe4hQheFjpYkLOZa_NhofP60fH7KKQyP6U1o6PzNuYYwsMPpARAM98y22NoBRisWy_xi90h2ySybBxfNaHj9spj4_RbFNIWr65qwPyyfLYRlOGw082MdKtAXaFVzqh9I33ntmcDK/s1/banner_smartphone_talk.jpg'],
];

const WEATHER_URL = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCb4LdaHeH3DoVzRz-JpGDFuBMKkn3joxz4feZD96u-3jRQjtmc0gpOFJsqVwguul43uT3Ce6IvQbQbOSwj9PdUg1SM42tfa4waFtXLKbdkPONyJ-3HVCO_8fRI3QpRLe01CSFxnSseqc9/s1600/tenki_thumbnail.jpg';
const WEATHER_WORDS = ['雨', '雪', '晴れ'];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'img';

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
    const r = await supabaseAdmin.from('vocabulary')
      .update({ image_url: url }).is('kanji', null).eq('reading', kanji).select('id');
    if (r.error) { console.error(`  update lỗi (${kanji}):`, r.error.message); return 0; }
    data = r.data;
  }
  return data.length;
}

async function fetchAndUpload(term, srcUrl) {
  const UA = 'KizunaNihongo-EduProject/1.0 (student project; contact: nhuhau2609@gmail.com)';
  const res = await fetch(srcUrl, { headers: { 'User-Agent': UA, Referer: 'https://www.irasutoya.com/' } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (srcUrl.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
  const filename = `chibi-${slugify(term)}-${Date.now()}.${ext}`;
  return uploadBuffer(filename, buf, res.headers.get('content-type') || 'image/jpeg');
}

async function run() {
  console.log('=== Ảnh chibi (irasutoya.com, đúng 10 ảnh) ===');
  for (const [kanji, srcUrl] of CHIBI) {
    try {
      const url = await fetchAndUpload(kanji, srcUrl);
      const n = await setImageByKanji(kanji, url);
      console.log(`  ${kanji} → cập nhật ${n} từ`);
    } catch (e) { console.error(`  ${kanji} lỗi:`, e.message); }
  }

  console.log('\n=== Ảnh thời tiết (dùng chung 1 ảnh cho 3 từ) ===');
  try {
    const url = await fetchAndUpload('weather', WEATHER_URL);
    for (const w of WEATHER_WORDS) {
      const n = await setImageByKanji(w, url);
      console.log(`  ${w} → cập nhật ${n} từ`);
    }
  } catch (e) { console.error('  weather lỗi:', e.message); }

  console.log('\nXong.');
}

run().catch(e => { console.error(e); process.exit(1); });
