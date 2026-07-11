import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';

export default function Sidebar({ links, brand = 'Kizuna Nihongo', collapsed = false, onToggle }) {
  const { logout } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside className={`hidden md:flex flex-col h-screen bg-white border-r border-outline/30 fixed left-0 top-0 z-40 pt-6 pb-4 transition-all duration-200 ${
      collapsed ? 'w-20 px-3' : 'w-64 px-6'
    }`}>
      <div className={`mb-6 flex-shrink-0 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {collapsed ? (
          <Link to="/" title={brand}
            className="w-10 h-10 rounded-xl bg-tsubaki-red/10 text-tsubaki-red font-display font-bold text-xl flex items-center justify-center">
            {brand[0]}
          </Link>
        ) : (
          <Link to="/" className="text-2xl font-bold text-tsubaki-red font-display tracking-tight block">
            {brand}
          </Link>
        )}
        {onToggle && !collapsed && (
          <button onClick={onToggle} title="Thu gọn thanh điều hướng"
            className="text-on-muted hover:text-tsubaki-red transition-colors">
            <span className="material-symbols-outlined">menu_open</span>
          </button>
        )}
      </div>

      {onToggle && collapsed && (
        <button onClick={onToggle} title="Mở rộng thanh điều hướng"
          className="mb-2 mx-auto text-on-muted hover:text-tsubaki-red transition-colors">
          <span className="material-symbols-outlined">menu</span>
        </button>
      )}

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0 -mx-2 px-2">
        {links.map((link) => {
          const active = location.pathname === link.to || location.pathname.startsWith(link.to + '/');
          return (
            <Link key={link.to} to={link.to} title={collapsed ? link.label : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'
              } ${
                active
                  ? `bg-tsubaki-red/10 text-tsubaki-red ${collapsed ? '' : 'border-l-4 border-tsubaki-red'}`
                  : 'text-on-muted hover:bg-surface-low hover:text-charcoal'
              }`}>
              <span className={`material-symbols-outlined text-xl ${active ? 'fill' : ''}`}>{link.icon}</span>
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-outline/30 pt-4 flex-shrink-0 mt-2">
        <button onClick={handleLogout} title={collapsed ? t('nav.logout') : undefined}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-low text-on-surface font-semibold text-sm hover:bg-outline/30 transition-colors ${
            collapsed ? 'px-2' : 'px-4'
          }`}>
          <span className="material-symbols-outlined text-xl">logout</span>
          {!collapsed && t('nav.logout')}
        </button>
      </div>
    </aside>
  );
}
