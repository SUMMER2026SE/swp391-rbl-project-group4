import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const CHART_BARS = [
  { pct: 60, cls: 'bg-tsubaki-red' },
  { pct: 45, cls: 'bg-tsubaki-red' },
  { pct: 85, cls: 'bg-tsubaki-red' },
  { pct: 70, cls: 'bg-tsubaki-red' },
  { pct: 55, cls: 'bg-tsubaki-red' },
  { pct: 40, cls: 'bg-sumire-purple' },
  { pct: 90, cls: 'bg-tsubaki-red' },
  { pct: 65, cls: 'bg-tsubaki-red' },
  { pct: 75, cls: 'bg-tsubaki-red' },
  { pct: 50, cls: 'bg-tsubaki-red' },
];

const QUICK_LINKS = [
  { label: 'Quản lý người dùng',  icon: 'person_add',  href: '/admin/users' },
  { label: 'Trình soạn khoá học', icon: 'edit_note',   href: '/admin/courses' },
  { label: 'Quản lý từ vựng',     icon: 'translate',   href: '/admin/vocabulary' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

function StatCard({ label, value, icon, iconBg, iconText, badge, badgeCls, loading }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconText}`}>{icon}</span>
        </div>
        {badge && <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>}
      </div>
      <p className="text-sm text-on-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold font-display ${iconText}`}>
        {loading ? <span className="inline-block w-12 h-8 bg-surface-low rounded animate-pulse" /> : (value ?? 0).toLocaleString('vi')}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]       = useState({});
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/admin/stats'),
      api.get('/admin/activity'),
    ]).then(([sRes, aRes]) => {
      if (sRes.status === 'fulfilled') setStats(sRes.value.data || {});
      if (aRes.status === 'fulfilled') setActivity(aRes.value.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Bảng điều khiển">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-tsubaki-red">Bảng điều khiển quản trị</h1>
          <p className="text-sm text-on-muted mt-1">Chào mừng trở lại. Đây là tóm tắt hệ thống hôm nay.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/admin/users"
            className="px-5 py-2.5 border border-tsubaki-red text-tsubaki-red rounded-xl text-sm font-semibold hover:bg-tsubaki-red/5 transition-all">
            Quản lý người dùng
          </Link>
          <Link to="/admin/courses"
            className="px-5 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:opacity-90 shadow-sm transition-all">
            + Tạo khoá học
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng người dùng"   value={stats.total_users}   icon="group"            iconBg="bg-tsubaki-red/10"    iconText="text-tsubaki-red"   badge="+mới"   badgeCls="text-green-700 bg-green-50"    loading={loading} />
        <StatCard label="Giáo viên"          value={stats.teacher_count} icon="school"           iconBg="bg-tsubaki-red/10"    iconText="text-tsubaki-red"   loading={loading} />
        <StatCard label="Khoá học hiện có"  value={stats.total_courses} icon="library_books"    iconBg="bg-green-100"         iconText="text-green-700"     loading={loading} />
        <StatCard label="Bài kiểm tra"      value={stats.total_quizzes} icon="quiz"             iconBg="bg-amber-100"         iconText="text-amber-700"     loading={loading} />
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* System health */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display font-bold text-lg">Hoạt động hệ thống</h2>
            <div className="flex gap-4 text-xs text-on-muted">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-tsubaki-red inline-block" />Hiệu năng</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sumire-purple inline-block" />Lưu lượng</span>
            </div>
          </div>

          <div className="h-48 flex items-end gap-1.5 px-2 pb-2 bg-surface-low/60 rounded-xl border border-outline/20 overflow-hidden">
            {CHART_BARS.map((bar, i) => (
              <div key={i} className={`flex-1 ${bar.cls} rounded-t-md opacity-80 hover:opacity-100 transition-all`}
                style={{ height: `${bar.pct}%` }} />
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
              <span className="text-sm">Tất cả dịch vụ hoạt động bình thường</span>
            </div>
            <span className="text-xs text-on-muted">Cập nhật vừa xong</span>
          </div>
        </div>

        {/* Right column: quick actions + progress */}
        <div className="flex flex-col gap-4">
          <div className="bg-tsubaki-red rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="font-display font-bold text-lg mb-4 relative z-10">Phím tắt nhanh</h3>
            <div className="flex flex-col gap-2 relative z-10">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} to={link.href}
                  className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all group border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">{link.icon}</span>
                    <span className="text-sm font-medium">{link.label}</span>
                  </div>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-xs font-bold text-tsubaki-red uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">verified</span>
              Tiến trình nền tảng
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Mục tiêu quý',        pct: 85, bar: 'bg-tsubaki-red',   num: 'text-tsubaki-red' },
                { label: 'Tỷ lệ hoàn thành N1', pct: 62, bar: 'bg-sumire-purple', num: 'text-sumire-purple' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-on-muted">{item.label}</span>
                    <span className={`text-xs font-bold ${item.num}`}>{item.pct}%</span>
                  </div>
                  <div className="w-full bg-surface-low rounded-full h-2">
                    <div className={`${item.bar} h-2 rounded-full shadow-sm`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display font-bold text-lg">Hoạt động gần đây</h2>
          <Link to="/admin/users" className="text-sm text-sumire-purple hover:underline">Xem tất cả →</Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-low rounded-xl animate-pulse" />)}
          </div>
        ) : activity.length === 0 ? (
          <p className="text-center text-on-muted text-sm py-10">Chưa có hoạt động nào.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline/20 text-xs text-on-muted uppercase tracking-wider">
                  <th className="pb-3 pl-1 font-semibold">Người dùng</th>
                  <th className="pb-3 font-semibold">Hành động</th>
                  <th className="pb-3 font-semibold">Thời gian</th>
                  <th className="pb-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((item, i) => (
                  <tr key={item.id || i} className="border-b border-outline/10 hover:bg-surface-low/50 transition-colors">
                    <td className="py-3.5 pl-1">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-tsubaki-red/10 flex items-center justify-center text-tsubaki-red font-bold text-xs shrink-0">
                          {item.initials}
                        </div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-on-muted">{item.action}</td>
                    <td className="py-3.5 text-on-muted">{timeAgo(item.time)}</td>
                    <td className="py-3.5">
                      <span className="bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full text-xs font-bold">
                        Thành công
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
