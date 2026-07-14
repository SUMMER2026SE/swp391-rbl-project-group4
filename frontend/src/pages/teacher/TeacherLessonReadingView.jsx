import { useParams } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import ReadingReader from '../student/ReadingReader';

// Teacher xem bài đọc của Mục như học viên nhưng giữ nguyên khung teacher
// (mirror AdminLessonReadingView): preview=true → quiz read-only, không chat AI.
export default function TeacherLessonReadingView() {
  const { id } = useParams();
  return (
    <ReadingReader
      Layout={TeacherLayout}
      apiBase="/teacher/lessons/reading"
      listPath={`/teacher/lessons/preview/${id}`}
      backLabel="Quay lại bài học"
      preview
    />
  );
}
