import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';

const STUDENT_LINKS = (t) => [
  { to: '/dashboard',  icon: 'dashboard',     label: t('dashboard.title') },
  { to: '/courses',    icon: 'menu_book',      label: t('courses.title') },
  { to: '/vocabulary', icon: 'translate',      label: t('vocab.title') },
  { to: '/kanji',      icon: 'font_download',  label: 'Kanji' },
  { to: '/dictionary', icon: 'auto_stories',   label: t('dictionary.title') },
  { to: '/flashcards', icon: 'style',          label: 'Thẻ ghi nhớ' },
  { to: '/news',       icon: 'newspaper',      label: 'Đọc báo' },
  { to: '/classes',    icon: 'groups',         label: 'Lớp học' },
  { to: '/chat',       icon: 'smart_toy',      label: 'Trợ lý AI' },
  { to: '/profile',    icon: 'person',         label: t('profile.title') },
];

export default function StudentLayout({ children, title }) {
  const { user, logout } = useAuth();
  const { t, lang, switchLang } = useLang();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={STUDENT_LINKS(t)} />

      <div className="flex-1 md:ml-64 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-outline/30 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tsubaki-red hidden md:block" />
            <span className="text-xs font-bold text-on-muted tracking-widest uppercase opacity-60 hidden md:block">{title}</span>
            <span className="md:hidden font-bold text-tsubaki-red font-display text-xl">Kizuna Nihongo</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Lang toggle */}
            <div className="flex gap-1">
              {['vi','ja'].map(l => (
                <button key={l} onClick={() => switchLang(l)}
                  className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${lang === l ? 'bg-tsubaki-red text-white' : 'text-on-muted hover:bg-surface-low'}`}>
                  {l === 'vi' ? 'VI' : 'JP'}
                </button>
              ))}
            </div>

            {/* Avatar dropdown */}
            <div className="relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-10 h-10 rounded-full bg-tsubaki-red flex items-center justify-center text-white font-bold text-sm border-2 border-tsubaki-red/20 focus:outline-none">
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                  : (user?.user_metadata?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()
                }
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-outline/30 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-outline/20">
                    <p className="text-sm font-bold truncate">{user?.user_metadata?.full_name}</p>
                    <p className="text-xs text-on-muted truncate">{user?.email}</p>
                  </div>
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-low transition-colors" onClick={() => setDropdownOpen(false)}>
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
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-outline/30 h-16 flex justify-around items-center z-50">
        {STUDENT_LINKS(t).map(link => (
          <Link key={link.to} to={link.to} className="flex flex-col items-center gap-0.5 text-on-muted hover:text-tsubaki-red transition-colors">
            <span className="material-symbols-outlined text-xl">{link.icon}</span>
            <span className="text-[10px] font-bold">{link.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
