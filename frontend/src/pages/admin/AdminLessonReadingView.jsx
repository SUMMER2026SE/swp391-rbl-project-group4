import { useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import ReadingReader from '../student/ReadingReader';

// Admin xem bài đọc của Mục như học viên nhưng giữ nguyên khung admin
// (mirror AdminReadingPreview): preview=true → quiz read-only, không chat AI.
export default function AdminLessonReadingView() {
  const { id } = useParams();
  return (
    <ReadingReader
      Layout={AdminLayout}
      apiBase="/admin/lessons/reading"
      listPath={`/admin/lessons/preview/${id}`}
      backLabel="Quay lại bài học"
      preview
    />
  );
}
