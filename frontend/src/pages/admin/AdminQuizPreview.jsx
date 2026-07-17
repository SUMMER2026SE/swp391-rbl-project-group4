import AdminLayout from '../../components/layout/AdminLayout';
import Quiz from '../student/Quiz';

// Admin làm thử quiz như học sinh nhưng giữ nguyên khung/sidebar admin
// (mirror AdminCoursePreview). Quiz quay lại bằng navigate(-1) nên tự về
// đúng trang preview bài học trước đó.
function PreviewLayout({ title, children }) {
  return <AdminLayout title={title}>{children}</AdminLayout>;
}

export default function AdminQuizPreview() {
  return <Quiz Layout={PreviewLayout} />;
}
