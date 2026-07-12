// Helper thuần (không JSX) cho chế độ Kiểm tra (Test).

// ── Chuẩn hóa để chấm câu tự luận ──
// Đủ cho cả tiếng Việt (bỏ hoa/thường, khoảng trắng thừa) lẫn tiếng Nhật (không có hoa/thường).
export const normalize = (s) => (s || '').trim().toLowerCase();
