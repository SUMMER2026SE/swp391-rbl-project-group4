import AdminLayout from '../../components/layout/AdminLayout';
import CourseDetail from '../student/CourseDetail';

// Admin "Xem khóa học": tái dùng trang CourseDetail của student nhưng giữ nguyên
// khung/sidebar admin (mirror AdminReadingPreview). Quay lại qua nút "← Danh mục
// khóa học" của CourseDetail (backTo).
function PreviewLayout({ title, children }) {
  return <AdminLayout title={title}>{children}</AdminLayout>;
}

export default function AdminCoursePreview() {
  return <CourseDetail Layout={PreviewLayout} backTo="/admin/courses" previewBase="/admin" />;
}
