// Helper thuần (không JSX) dùng chung cho 2 chế độ Học (Learn) và Kiểm tra (Test).

// ── Trộn ngẫu nhiên (Fisher–Yates, trả về mảng mới) ──
export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── Chuẩn hóa để chấm câu tự luận ──
// Đủ cho cả tiếng Việt (bỏ hoa/thường, khoảng trắng thừa) lẫn tiếng Nhật (không có hoa/thường).
export const normalize = (s) => (s || '').trim().toLowerCase();

// ── Lấy tối đa n đáp án nhiễu (distractor) từ các thẻ KHÁC trong set ──
// side = 'term' | 'definition' — mặt dùng làm đáp án. Lọc trùng với đáp án đúng theo normalize.
export const pickDistractors = (allCards, correctCard, side, n = 3) => {
  const correct = normalize(correctCard[side]);
  const seen = new Set([correct]);
  const pool = [];
  for (const c of shuffle(allCards)) {
    if (c.id === correctCard.id) continue;
    const key = normalize(c[side]);
    if (seen.has(key)) continue; // tránh distractor trùng đáp án đúng / trùng nhau
    seen.add(key);
    pool.push(c[side]);
    if (pool.length >= n) break;
  }
  return pool;
};

// ── Tạo danh sách lựa chọn trắc nghiệm (đáp án đúng + distractor), đã trộn ──
export const buildMcOptions = (allCards, correctCard, side, n = 3) => {
  const options = [correctCard[side], ...pickDistractors(allCards, correctCard, side, n)];
  return shuffle(options);
};
