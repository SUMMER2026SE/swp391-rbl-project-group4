import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Alert from '../../components/ui/Alert';
import Quiz from '../student/Quiz';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

// Teacher làm thử quiz như học sinh nhưng giữ nguyên khung/sidebar teacher
// (mirror TeacherCoursePreview). Chỉ cho xem quiz thuộc khóa học do chính mình tạo.
function PreviewLayout({ title, children }) {
  return <TeacherLayout title={title}>{children}</TeacherLayout>;
}

export default function TeacherQuizPreview() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState('loading'); // loading | ok | forbidden

  useEffect(() => {
    setState('loading');
    api.get(`/quizzes/${id}`)
      .then(async (r) => {
        // Quiz gắn course_id trực tiếp, hoặc gián tiếp qua lesson_id.
        let courseId = r.data?.course_id;
        if (!courseId && r.data?.lesson_id) {
          const l = await api.get(`/lessons/${r.data.lesson_id}`);
          courseId = l.data?.course_id;
        }
        if (!courseId) return setState('forbidden');
        const c = await api.get(`/courses/${courseId}`);
        setState(c.data?.created_by === user?.id ? 'ok' : 'forbidden');
      })
      .catch(() => setState('forbidden'));
  }, [id, user?.id]);

  if (state === 'loading') return (
    <TeacherLayout title="...">
      <div className="flex justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
      </div>
    </TeacherLayout>
  );

  if (state === 'forbidden') return (
    <TeacherLayout title="Không có quyền">
      <Alert type="error">Bạn chỉ có thể xem bài kiểm tra thuộc khóa học do chính mình tạo.</Alert>
      <Link to="/teacher/courses" className="inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-tsubaki-red transition-colors mt-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Quay lại danh sách khóa học
      </Link>
    </TeacherLayout>
  );

  return <Quiz Layout={PreviewLayout} />;
}
