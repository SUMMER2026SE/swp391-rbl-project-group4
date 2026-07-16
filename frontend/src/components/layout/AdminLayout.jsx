import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useLang } from '../../contexts/LangContext';
import { useAuth } from '../../contexts/AuthContext';

const ADMIN_LINKS = (t) => [
  { to: '/admin',             icon: 'dashboard',     label: t('admin.dashboard'), exact: true },
  { to: '/admin/users',       icon: 'group',         label: t('admin.users') },
  { to: '/admin/courses',     icon: 'menu_book',     label: t('admin.courses') },
  { to: '/admin/vocabulary',  icon: 'translate',     label: t('admin.vocabulary') },
  { to: '/admin/study-lists', icon: 'library_books', label: 'Bài đăng' },
  { to: '/admin/kanji',       icon: 'font_download', label: t('admin.kanji') },
  { to: '/admin/grammar-points', icon: 'menu_book',  label: 'Ngữ pháp (từ điển)' },
  { to: '/admin/quizzes',      icon: 'quiz',          label: t('admin.quizzes') },
  { to: '/admin/questions',    icon: 'inventory_2',   label: 'Ngân hàng câu hỏi' },
  { to: '/admin/mock-exams',   icon: 'fact_check',    label: 'Thi thử JLPT' },
  { to: '/admin/listening',    icon: 'headphones',      label: 'Hội thoại nghe' },
  { to: '/admin/placement',   icon: 'assignment_ind',  label: 'Kiểm tra NL' },
  { to: '/admin/reading',      icon: 'auto_stories',  label: 'Luyện đọc' },
  { to: '/admin/submissions',  icon: 'pending_actions', label: 'Yêu cầu duyệt' },
  { to: '/admin/teacher-applications', icon: 'verified_user', label: 'Đơn giáo viên' },
  // { to: '/admin/classes',      icon: 'groups',          label: 'Lớp học' }, // HIDDEN
  { to: '/chat',               icon: 'smart_toy',       label: 'Trợ lý AI' },
  { to: '/admin/subscriptions', icon: 'workspace_premium', label: 'Đăng ký' },
  { to: '/admin/payments',      icon: 'payments',          label: 'Thanh toán' },
  { to: '/admin/revenue-pool',  icon: 'savings',           label: 'Quỹ doanh thu' },
  { to: '/admin/system',        icon: 'monitor_heart',     label: 'Hoạt động HT' },
  { to: '/profile',            icon: 'person',          label: 'Hồ sơ' },
];

export default function AdminLayout({ children, title }) {
  const { t } = useLang();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={ADMIN_LINKS(t)} brand="KN Admin" />

      <div className="flex-1 md:ml-64 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-outline/30 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="bg-sumire-purple text-white text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide">Admin</span>
            <h1 className="text-sm font-bold text-charcoal">{title}</h1>
          </div>
          <span className="text-sm text-on-muted hidden md:block">{user?.email}</span>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <MobileNav links={ADMIN_LINKS(t)} />
    </div>
  );
}
