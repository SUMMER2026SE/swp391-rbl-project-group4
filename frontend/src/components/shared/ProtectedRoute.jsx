import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">
          progress_activity
        </span>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}
