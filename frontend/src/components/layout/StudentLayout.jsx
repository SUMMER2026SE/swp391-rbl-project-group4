import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import { useSubscription } from '../../hooks/useSubscription';

const STUDENT_LINKS = (t) => [
  { to: '/dashboard',      icon: 'dashboard',       label: t('dashboard.title') },
  { to: '/courses',        icon: 'menu_book',        label: t('courses.title') },
  { to: '/vocabulary',     icon: 'translate',        label: t('vocab.title') },
  { to: '/grammar',        icon: 'spellcheck',       label: 'Ngữ pháp' },
  { to: '/kanji',          icon: 'font_download',    label: 'Kanji' },
  { to: '/listening',      icon: 'headphones',       label: 'Luyện nghe' },
  { to: '/placement-test', icon: 'assignment_ind',   label: 'Kiểm tra NL' },
  { to: '/learning-path',  icon: 'route',            label: 'Lộ trình học' },
  { to: '/writing',        icon: 'edit_note',        label: 'Luyện viết' },
  { to: '/dictionary',     icon: 'auto_stories',     label: t('dictionary.title') },
  { to: '/flashcards',     icon: 'style',            label: 'Thẻ ghi nhớ' },
  { to: '/reading',        icon: 'auto_stories',     label: 'Luyện đọc' },
  // Ẩn khỏi sidebar theo yêu cầu (giữ nguyên route/API/component để bật lại sau)
  // { to: '/classes',        icon: 'groups',           label: 'Lớp học' },
  // { to: '/exams',          icon: 'quiz',             label: 'Đề thi' },
  { to: '/mock-exams',     icon: 'fact_check',       label: 'Thi thử JLPT' },
  { to: '/chat',           icon: 'smart_toy',        label: 'Trợ lý AI' },
  { to: '/profile',        icon: 'person',           label: t('profile.title') },
];

export default function StudentLayout({ children, title }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');
  const { data: subData, loading: subLoading } = useSubscription();
  const isPremium = subData?.tier === 'premium';

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={STUDENT_LINKS(t)} collapsed={collapsed} onToggle={toggleSidebar} />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-outline/30 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tsubaki-red hidden md:block" />
            <span className="text-xs font-bold text-on-muted tracking-widest uppercase opacity-60 hidden md:block">{title}</span>
            <span className="md:hidden font-bold text-tsubaki-red font-display text-xl">Kizuna Nihongo</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Subscription chip */}
            {!subLoading && (
              isPremium ? (
                <button
                  onClick={() => navigate('/subscription')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold transition-colors shadow-sm shadow-amber-200">
                  <span className="material-symbols-outlined text-sm">workspace_premium</span>
                  Premium
                </button>
              ) : (
                <button
                  onClick={() => navigate('/subscription')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 text-xs font-bold transition-colors">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Nâng cấp
                </button>
              )
            )}

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
      <MobileNav links={STUDENT_LINKS(t)} />
    </div>
  );
}
