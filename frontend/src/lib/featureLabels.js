// Tên hiển thị của các hạn mức tính năng (feature_code trong billing_module).
//
// Gom về MỘT chỗ vì trước đây mỗi màn hình tự giữ một bảng riêng → thêm tính năng mới
// là quên cập nhật, màn "Mức sử dụng" hiện thẳng mã kỹ thuật kiểu
// "listening_create_monthly" cho người dùng thấy.
//
// Khi thêm feature_code mới ở backend, nhớ khai báo nhãn tại đây.

export const FEATURE_LABELS = {
  // Luyện nghe
  listening_practice_monthly:     'Luyện nghe',
  listening_create_monthly:       'Tạo bài nghe',
  // Kanji
  kanji_file_monthly:             'Luyện viết kanji',
  kanji_chars_per_file:           'Ký tự tối đa / file kanji',
  // Flashcard
  flashcard_ai_suggest_daily:     'AI gợi ý định nghĩa thẻ',
  flashcard_test_gen_daily:       'Tạo bài kiểm tra flashcard',
  // AI khác
  ai_chat_daily:                  'Tin nhắn với trợ lý AI',
  learning_path_generate_monthly: 'Tạo lộ trình học',
  // Luyện đọc
  reading_daily:                  'Bài luyện đọc mới',
  // Gói
  premium_monthly:                'Gói Premium',
};

/**
 * Nhãn hiển thị của một feature_code.
 * Nếu chưa khai báo, tự làm đẹp mã thay vì để lộ chuỗi kỹ thuật:
 *   "some_new_feature_daily" → "Some new feature"
 */
export function featureLabel(code) {
  if (!code) return '';
  if (FEATURE_LABELS[code]) return FEATURE_LABELS[code];
  const words = String(code).replace(/_(daily|monthly|weekly|per_file)$/i, '').split('_').filter(Boolean);
  if (!words.length) return code;
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const PERIOD_LABELS = { monthly: '/ tháng', daily: '/ ngày', weekly: '/ tuần', none: '' };
