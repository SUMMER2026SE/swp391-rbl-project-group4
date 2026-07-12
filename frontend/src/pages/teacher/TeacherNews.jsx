import { NewsManager } from '../admin/AdminNews';
import TeacherLayout from '../../components/layout/TeacherLayout';

export default function TeacherNews() {
  return (
    <NewsManager
      Layout={TeacherLayout}
      base="/teacher/my-reading"
      uploadPath="/teacher/reading-passages/upload"
      title="Luyện đọc của tôi"
    />
  );
}
