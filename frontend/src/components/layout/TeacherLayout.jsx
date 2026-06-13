import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

const TEACHER_LINKS = [
  { to: '/teacher',               icon: 'dashboard',     label: 'Dashboard' },
  { to: '/teacher/vocab',         icon: 'translate',     label: 'Từ vựng' },
  { to: '/teacher/kanji',         icon: 'font_download', label: 'Kanji' },
  { to: '/teacher/dictionary',    icon: 'auto_stories',  label: 'Từ điển' },
  { to: '/teacher/quizzes',       icon: 'quiz',          label: 'Bài kiểm tra' },
  { to: '/teacher/question-bank', icon: 'inventory_2',   label: 'Ngân hàng câu hỏi' },
  { to: '/teacher/classes',       icon: 'groups',        label: 'Lớp học' },
  { to: '/chat',                  icon: 'smart_toy',     label: 'Trợ lý AI' },
  { to: '/profile',               icon: 'person',        label: 'Hồ sơ' },
];

export default function TeacherLayout({ children, title }) {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email || 'Giáo viên';

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={TEACHER_LINKS} brand="KN Teacher" />

      <div className="flex-1 md:ml-64 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-outline/30 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="bg-tsubaki-red text-white text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide">Giáo viên</span>
            <h1 className="text-sm font-bold text-charcoal">{title}</h1>
          </div>
          <span className="text-sm text-on-muted hidden md:block">{name}</span>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
