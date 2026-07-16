import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';

export default function AvatarMenu() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.avatar_url;
  const fullName = user?.user_metadata?.full_name || user?.full_name;
  const initial = (fullName?.[0] || user?.email?.[0] || '?').toUpperCase();

  // Close on click-outside and Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close when the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full bg-tsubaki-red flex items-center justify-center text-white font-bold text-sm border-2 border-tsubaki-red/20 focus:outline-none">
        {avatarUrl
          ? <img src={avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
          : initial
        }
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-outline/30 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline/20">
            <p className="text-sm font-bold truncate">{fullName}</p>
            <p className="text-xs text-on-muted truncate">{user?.email}</p>
          </div>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-low transition-colors" onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined text-lg">person</span>
            {t('nav.profile')}
          </Link>
          <div className="border-t border-outline/20" />
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error hover:bg-error-bg/30 transition-colors">
            <span className="material-symbols-outlined text-lg">logout</span>
            {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
