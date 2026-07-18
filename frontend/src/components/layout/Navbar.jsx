import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-outline/20' : 'bg-transparent'}`}>
      <div className={`max-w-7xl mx-auto flex justify-between items-center px-6 transition-all duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>
        <Link to="/" className="font-display text-2xl font-bold text-tsubaki-red tracking-tight">
          Kizuna Nihongo
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex gap-8 items-center">
          <a href="#path" className="text-sm font-semibold text-tsubaki-red border-b-2 border-tsubaki-red pb-0.5">{t('nav.features')}</a>
          <a href="#footer" className="text-sm text-on-muted hover:text-tsubaki-red transition-colors">{t('nav.about')}</a>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {isAdmin() && (
                  <Link to="/admin" className="text-sm text-sumire-purple font-semibold hover:underline">Admin</Link>
                )}
                <Link to="/dashboard" className="text-sm text-on-muted hover:text-tsubaki-red transition-colors">
                  {t('nav.hello')}, <strong className="text-tsubaki-red">{user.user_metadata?.full_name || user.email}</strong>
                </Link>
                <button onClick={handleLogout}
                  className="bg-tsubaki-red text-white px-5 py-2 rounded-full text-sm font-semibold shadow-sm hover:opacity-90 transition-all">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="text-sm text-on-muted hover:text-tsubaki-red transition-colors">{t('nav.register')}</Link>
                <Link to="/login" className="bg-tsubaki-red text-white px-5 py-2 rounded-full text-sm font-semibold shadow-sm hover:opacity-90 transition-all">{t('nav.login')}</Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-tsubaki-red" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-outline/30 px-6 py-4 flex flex-col gap-4">
          <a href="#path" className="text-sm font-semibold text-tsubaki-red" onClick={() => setMenuOpen(false)}>{t('nav.features')}</a>
          <a href="#footer" className="text-sm text-on-muted" onClick={() => setMenuOpen(false)}>{t('nav.about')}</a>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-on-muted" onClick={() => setMenuOpen(false)}>{t('nav.dashboard')}</Link>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="bg-tsubaki-red text-white py-2 rounded-full text-sm font-semibold text-center">
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className="text-sm text-on-muted" onClick={() => setMenuOpen(false)}>{t('nav.register')}</Link>
              <Link to="/login" className="bg-tsubaki-red text-white py-2 rounded-full text-sm font-semibold text-center" onClick={() => setMenuOpen(false)}>{t('nav.login')}</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
