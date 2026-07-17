import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import AppHeader from './AppHeader';
import { useLang } from '../../contexts/LangContext';

const TEACHER_LINKS = [
  { to: '/teacher',               icon: 'dashboard',     label: 'Dashboard', exact: true },
  { to: '/teacher/courses',       icon: 'menu_book',     label: 'Khóa học' },
  // Ẩn khỏi sidebar theo yêu cầu (giữ nguyên route/API/component để bật lại sau)
  // { to: '/teacher/vocab',         icon: 'translate',     label: 'Từ vựng' },
  // { to: '/teacher/kanji',         icon: 'font_download', label: 'Kanji' },
  // { to: '/teacher/grammar',       icon: 'spellcheck',    label: 'Ngữ pháp' },
  { to: '/teacher/study-lists',   icon: 'library_books', label: 'Bài đăng danh sách' },
  { to: '/teacher/listening',     icon: 'headphones',    label: 'Luyện nghe' },
  // Luyện đọc của giáo viên: ẩn khỏi sidebar theo yêu cầu (giữ route/API/component để bật lại sau)
  // { to: '/teacher/reading',       icon: 'menu_book',     label: 'Luyện đọc' },
  { to: '/teacher/earnings',      icon: 'payments',      label: 'Thu nhập' },
  { to: '/teacher/dictionary',    icon: 'auto_stories',  label: 'Từ điển' },
  { to: '/teacher/quizzes',       icon: 'quiz',          label: 'Bài kiểm tra' },
  { to: '/teacher/question-bank', icon: 'inventory_2',   label: 'Ngân hàng câu hỏi' },
  // Ẩn khỏi sidebar theo yêu cầu (giữ nguyên route/API/component để bật lại sau)
  // { to: '/teacher/classes',       icon: 'groups',        label: 'Lớp học' },
  { to: '/chat',                  icon: 'smart_toy',     label: 'Trợ lý AI' },
  { to: '/profile',               icon: 'person',        label: 'Hồ sơ' },
];

export default function TeacherLayout({ children, title }) {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={TEACHER_LINKS} brand="KN Teacher" />

      <div className="flex-1 md:ml-64 flex flex-col">
        <AppHeader roleBadge={{ label: t('roles.teacher'), colorClass: 'bg-tsubaki-red' }} title={title} />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <MobileNav links={TEACHER_LINKS} />
    </div>
  );
}
