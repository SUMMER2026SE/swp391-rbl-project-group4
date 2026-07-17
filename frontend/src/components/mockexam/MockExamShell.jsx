import StudentLayout from '../layout/StudentLayout';
import TeacherLayout from '../layout/TeacherLayout';
import { useAuth } from '../../contexts/AuthContext';

// Layout cho các trang thi thử JLPT: teacher vào cũng thi được → bọc TeacherLayout,
// còn lại giữ StudentLayout như cũ.
export default function MockExamShell({ children, title }) {
  const { isTeacher } = useAuth();
  const Layout = isTeacher() ? TeacherLayout : StudentLayout;
  return <Layout title={title}>{children}</Layout>;
}
