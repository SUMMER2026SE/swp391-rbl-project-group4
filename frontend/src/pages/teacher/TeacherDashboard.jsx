import { Link } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import { useAuth } from '../../contexts/AuthContext';

const PERF_BARS = [
  { label: 'Reading',   pct: 85 },
  { label: 'Writing',   pct: 60 },
  { label: 'Listening', pct: 92, solid: true },
  { label: 'Speaking',  pct: 70 },
];

const PENDING = [
  { icon: 'groups',         iconCls: 'text-tsubaki-red',   bg: 'bg-tsubaki-red/10',   title: 'Quản lý lớp học',  desc: 'Tạo lớp và quản lý học viên của bạn.' },
  { icon: 'quiz',           iconCls: 'text-sumire-purple', bg: 'bg-sumire-purple/10', title: 'Bài kiểm tra',     desc: 'Soạn bài kiểm tra mới cho học viên.' },
  { icon: 'font_download',  iconCls: 'text-on-muted',      bg: 'bg-surface-low',      title: 'Thêm Kanji',       desc: 'Bổ sung Kanji vào kho học liệu.' },
];

// ── Thẻ điều hướng nhanh tới các khu vực thật của giáo viên ──────────────────
const QUICK_NAV = [
  { to: '/teacher/classes',       label: 'Lớp học',          icon: 'groups',      iconCls: 'text-tsubaki-red',   bg: 'bg-tsubaki-red/10' },
  { to: '/teacher/question-bank', label: 'Ngân hàng câu hỏi', icon: 'inventory_2', iconCls: 'text-sumire-purple', bg: 'bg-sumire-purple/10' },
  { to: '/teacher/vocab',         label: 'Học liệu',         icon: 'translate',   iconCls: 'text-amber-600',     bg: 'bg-amber-100' },
];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || 'Giáo viên';

  return (
    <TeacherLayout title="Dashboard">
      {/* Greeting */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl font-bold text-on-surface mb-2 tracking-tight">
              Xin chào, <span className="text-tsubaki-red">{name}</span>!{' '}
              <span className="opacity-50 font-medium text-2xl">おはようございます</span>
            </h1>
            <p className="text-on-muted leading-relaxed max-w-xl">
              Quản lý lớp học và nội dung học liệu của bạn từ đây.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/teacher/classes"
              className="px-5 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-tsubaki-red/20 transition-all">
              <span className="material-symbols-outlined text-[18px]">groups</span>
              Quản lý lớp học
            </Link>
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <section className="grid sm:grid-cols-3 gap-5 mb-10">
        {QUICK_NAV.map(card => (
          <Link key={card.to} to={card.to} className="glass-card p-6 rounded-2xl flex flex-col justify-between h-36 hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start">
              <div className={`p-2 ${card.bg} rounded-lg`}>
                <span className={`material-symbols-outlined ${card.iconCls}`}>{card.icon}</span>
              </div>
              <span className="material-symbols-outlined text-on-muted/40 group-hover:text-tsubaki-red transition-colors">chevron_right</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-on-muted uppercase tracking-widest mb-1">Truy cập nhanh</p>
              <h2 className="font-display text-xl font-bold text-on-surface">{card.label}</h2>
            </div>
          </Link>
        ))}
      </section>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        {/* Left: performance */}
        <div className="lg:col-span-2 space-y-8">
          {/* Performance chart (decorative) */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-display text-lg font-bold">Phân bố kỹ năng</h3>
                <p className="text-sm text-on-muted">Tỷ lệ kỹ năng học viên trong lớp</p>
              </div>
              <select className="bg-surface-low border-none text-xs font-bold rounded-xl px-3 py-2 outline-none">
                <option>Tháng này</option>
                <option>Quý trước</option>
              </select>
            </div>
            <div className="flex items-end justify-between h-44 gap-4 px-2">
              {PERF_BARS.map(bar => (
                <div key={bar.label} className="flex flex-col items-center gap-3 flex-1">
                  <div className="w-full bg-surface-low relative rounded-xl group overflow-hidden" style={{ height: `${bar.pct}%` }}>
                    <div className={`absolute inset-x-0 bottom-0 h-full ${bar.solid ? 'bg-tsubaki-red' : 'bg-tsubaki-red/40'}`} />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-white">
                      {bar.pct}%
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-muted">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Pending actions */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-display text-lg font-bold mb-5">Hành động nhanh</h3>
            <div className="space-y-5">
              {PENDING.map(item => (
                <div key={item.title} className="flex items-start gap-3 group cursor-pointer">
                  <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <span className={`material-symbols-outlined ${item.iconCls} text-[20px]`}>{item.icon}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{item.title}</h4>
                    <p className="text-xs text-on-muted leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/teacher/classes"
              className="w-full mt-6 py-2.5 border border-outline/30 rounded-xl text-xs font-bold text-on-muted hover:bg-surface-low transition-all flex items-center justify-center">
              Đến khu vực quản lý
            </Link>
          </div>

          {/* Activity feed */}
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-display text-lg font-bold mb-5">Hoạt động</h3>
            <div className="relative space-y-6 before:absolute before:left-[10px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-surface-low">
              {[
                { dot: 'bg-tsubaki-red', time: 'Vừa xong',  text: 'Tài khoản giáo viên được kích hoạt.' },
                { dot: 'bg-on-muted',    time: 'Hôm nay',   text: 'Đăng nhập thành công vào hệ thống.' },
                { dot: 'bg-surface-low', time: 'Hệ thống',  text: 'Kizuna Nihongo Teacher Portal sẵn sàng.' },
              ].map((item, i) => (
                <div key={i} className="relative pl-7">
                  <div className={`absolute left-0 top-1 w-5 h-5 rounded-full ${item.dot} border-4 border-white z-10`} />
                  <p className="text-[10px] font-bold text-on-muted uppercase tracking-widest mb-0.5">{item.time}</p>
                  <p className="text-[13px] leading-snug">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
