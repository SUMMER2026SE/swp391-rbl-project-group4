import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Alert from '../../components/ui/Alert';
import LessonView from '../student/LessonView';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

// Teacher xem một mục/bài học như học sinh nhưng giữ nguyên khung/sidebar teacher
// (mirror TeacherCoursePreview). Chỉ cho xem mục thuộc khóa học do chính mình tạo.
function PreviewLayout({ title, children }) {
  return <TeacherLayout title={title}>{children}</TeacherLayout>;
}

export default function TeacherLessonPreview() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState('loading'); // loading | ok | forbidden

  useEffect(() => {
    setState('loading');
    api.get(`/lessons/${id}`)
      .then(r => api.get(`/courses/${r.data.course_id}`))
      .then(r => setState(r.data?.created_by === user?.id ? 'ok' : 'forbidden'))
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
      <Alert type="error">Bạn chỉ có thể xem bài học thuộc khóa học do chính mình tạo.</Alert>
      <Link to="/teacher/courses" className="inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-tsubaki-red transition-colors mt-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Quay lại danh sách khóa học
      </Link>
    </TeacherLayout>
  );

  return <LessonView Layout={PreviewLayout} previewBase="/teacher" />;
}
