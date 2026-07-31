'use strict';

// Nguồn học NGOÀI hệ thống — danh sách CỐ ĐỊNH do người soạn, không phải AI sinh ra.
//
// VÌ SAO WHITELIST: mô hình ngôn ngữ không truy cập được internet nên nếu để nó tự
// viết URL YouTube thì phần lớn link sẽ sai/chết (video bị xoá, id bịa). Ở đây AI chỉ
// được chọn `id` trong danh sách này — y hệt cách catalog học liệu nội bộ đang làm.
//
// NGUYÊN TẮC CHỌN LINK: ưu tiên **link kênh** và **link tìm kiếm** thay vì URL một
// video cụ thể, vì video đơn lẻ dễ bị gỡ còn kênh/kết quả tìm kiếm thì bền.
//
// ⚠️ BẢO TRÌ: danh sách này nên được admin rà lại định kỳ (mỗi học kỳ) xem link còn
// sống không. Thêm/bớt chỉ cần sửa mảng bên dưới, không cần đụng DB.

const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const EXTERNAL_RESOURCES = [
  // ── Nền tảng cho người mới (hệ thống chưa có nội dung dạng này) ──
  {
    id: 'ext-hiragana',
    title: 'Học bảng chữ cái Hiragana',
    url: yt('học bảng chữ cái hiragana cho người mới bắt đầu'),
    source: 'YouTube',
    skill: 'foundation',
    forBeginner: true,
    note: 'Nắm mặt chữ và cách viết Hiragana — bước đầu tiên bắt buộc.',
  },
  {
    id: 'ext-katakana',
    title: 'Học bảng chữ cái Katakana',
    url: yt('học bảng chữ cái katakana cho người mới bắt đầu'),
    source: 'YouTube',
    skill: 'foundation',
    forBeginner: true,
    note: 'Katakana dùng cho từ mượn — học ngay sau Hiragana.',
  },
  {
    id: 'ext-pronunciation',
    title: 'Phát âm tiếng Nhật cơ bản',
    url: yt('phát âm tiếng nhật cơ bản trường âm âm đục'),
    source: 'YouTube',
    skill: 'foundation',
    forBeginner: true,
    note: 'Trường âm, âm đục, âm ghép — phát âm sai từ đầu rất khó sửa về sau.',
  },
  {
    id: 'ext-jpammo',
    title: 'Japanese Ammo with Misa (kênh ngữ pháp)',
    url: 'https://www.youtube.com/@JapaneseAmmowithMisa',
    source: 'YouTube',
    skill: 'grammar',
    forBeginner: true,
    note: 'Giải thích ngữ pháp từ gốc, phù hợp người mới và N5–N4.',
  },

  // ── Bổ trợ theo kỹ năng khi hệ thống thiếu học liệu ──
  {
    id: 'ext-listening-n5n4',
    title: 'Luyện nghe tiếng Nhật N5–N4',
    url: yt('luyện nghe tiếng nhật n5 n4 có phụ đề'),
    source: 'YouTube',
    skill: 'listening',
    note: 'Nghe hội thoại chậm có phụ đề để làm quen tốc độ nói.',
  },
  {
    id: 'ext-listening-n3n2',
    title: 'Luyện nghe tiếng Nhật N3–N2',
    url: yt('luyện nghe jlpt n3 n2 choukai'),
    source: 'YouTube',
    skill: 'listening',
    note: 'Bài nghe tốc độ thật, sát đề thi JLPT.',
  },
  {
    id: 'ext-nihongonomori',
    title: 'Nihongo no Mori (luyện thi JLPT)',
    url: 'https://www.youtube.com/@nihongonomori2013',
    source: 'YouTube',
    skill: 'grammar',
    note: 'Kênh luyện thi JLPT nổi tiếng, mạnh về ngữ pháp N3 trở lên.',
  },
  {
    id: 'ext-kanji-writing',
    title: 'Hướng dẫn viết Kanji đúng thứ tự nét',
    url: yt('cách viết kanji thứ tự nét cơ bản'),
    source: 'YouTube',
    skill: 'kanji',
    note: 'Viết đúng thứ tự nét giúp nhớ chữ lâu hơn.',
  },
  {
    id: 'ext-jisho',
    title: 'Jisho.org — từ điển Nhật–Anh tra cứu nhanh',
    url: 'https://jisho.org',
    source: 'Web',
    skill: 'vocabulary',
    note: 'Tra kanji theo bộ thủ, ví dụ câu phong phú.',
  },
  {
    id: 'ext-writing-practice',
    title: 'Cách viết đoạn văn tiếng Nhật',
    url: yt('cách viết đoạn văn tiếng nhật sakubun cơ bản'),
    source: 'YouTube',
    skill: 'writing',
    note: 'Bố cục và mẫu câu thường dùng khi viết đoạn văn.',
  },
];

