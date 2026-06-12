'use strict';

// ─── Sinh furigana (ruby HTML) offline cho câu ví dụ trong dict_examples ───
// Dùng kuroshiro + kuromoji (chạy local, không tốn token AI) để gắn <ruby> cho
// các chữ kanji trong sentence_jp, lưu vào cột dict_examples.furigana.
// Chỉ xử lý các dòng furigana IS NULL nên chạy lại an toàn (idempotent) và
// backfill được cả dữ liệu cũ lẫn dữ liệu import mới. Câu không có kanji -> bỏ qua.

const Kuroshiro = require('kuroshiro').default || require('kuroshiro');
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');
const { dictDb, getLimitArg, sleep } = require('./_shared');

const PAGE_SIZE = 200;
const KANJI_REGEX = /[一-龯㐀-䶿]/;

async function main() {
  const limit = getLimitArg();

  console.log('→ Khởi tạo kuroshiro (kuromoji)...');
  const kuroshiro = new Kuroshiro();
  await kuroshiro.init(new KuromojiAnalyzer());

  let processed = 0;
  let updated = 0;

  // Lặp lấy các dòng chưa có furigana. Vì sau khi update furigana != NULL nên
  // luôn dùng offset 0 (các dòng đã xử lý tự rớt khỏi điều kiện IS NULL).
  for (;;) {
    const pageSize = limit ? Math.min(PAGE_SIZE, limit - processed) : PAGE_SIZE;
    if (pageSize <= 0) break;

    const { data: rows, error } = await dictDb
      .from('dict_examples')
      .select('id, sense_id, sentence_jp')
      .is('furigana', null)
      .order('created_at', { ascending: true })
      .range(0, pageSize - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const updates = [];
    for (const row of rows) {
      processed++;
      // Câu không có kanji: gán furigana = sentence_jp để thoát điều kiện IS NULL
      // (frontend vẫn render text thuần, không ảnh hưởng hiển thị).
      if (!KANJI_REGEX.test(row.sentence_jp)) {
        updates.push({ id: row.id, sense_id: row.sense_id, sentence_jp: row.sentence_jp, furigana: row.sentence_jp });
        continue;
      }
      try {
        const html = await kuroshiro.convert(row.sentence_jp, { mode: 'furigana', to: 'hiragana' });
        updates.push({ id: row.id, sense_id: row.sense_id, sentence_jp: row.sentence_jp, furigana: html });
        updated++;
      } catch (err) {
        console.error(`✗ Lỗi câu ${row.id}:`, err.message);
        // Gán tạm text thuần để không kẹt vòng lặp ở dòng lỗi.
        updates.push({ id: row.id, sense_id: row.sense_id, sentence_jp: row.sentence_jp, furigana: row.sentence_jp });
      }
    }

    const { error: upErr } = await dictDb
      .from('dict_examples')
      .upsert(updates, { onConflict: 'id' });
    if (upErr) throw upErr;

    console.log(`✓ Đã xử lý ${processed} câu (gắn ruby: ${updated}).`);

    await sleep(100);
  }

  console.log(`\nHoàn tất generate-furigana: ${processed} câu, ${updated} câu có ruby.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}
