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


const LESSON_TYPE_ICON = {
  grammar:    'spellcheck',
  reading:    'article',
  vocabulary: 'translate',
  kanji:      'draw',
  quiz:       'quiz',
  video:      'play_circle',
  practice:   'fitness_center',
};

function LessonRow({ lesson, index, indent = false }) {
  return (
    <Link
      to={`/lessons/${lesson.id}`}
      className={`flex items-center gap-4 py-4 hover:bg-surface-container-low transition-colors group ${indent ? 'pl-10 pr-5' : 'px-5'}`}
    >
      <div className="w-8 h-8 rounded-full bg-surface-stone flex items-center justify-center text-xs font-bold text-on-muted border border-outline-variant/40 shrink-0 group-hover:bg-tsubaki-red group-hover:text-white group-hover:border-tsubaki-red transition-all duration-200">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-on-surface group-hover:text-tsubaki-red transition-colors line-clamp-1">
          {lesson.title}
        </p>
        {lesson.title_ja && (
          <p className="text-xs text-on-muted mt-0.5">{lesson.title_ja}</p>
        )}
      </div>
      {lesson.lesson_type && (
        <span className="material-symbols-outlined text-base text-on-muted/50 shrink-0" title={lesson.lesson_type}>
          {LESSON_TYPE_ICON[lesson.lesson_type] || 'chevron_right'}
        </span>
      )}
      <span className="material-symbols-outlined text-xl text-on-muted/40 group-hover:text-tsubaki-red group-hover:translate-x-1 transition-all shrink-0">
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

  const modules    = course.modules || [];
  const unassigned = course.lessons || [];
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0) + unassigned.length;
  const firstLesson  = modules[0]?.lessons[0] ?? unassigned[0] ?? null;

  return (
    <StudentLayout title={course.title}>
      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-8 group"
      >
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Danh mục khóa học
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left: meta + title + CTA */}
        <div className="lg:col-span-7 space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {course.level && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${LEVEL_BADGE[course.level] || 'bg-surface-container text-on-muted border-outline-variant'}`}>
                JLPT {course.level}
              </span>
            )}
            {totalLessons > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-muted border border-outline-variant">
                {totalLessons} bài học
              </span>
            )}
          </div>

          <h1 className="font-display text-display-mobile font-bold text-on-surface leading-tight">
            {course.title}
          </h1>
          {course.title_ja && (
            <p className="text-lg text-on-muted">{course.title_ja}</p>
          )}
          <p className="text-base text-on-surface-variant leading-relaxed">
            {course.description || 'Khám phá nội dung và bắt đầu hành trình học tiếng Nhật của bạn.'}
          </p>

          {/* CTA row */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {firstLesson ? (
              <Link
                to={`/lessons/${firstLesson.id}`}
                className="inline-flex items-center gap-2 bg-tsubaki-red text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary transition-colors shadow-md shadow-tsubaki-red/20"
              >
                Bắt đầu học
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            ) : (
              <span className="text-on-muted text-sm italic">Chưa có bài học nào</span>
            )}
            <div className="flex items-center gap-1.5 text-on-muted text-sm">
              <span className="material-symbols-outlined text-base">schedule</span>
              Tự học theo tốc độ của bạn
            </div>
          </div>
        </div>

        {/* Right: thumbnail */}
        <div className="lg:col-span-5">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-outline-variant/60 shadow-xl relative group">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
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

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: lesson list */}
        <div className="lg:col-span-8 space-y-5">
          <h2 className="font-display text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-tsubaki-red">list_alt</span>
            Nội dung khóa học
          </h2>

          {totalLessons === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center text-on-muted border border-outline-variant/40">
              <span className="material-symbols-outlined text-5xl block mb-3 opacity-20">article</span>
              <p className="font-semibold">Chưa có bài học nào</p>
              <p className="text-sm mt-1 opacity-70">Hãy quay lại sau!</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/60">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/30 bg-surface-container-low">
                <p className="text-sm font-semibold text-on-muted">{totalLessons} bài học</p>
                {firstLesson && (
                  <Link
                    to={`/lessons/${firstLesson.id}`}
                    className="text-xs font-semibold text-tsubaki-red hover:underline flex items-center gap-1"
                  >
                    Bắt đầu từ đầu
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                  </Link>
                )}
              </div>

              {/* Modules with nested lessons */}
              {modules.map((mod, modIdx) => (
                <div key={mod.id}>
                  {/* Module header */}
                  <div className="flex items-center gap-2 px-5 py-3 bg-surface-container-low/60 border-b border-outline-variant/20">
                    <span className="w-6 h-6 rounded-full bg-tsubaki-red/10 text-tsubaki-red text-xs font-bold flex items-center justify-center shrink-0">
                      {modIdx + 1}
                    </span>
                    <span className="font-semibold text-sm text-on-surface">{mod.title}</span>
                    <span className="ml-auto text-xs text-on-muted">{mod.lessons.length} bài</span>
                  </div>
                  {/* Lessons under this module */}
                  <div className="divide-y divide-outline-variant/20">
                    {mod.lessons.map((lesson, i) => (
                      <LessonRow key={lesson.id} lesson={lesson} index={i} indent />
                    ))}
                  </div>
                </div>
              ))}

              {/* Unassigned lessons (fallback) */}
              {unassigned.length > 0 && (
                <div className="divide-y divide-outline-variant/20">
                  {modules.length > 0 && (
                    <div className="px-5 py-3 bg-surface-container-low/60 border-b border-outline-variant/20">
                      <span className="font-semibold text-sm text-on-muted">Bài học khác</span>
                    </div>
                  )}
                  {unassigned.map((lesson, i) => (
                    <LessonRow key={lesson.id} lesson={lesson} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: stats + tip */}
        <div className="lg:col-span-4 space-y-5">

          {/* Course stats */}
          <div className="glass-card rounded-xl p-5 border border-outline-variant/60 space-y-4">
            <h3 className="font-display text-base font-bold text-on-surface">Thông tin khóa học</h3>

            <div className="space-y-3">
              {course.level && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-tsubaki-red/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-tsubaki-red text-lg">signal_cellular_alt</span>
                  </div>
                  <div>
                    <p className="text-xs text-on-muted">Trình độ</p>
                    <p className="font-semibold text-sm text-on-surface">JLPT {course.level}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sumire-purple/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-sumire-purple text-lg">menu_book</span>
                </div>
                <div>
                  <p className="text-xs text-on-muted">Số bài học</p>
                  <p className="font-semibold text-sm text-on-surface">{totalLessons} bài</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-green-600 text-lg">self_improvement</span>
                </div>
                <div>
                  <p className="text-xs text-on-muted">Hình thức</p>
                  <p className="font-semibold text-sm text-on-surface">Tự học</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            {firstLesson && (
              <Link
                to={`/lessons/${firstLesson.id}`}
                className="w-full inline-flex items-center justify-center gap-2 bg-tsubaki-red text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary transition-colors mt-2"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                Bắt đầu học ngay
              </Link>
            )}
          </div>

        </div>
      </div>
    </StudentLayout>
  );
}
