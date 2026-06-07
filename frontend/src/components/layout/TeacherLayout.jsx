import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LINKS = [
  { to: '/teacher',         icon: 'dashboard',     label: 'Dashboard',      exact: true },
  { to: '/teacher/courses', icon: 'menu_book',     label: 'Khoá học của tôi' },
  { to: '/teacher/lessons', icon: 'article',       label: 'Bài học' },
  { to: '/teacher/vocab',   icon: 'translate',     label: 'Từ vựng' },
  { to: '/teacher/kanji',   icon: 'font_download', label: 'Kanji' },
  { to: '/teacher/quizzes',  icon: 'quiz',          label: 'Bài kiểm tra' },
  { to: '/teacher/classes',  icon: 'groups',        label: 'Lớp học' },
];

function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 fixed h-[calc(100vh-64px)] top-16 bg-surface-container-lowest border-r border-outline/20 p-4 overflow-y-auto">
      <div className="px-3 py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-tsubaki-red rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
          </div>
          <div>
            <p className="font-display text-sm font-bold">Kizuna Nihongo</p>
            <p className="text-[11px] text-on-muted uppercase tracking-wide font-semibold">Teacher Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {LINKS.map(link => (
          <NavLink key={link.to} to={link.to} end={link.exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold'
                  : 'text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/5'
              }`
            }>
            <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default function TeacherLayout({ children, title }) {
  const { user, logout } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email || 'Giáo viên';

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />

      <div className="flex-1 md:ml-64 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-outline/20 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="bg-tsubaki-red text-white text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide">Giáo viên</span>
            <h1 className="text-sm font-bold text-charcoal hidden md:block">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-on-muted hidden md:block">{name}</span>
            <button onClick={logout} className="text-xs text-on-muted hover:text-tsubaki-red transition-colors">
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
