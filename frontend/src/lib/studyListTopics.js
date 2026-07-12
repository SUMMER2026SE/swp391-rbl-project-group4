// Danh mục chủ đề cố định cho Bài đăng danh sách (Từ vựng/Kanji/Ngữ pháp) —
// dùng chung giữa trang duyệt (StudyListPreview) và form tạo/sửa bài đăng của
// giáo viên/admin, để icon luôn khớp với tên chủ đề.
export const TOPIC_ICONS = {
  'Chào hỏi': 'waving_hand',
  'Gia đình': 'family_restroom',
  'Đồ ăn & thức uống': 'restaurant',
  'Thời gian & ngày tháng': 'calendar_month',
  'Màu sắc': 'palette',
  'Cơ thể': 'accessibility',
  'Động vật': 'pets',
  'Trường học': 'school',
  'Địa điểm': 'location_on',
  'Thời tiết & thiên nhiên': 'partly_cloudy_day',
  'Giao thông': 'directions_car',
  'Hành động': 'directions_run',
  'Tính từ mô tả': 'star',
  'Xây dựng': 'construction',
};

export const TOPICS = Object.keys(TOPIC_ICONS);
