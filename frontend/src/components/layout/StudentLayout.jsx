import { useState } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import AppHeader from './AppHeader';
import { useLang } from '../../contexts/LangContext';

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
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={STUDENT_LINKS(t)} collapsed={collapsed} onToggle={toggleSidebar} />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <AppHeader roleBadge={{ label: t('roles.student'), colorClass: 'bg-blue-600' }} title={title} showUpgrade />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav links={STUDENT_LINKS(t)} />
    </div>
  );
}
