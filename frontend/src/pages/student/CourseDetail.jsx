import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVEL_BADGE = {
  N5:       'bg-green-100 text-green-700 border-green-200',
  N4:       'bg-blue-100 text-blue-700 border-blue-200',
  N3:       'bg-yellow-100 text-yellow-700 border-yellow-200',
  N2:       'bg-orange-100 text-orange-700 border-orange-200',
  N1:       'bg-red-100 text-red-700 border-red-200',
  Business: 'bg-purple-100 text-purple-700 border-purple-200',
};

const LEVEL_GRADIENT = {
  N5:       'from-green-500/10 to-emerald-400/10',
  N4:       'from-blue-500/10 to-sky-400/10',
  N3:       'from-yellow-500/10 to-amber-400/10',
  N2:       'from-orange-500/10 to-red-400/10',
  N1:       'from-red-600/15 to-rose-400/10',
  Business: 'from-purple-500/10 to-violet-400/10',
};

const TYPE_META = {
  video:      { icon: 'play_circle', color: 'text-sumire-purple' },
  reading:    { icon: 'article',     color: 'text-primary' },
  vocabulary: { icon: 'translate',   color: 'text-green-600' },
  kanji:      { icon: 'draw',        color: 'text-purple-600' },
  grammar:    { icon: 'spellcheck',  color: 'text-amber-600' },
  quiz:       { icon: 'quiz',        color: 'text-tsubaki-red' },
};

function ItemRow({ item, index }) {
  const meta = TYPE_META[item.lesson_type] || TYPE_META.reading;
  return (
    <Link
      to={`/lessons/${item.id}`}
      className="flex items-center gap-3 py-3 pl-10 pr-5 hover:bg-surface-container-low transition-colors group"
    >
      <span className={`material-symbols-outlined text-xl shrink-0 ${item.completed ? 'text-green-600' : meta.color}`}>
        {item.completed ? 'check_circle' : meta.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-on-surface group-hover:text-tsubaki-red transition-colors line-clamp-1">
          {item.title}
        </p>
        {item.title_ja && <p className="text-xs text-on-muted mt-0.5">{item.title_ja}</p>}
      </div>
      <span className="material-symbols-outlined text-lg text-on-muted/40 group-hover:text-tsubaki-red group-hover:translate-x-1 transition-all shrink-0">
        chevron_right
      </span>
    </Link>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get(`/courses/${id}`)
      .then(r => setCourse(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <StudentLayout title="...">
      <div className="flex justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
      </div>
    </StudentLayout>
  );

  if (error || !course) return (
    <StudentLayout title="Lỗi">
      <Alert type="error">{error || 'Không tìm thấy khóa học.'}</Alert>
    </StudentLayout>
  );

  const units = course.units || [];
  const allItems = units.flatMap(u => u.lessons || []);
  const totalItems = allItems.length;
  const completedCount = allItems.filter(i => i.completed).length;
  const progressPct = course.progress_pct ?? (totalItems ? Math.round((completedCount / totalItems) * 100) : 0);
  const resumeItem = allItems.find(i => !i.completed) || allItems[0] || null;
  const started = completedCount > 0;

  return (
    <StudentLayout title={course.title}>
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-8 group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Danh mục khóa học
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {course.level && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${LEVEL_BADGE[course.level] || 'bg-surface-container text-on-muted border-outline-variant'}`}>
                JLPT {course.level}
              </span>
            )}
            {totalItems > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-muted border border-outline-variant">
                {units.length} bài học • {totalItems} mục
              </span>
            )}
          </div>

          <h1 className="font-display text-display-mobile font-bold text-on-surface leading-tight">{course.title}</h1>
          {course.title_ja && <p className="text-lg text-on-muted">{course.title_ja}</p>}
          <p className="text-base text-on-surface-variant leading-relaxed">
            {course.description || 'Khám phá nội dung và bắt đầu hành trình học tiếng Nhật của bạn.'}
          </p>

          {/* Progress */}
          {totalItems > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-on-muted">
                <span>Tiến độ</span>
                <span>{completedCount}/{totalItems} mục • {progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full bg-tsubaki-red rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {resumeItem ? (
              <Link
                to={`/lessons/${resumeItem.id}`}
                className="inline-flex items-center gap-2 bg-tsubaki-red text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary transition-colors shadow-md shadow-tsubaki-red/20"
              >
                {started ? 'Tiếp tục học' : 'Bắt đầu học'}
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            ) : (
              <span className="text-on-muted text-sm italic">Chưa có nội dung nào</span>
            )}
            <div className="flex items-center gap-1.5 text-on-muted text-sm">
              <span className="material-symbols-outlined text-base">schedule</span>
              Tự học theo tốc độ của bạn
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-outline-variant/60 shadow-xl relative group">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${LEVEL_GRADIENT[course.level] || 'from-tsubaki-red/10 to-sumire-purple/10'} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-8xl text-tsubaki-red/15">menu_book</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </div>
      </section>

      <hr className="border-outline-variant/30 mb-10" />

      {/* ── Content ──────────────────────────────────────────────────── */}
      <h2 className="font-display text-xl font-bold text-on-surface flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-tsubaki-red">list_alt</span>
        Nội dung khóa học
      </h2>

      {totalItems === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-on-muted border border-outline-variant/40">
          <span className="material-symbols-outlined text-5xl block mb-3 opacity-20">article</span>
          <p className="font-semibold">Chưa có nội dung nào</p>
          <p className="text-sm mt-1 opacity-70">Hãy quay lại sau!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {units.map((unit, uIdx) => (
            <div key={unit.id} className="glass-card rounded-2xl overflow-hidden border border-outline-variant/60">
              {/* Unit header */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-surface-container-low border-b border-outline-variant/30">
                <span className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red text-xs font-bold flex items-center justify-center shrink-0">
                  {uIdx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-on-surface truncate">{unit.title}</p>
                  {unit.title_ja && <p className="text-xs text-on-muted truncate">{unit.title_ja}</p>}
                </div>
                <span className="text-xs text-on-muted shrink-0">{(unit.lessons || []).length} mục</span>
              </div>
              {/* Items */}
              <div className="divide-y divide-outline-variant/20">
                {(unit.lessons || []).map((item, i) => (
                  <ItemRow key={item.id} item={item} index={i} />
                ))}
                {(unit.lessons || []).length === 0 && (
                  <p className="px-5 py-4 text-sm text-on-muted italic">Chưa có mục nào.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </StudentLayout>
  );
}
