import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import AppHeader from './AppHeader';
import { useLang } from '../../contexts/LangContext';

const ADMIN_LINKS = (t) => [
  { to: '/admin',             icon: 'dashboard',     label: t('admin.dashboard'), exact: true },
  { to: '/admin/users',       icon: 'group',         label: t('admin.users') },
  { to: '/admin/courses',     icon: 'menu_book',     label: t('admin.courses') },
  { to: '/admin/vocabulary',  icon: 'translate',     label: t('admin.vocabulary') },
  { to: '/admin/study-lists', icon: 'library_books', label: 'Bài đăng' },
  { to: '/admin/kanji',       icon: 'font_download', label: t('admin.kanji') },
  { to: '/admin/grammar-points', icon: 'menu_book',  label: 'Ngữ pháp (từ điển)' },
  { to: '/admin/questions',    icon: 'inventory_2',   label: 'Ngân hàng câu hỏi' },
  { to: '/admin/mock-exams',   icon: 'fact_check',    label: 'Thi thử JLPT' },
  { to: '/admin/jlpt-bank',    icon: 'inventory',     label: 'Ngân hàng JLPT' },
  { to: '/admin/listening',    icon: 'headphones',      label: 'Hội thoại nghe' },
  { to: '/admin/placement',   icon: 'assignment_ind',  label: 'Kiểm tra NL' },
  { to: '/admin/reading',      icon: 'auto_stories',  label: 'Luyện đọc' },
  { to: '/admin/teacher-applications', icon: 'verified_user', label: 'Đơn giáo viên' },
  { to: '/admin/subscriptions', icon: 'workspace_premium', label: 'Đăng ký' },
  { to: '/admin/payments',      icon: 'payments',          label: 'Thanh toán' },
  { to: '/admin/revenue-pool',  icon: 'savings',           label: 'Quỹ doanh thu' },
  { to: '/admin/system',        icon: 'monitor_heart',     label: 'Hoạt động HT' },
  { to: '/chat',               icon: 'smart_toy',       label: 'Trợ lý AI' },
  { to: '/profile',            icon: 'person',          label: 'Hồ sơ' },
];

export default function AdminLayout({ children, title }) {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar links={ADMIN_LINKS(t)} brand="KN Admin" />

      <div className="flex-1 md:ml-64 flex flex-col">
        <AppHeader roleBadge={{ label: t('roles.admin'), colorClass: 'bg-sumire-purple' }} title={title} />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <MobileNav links={ADMIN_LINKS(t)} />
    </div>
  );
}