// Trang luyện tập CỐ ĐỊNH trong web (không có bản ghi trong DB nên không có uuid).
// Vẫn là nội dung nội bộ → luôn được ưu tiên hơn nguồn ngoài.
const INTERNAL_PRACTICE = [
  {
    id: 'prac-writing',
    title: 'Luyện viết có AI chấm',
    url: '/writing',
    skill: 'writing',
    note: 'Nộp đoạn văn, AI chấm ngữ pháp / từ vựng / mạch lạc và sửa bài.',
  },
  {
    id: 'prac-kanji-writing',
    title: 'Luyện viết Kanji theo nét',
    url: '/kanji/writing',
    skill: 'kanji',
    note: 'Tập viết kanji trên canvas, chấm thứ tự nét.',
  },
  {
    id: 'prac-dictionary',
    title: 'Từ điển Nhật–Việt của hệ thống',
    url: '/dictionary',
    skill: 'vocabulary',
    note: 'Tra từ, xem ví dụ có furigana.',
  },
];

const byId = new Map([
  ...EXTERNAL_RESOURCES.map(r => [r.id, { ...r, kind: 'external' }]),
  ...INTERNAL_PRACTICE.map(r => [r.id, { ...r, kind: 'practice', source: 'Kizuna Nihongo' }]),
]);

/**
 * Chọn nguồn bổ sung — CHỈ khi hệ thống thiếu, để luôn ưu tiên nội dung trong web.
 * @param {object} opts
 * @param {boolean} opts.isBeginner  học viên mới hoàn toàn (chưa biết bảng chữ cái)
 * @param {string[]} opts.focusSkills kỹ năng học viên chọn làm trọng tâm
 * @param {string[]} opts.gaps        kỹ năng được chọn nhưng catalog nội bộ không có mục nào
 */
function pickExternal({ isBeginner = false, focusSkills = [], gaps = [] } = {}) {
  const picked = [];

  // 1. Người mới: bắt buộc có bảng chữ cái + phát âm (hệ thống không dạy phần này)
  if (isBeginner) picked.push(...EXTERNAL_RESOURCES.filter(r => r.forBeginner && r.skill === 'foundation'));

  // 2. Trang luyện nội bộ khớp trọng tâm — ưu tiên trước nguồn ngoài
  const wants = (s) => !focusSkills.length || focusSkills.includes(s);
  picked.push(...INTERNAL_PRACTICE.filter(r => wants(r.skill)).map(r => ({ ...r, kind: 'practice', source: 'Kizuna Nihongo' })));

  // 3. Nguồn ngoài chỉ cho kỹ năng mà catalog nội bộ đang trống
  for (const skill of gaps) {
    picked.push(...EXTERNAL_RESOURCES.filter(r => r.skill === skill));
  }

  // Bỏ trùng, giới hạn để prompt không phình
  const seen = new Set();
  return picked
    .filter(r => (seen.has(r.id) ? false : seen.add(r.id)))
    .map(r => ({ ...r, kind: r.kind || 'external' }))
    .slice(0, 8);
}

/** Tra 1 mục theo id — dùng để lấy URL THẬT, không tin URL do AI sinh. */
const getResourceById = (id) => byId.get(id) || null;

module.exports = { EXTERNAL_RESOURCES, INTERNAL_PRACTICE, pickExternal, getResourceById };
