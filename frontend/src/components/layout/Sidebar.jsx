import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';

export default function Sidebar({ links, brand = 'Kizuna Nihongo' }) {
  const { logout } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-outline/30 fixed left-0 top-0 z-40 px-6 pt-6 pb-4">
      <div className="mb-6 flex-shrink-0">
        <Link to="/" className="text-2xl font-bold text-tsubaki-red font-display tracking-tight block">
          {brand}
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0 -mx-2 px-2">
        {links.map((link) => {
          const active = location.pathname === link.to || location.pathname.startsWith(link.to + '/');
          return (
            <Link key={link.to} to={link.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-tsubaki-red/10 text-tsubaki-red border-l-4 border-tsubaki-red'
                  : 'text-on-muted hover:bg-surface-low hover:text-charcoal'
              }`}>
              <span className={`material-symbols-outlined text-xl ${active ? 'fill' : ''}`}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-outline/30 pt-4 flex-shrink-0 mt-2">
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface-low text-on-surface font-semibold text-sm hover:bg-outline/30 transition-colors">
          <span className="material-symbols-outlined text-xl">logout</span>
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  );
}
