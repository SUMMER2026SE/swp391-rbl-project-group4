'use strict';

// ─── Sinh furigana (ruby HTML) offline bằng kuroshiro (không tốn token AI) ─────
// Dùng cho quiz đọc hiểu của tính năng Luyện đọc: gắn <ruby> cho câu hỏi + đáp án
// lúc admin lưu bài (và backfill 1 lần cho bài cũ khi student mở bài).
// kuroshiro + kuroshiro-analyzer-kuromoji đã có sẵn trong dependencies
// (từng dùng ở scripts/dictionary-import/generate-furigana.js).

const Kuroshiro = require('kuroshiro').default || require('kuroshiro');
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

const KANJI_REGEX = /[一-龯㐀-䶿]/;

let _kuroshiroPromise = null;

// Khởi tạo kuroshiro 1 lần (load dict kuromoji ~18MB, mất vài giây lần đầu)
function getKuroshiro() {
  if (!_kuroshiroPromise) {
    _kuroshiroPromise = (async () => {
      const kuroshiro = new Kuroshiro();
      await kuroshiro.init(new KuromojiAnalyzer());
      return kuroshiro;
    })();
    // Init lỗi thì cho phép lần gọi sau thử lại thay vì kẹt promise rejected
    _kuroshiroPromise.catch(() => { _kuroshiroPromise = null; });
  }
  return _kuroshiroPromise;
}

// Gắn ruby cho 1 chuỗi; chuỗi không có kanji giữ nguyên (không cần convert)
async function toRubyHtml(text) {
  const s = String(text || '');
  if (!KANJI_REGEX.test(s)) return s;
  const kuroshiro = await getKuroshiro();
  return kuroshiro.convert(s, { mode: 'furigana', to: 'hiragana' });
}

/**
 * Gắn furigana cho mảng câu hỏi quiz [{ question, options[4], ... }]:
 * thêm question_furigana (ruby HTML) + options_furigana (mảng ruby HTML),
 * giữ nguyên mọi field khác. Trả về mảng mới.
 */
async function annotateQuestions(questions) {
  return Promise.all((questions || []).map(async (q) => ({
    ...q,
    question_furigana: await toRubyHtml(q.question),
    options_furigana:  await Promise.all((q.options || []).map(toRubyHtml)),
  })));
}

module.exports = { annotateQuestions, toRubyHtml };
