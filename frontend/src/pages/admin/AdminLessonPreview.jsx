import AdminLayout from '../../components/layout/AdminLayout';
import LessonView from '../student/LessonView';

// Admin xem một mục/bài học như học sinh nhưng giữ nguyên khung/sidebar admin
// (mirror AdminCoursePreview). previewBase giữ mọi link khóa học/mục/quiz trong
// chuỗi route preview của admin.
function PreviewLayout({ title, children }) {
  return <AdminLayout title={title}>{children}</AdminLayout>;
}

export default function AdminLessonPreview() {
  return <LessonView Layout={PreviewLayout} previewBase="/admin" />;
}
