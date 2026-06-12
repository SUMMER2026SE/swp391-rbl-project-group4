import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Chỉ cho student vào — admin/teacher bị chuyển về dashboard riêng của họ
export default function StudentRoute({ children }) {
  const { user, loading, isAdmin, isTeacher } = useAuth();

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
  if (isAdmin())   return <Navigate to="/admin"   replace />;
  if (isTeacher()) return <Navigate to="/teacher" replace />;
  return children;
}
