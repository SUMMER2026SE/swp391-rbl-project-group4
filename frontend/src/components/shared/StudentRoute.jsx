import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Chỉ cho student vào — admin/teacher bị chuyển về dashboard riêng của họ.
// allowAdmin: các route học (bài học/quiz) cho admin vào xem như học sinh thật.
// allowTeacher: các route (thi thử JLPT) cho teacher vào như học sinh.
// adminRedirectTo / teacherRedirectTo: thay vì cho vào, chuyển admin/teacher sang route
// preview tương ứng (":param" trong chuỗi được thay bằng param của URL hiện tại,
// vd "/admin/courses/preview/:id"). Không truyền thì giữ hành vi chặn cũ.
export default function StudentRoute({ children, allowAdmin = false, allowTeacher = false, adminRedirectTo, teacherRedirectTo }) {
  const { user, loading, isAdmin, isTeacher } = useAuth();
  const params = useParams();
  const resolve = (tpl) => tpl.replace(/:(\w+)/g, (_, key) => params[key] ?? '');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">
          progress_activity
        </span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin()) {
    if (adminRedirectTo) return <Navigate to={resolve(adminRedirectTo)} replace />;
    return allowAdmin ? children : <Navigate to="/admin" replace />;
  }
  if (isTeacher()) {
    if (teacherRedirectTo) return <Navigate to={resolve(teacherRedirectTo)} replace />;
    return allowTeacher ? children : <Navigate to="/teacher" replace />;
  }
  return children;
}
