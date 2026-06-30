import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import TeacherLayout from '../components/layout/TeacherLayout';

// Cho phép các trình soạn bài học (video/reading/grammar/vocabulary/kanji) dùng chung
// giữa admin và giáo viên. Suy ra "khu vực" từ URL: /teacher/... → teacher, còn lại → admin.
// → apiBase quyết định gọi /teacher/* hay /admin/*; Layout quyết định sidebar hiển thị.
export function useEditorArea() {
  const isTeacher = useLocation().pathname.startsWith('/teacher');
  return {
    isTeacher,
    apiBase: isTeacher ? '/teacher' : '/admin',
    Layout: isTeacher ? TeacherLayout : AdminLayout,
  };
}
