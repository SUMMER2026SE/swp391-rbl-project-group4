'use strict';

// ─── Tách từ tiếng Nhật bằng kuromoji (offline, không tốn token AI) ────────────
// Dùng cho tính năng Luyện đọc: trích từ vựng ứng viên của bài lúc admin bấm
// "Sinh từ vựng & ngữ pháp" (chạy 1 lần lúc soạn bài, không chạy khi student đọc).
// kuromoji đã có sẵn trong node_modules (dependency của kuroshiro-analyzer-kuromoji,
// từng dùng ở scripts/dictionary-import/generate-furigana.js).

const path     = require('path');
const kuromoji = require('kuromoji');
const wanakana = require('wanakana');

// Từ loại giữ lại (content words) và các chi tiết loại bỏ (số, hậu tố, phụ thuộc...)
const CONTENT_POS    = new Set(['名詞', '動詞', '形容詞', '副詞']);
const EXCLUDE_DETAIL = new Set(['数', '非自立', '接尾', '代名詞', '固有名詞']);
// Động từ/danh từ quá phổ thông — không đáng đưa vào danh sách từ vựng của bài
const STOPWORDS      = new Set(['する', 'ある', 'いる', 'なる', 'できる', 'よう', 'こと', 'もの']);
const KANJI_REGEX    = /[一-龯々]/;

let _tokenizerPromise = null;

// Khởi tạo tokenizer 1 lần (load dict ~18MB từ node_modules, mất vài giây lần đầu)
function getTokenizer() {
  if (!_tokenizerPromise) {
    _tokenizerPromise = new Promise((resolve, reject) => {
      const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) return reject(err);
        resolve(tokenizer);
      });
    });
    // Init lỗi thì cho phép lần gọi sau thử lại thay vì kẹt promise rejected
    _tokenizerPromise.catch(() => { _tokenizerPromise = null; });
  }
  return _tokenizerPromise;
}

/**
 * Trích danh sách từ vựng ứng viên từ văn bản tiếng Nhật.
 * Trả về mảng theo thứ tự xuất hiện, đã khử trùng lặp theo dạng từ điển (basic_form):
 * [{ word, reading }] — reading là hiragana (xấp xỉ theo thể chia trong bài,
 * sẽ được thay bằng kana chuẩn nếu khớp từ điển ở bước sau).
 */
async function extractVocabCandidates(text, max = 40) {
  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(text);
  const seen = new Set();
  const out  = [];

  for (const tk of tokens) {
    if (!CONTENT_POS.has(tk.pos)) continue;
    if (EXCLUDE_DETAIL.has(tk.pos_detail_1)) continue;

    const base = tk.basic_form && tk.basic_form !== '*' ? tk.basic_form : tk.surface_form;
    if (STOPWORDS.has(base)) continue;
    // Bỏ từ quá ngắn không có kanji (trợ từ lọt lưới, kana đơn lẻ ít giá trị học)
    if (!KANJI_REGEX.test(base) && base.length < 2) continue;
    if (seen.has(base)) continue;

    seen.add(base);
    out.push({
      word:    base,
      reading: tk.reading ? wanakana.toHiragana(tk.reading) : '',
    });
    if (out.length >= max) break;
  }
  return out;
}

module.exports = { extractVocabCandidates };
