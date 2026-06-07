import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-teal-100 text-teal-700',
  N3: 'bg-blue-100 text-blue-700',
  N2: 'bg-sumire-purple/10 text-sumire-purple',
  N1: 'bg-tsubaki-red/10 text-tsubaki-red',
};

const PERF_BARS = [
  { label: 'Reading',   pct: 85 },
  { label: 'Writing',   pct: 60 },
  { label: 'Listening', pct: 92, solid: true },
  { label: 'Speaking',  pct: 70 },
];

const PENDING = [
  { icon: 'edit_note',      iconCls: 'text-tsubaki-red',   bg: 'bg-tsubaki-red/10',   title: 'Quản lý khoá học', desc: 'Xem và chỉnh sửa nội dung khoá học của bạn.' },
  { icon: 'quiz',           iconCls: 'text-sumire-purple', bg: 'bg-sumire-purple/10', title: 'Bài kiểm tra',     desc: 'Soạn bài kiểm tra mới cho học viên.' },
  { icon: 'font_download',  iconCls: 'text-on-muted',      bg: 'bg-surface-low',      title: 'Thêm Kanji',       desc: 'Bổ sung Kanji vào kho học liệu.' },
];

function CourseCard({ course }) {
  const pct = course.is_published ? 100 : Math.min(100, course.lesson_count * 10);
  const levelCls = LEVEL_COLORS[course.level] || 'bg-surface-low text-on-muted';

  return (
    <div className="glass-card rounded-2xl overflow-hidden group">
      <div className={`h-28 relative overflow-hidden flex items-center justify-center ${course.is_published ? 'bg-tsubaki-red' : 'bg-charcoal-text'}`}>
        <div className="absolute inset-0 opacity-10 text-[90px] font-bold text-white flex items-center justify-center select-none pointer-events-none">
          {course.title_ja || '日本語'}
        </div>
        <span className="relative z-10 text-white font-display font-bold text-base opacity-90 px-4 text-center">
          {course.title}
        </span>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-on-muted">{course.lesson_count} bài học</p>
          </div>
          <div className="flex items-center gap-1.5">
            {course.level && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${levelCls}`}>{course.level}</span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-surface-low text-on-muted'}`}>
              {course.is_published ? 'Đã xuất bản' : 'Nháp'}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-on-muted">Tiến trình</span>
            <span className="text-on-surface">{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-low rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${course.is_published ? 'bg-tsubaki-red' : 'bg-charcoal-text/40'}`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Link to="/teacher/courses"
          className="text-xs font-semibold text-tsubaki-red hover:underline flex items-center gap-0.5">
          Quản lý <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        </Link>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || 'Giáo viên';

  const [stats, setStats]     = useState({ total_courses: 0, total_lessons: 0, total_quizzes: 0 });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/teacher/stats'),
      api.get('/teacher/courses'),
    ]).then(([sRes, cRes]) => {
      if (sRes.status === 'fulfilled') setStats(sRes.value.data || {});
      if (cRes.status === 'fulfilled') setCourses(cRes.value.data || []);
    }).finally(() => setLoading(false));
  }, []);

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
              Quản lý khoá học, bài học và nội dung học liệu của bạn từ đây.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/teacher/courses"
              className="px-5 py-2.5 border border-outline/40 text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-low transition-all">
              Xem khoá học
            </Link>
            <Link to="/teacher/courses"
              className="px-5 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-md shadow-tsubaki-red/20 transition-all">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tạo khoá học
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid sm:grid-cols-3 gap-5 mb-10">
        {[
          { label: 'Khoá học của tôi', value: stats.total_courses, icon: 'library_books', iconCls: 'text-tsubaki-red', bg: 'bg-tsubaki-red/10' },
          { label: 'Bài học',          value: stats.total_lessons, icon: 'article',        iconCls: 'text-sumire-purple', bg: 'bg-sumire-purple/10' },
          { label: 'Bài kiểm tra',     value: stats.total_quizzes, icon: 'quiz',           iconCls: 'text-amber-600',    bg: 'bg-amber-100' },
        ].map(card => (
          <div key={card.label} className="glass-card p-6 rounded-2xl flex flex-col justify-between h-36">
            <div className="flex justify-between items-start">
              <div className={`p-2 ${card.bg} rounded-lg`}>
                <span className={`material-symbols-outlined ${card.iconCls}`}>{card.icon}</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-on-muted uppercase tracking-widest mb-1">{card.label}</p>
              <h2 className="font-display text-2xl font-bold text-on-surface">
                {loading ? '—' : card.value}
              </h2>
            </div>
          </div>
        ))}
      </section>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        {/* Left: my courses + performance */}
        <div className="lg:col-span-2 space-y-8">
          {/* My courses */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">Khoá học của tôi</h2>
              <Link to="/teacher/courses" className="text-tsubaki-red text-sm font-semibold hover:underline flex items-center gap-0.5">
                Xem tất cả <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </Link>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-5">
                {[0, 1].map(i => <div key={i} className="h-64 bg-surface-low rounded-2xl animate-pulse" />)}
              </div>
            ) : courses.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <span className="material-symbols-outlined text-5xl text-on-muted mb-3 block">library_books</span>
                <p className="text-on-muted text-sm mb-4">Bạn chưa tạo khoá học nào.</p>
                <Link to="/teacher/courses"
                  className="inline-flex items-center gap-1.5 bg-tsubaki-red text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Tạo khoá học đầu tiên
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                {courses.slice(0, 4).map(c => <CourseCard key={c.id} course={c} />)}
              </div>
            )}
          </div>

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
            <Link to="/teacher/courses"
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
