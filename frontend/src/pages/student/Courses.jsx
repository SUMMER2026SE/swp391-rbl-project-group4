import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Business'];

const LEVEL_DOT = {
  N5: 'bg-green-500',
  N4: 'bg-blue-500',
  N3: 'bg-yellow-500',
  N2: 'bg-orange-500',
  N1: 'bg-red-600',
  Business: 'bg-purple-500',
};

const LEVEL_GRADIENT = {
  N5:       'from-green-500/10 to-emerald-400/10',
  N4:       'from-blue-500/10 to-sky-400/10',
  N3:       'from-yellow-500/10 to-amber-400/10',
  N2:       'from-orange-500/10 to-red-400/10',
  N1:       'from-red-600/15 to-rose-400/10',
  Business: 'from-purple-500/10 to-violet-400/10',
};

function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl overflow-hidden animate-pulse">
      <div className="h-48 bg-surface-container" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-surface-container rounded-full w-1/4" />
        <div className="h-5 bg-surface-container rounded-full w-3/4" />
        <div className="h-3 bg-surface-container rounded-full w-full" />
        <div className="h-3 bg-surface-container rounded-full w-2/3" />
        <div className="pt-2 flex justify-between">
          <div className="h-3 bg-surface-container rounded-full w-1/3" />
          <div className="h-3 bg-surface-container rounded-full w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default function Courses() {
  const [courses, setCourses]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [level, setLevel]       = useState('');
  const [page, setPage]         = useState(1);
  const LIMIT = 9;

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      const r = await api.get(`/courses?${params}`);
      setCourses(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, [page, level]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCourses();
  };

  return (
    <StudentLayout title="Khóa học">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-mobile font-bold text-on-surface mb-2 tracking-tight">
            Danh mục khóa học
          </h1>
          <p className="text-on-surface-variant text-base max-w-xl leading-relaxed">
            Khám phá hành trình tiếng Nhật của bạn — từ N5 cơ bản đến N1 nâng cao, mỗi khóa học được thiết kế theo từng bước.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-lg pointer-events-none">
              search
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm khóa học..."
              className="pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-sm outline-none focus:border-tsubaki-red bg-white w-52 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors shadow-sm"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* ── Filter chips ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5 mb-8">
        <button
          onClick={() => { setLevel(''); setPage(1); }}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            !level
              ? 'bg-tsubaki-red text-white shadow-md shadow-tsubaki-red/20'
              : 'bg-white border border-outline-variant text-charcoal-text hover:border-tsubaki-red hover:text-tsubaki-red'
          }`}
        >
          Tất cả
        </button>
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => { setLevel(l); setPage(1); }}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              level === l
                ? 'bg-tsubaki-red text-white shadow-md shadow-tsubaki-red/20'
                : 'bg-white border border-outline-variant text-charcoal-text hover:border-tsubaki-red hover:text-tsubaki-red'
            }`}
          >
            {l === 'Business' ? 'Business' : `JLPT ${l}`}
          </button>
        ))}
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-center py-6 text-error text-sm">{error}</p>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">menu_book</span>
          <p className="font-semibold text-on-surface mb-1">Không tìm thấy khóa học</p>
          <p className="text-on-muted text-sm">Thử bỏ bộ lọc hoặc nhập từ khóa khác</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="glass-card rounded-xl overflow-hidden group cursor-pointer border-2 border-transparent hover:border-tsubaki-red hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative h-48 w-full overflow-hidden bg-surface-container shrink-0">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${LEVEL_GRADIENT[course.level] || 'from-tsubaki-red/10 to-sumire-purple/10'} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-6xl text-tsubaki-red/15">menu_book</span>
                  </div>
                )}

                {/* Level badge */}
                {course.level && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <span className={`w-2 h-2 rounded-full ${LEVEL_DOT[course.level] || 'bg-gray-400'} animate-pulse`} />
                    <span className="text-xs font-bold text-charcoal-text">{course.level}</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="font-display text-lg font-bold text-on-surface mb-1.5 group-hover:text-tsubaki-red transition-colors line-clamp-2 leading-snug">
                  {course.title}
                </h3>
                {course.title_ja && (
                  <p className="text-sm text-on-muted mb-2">{course.title_ja}</p>
                )}
                <p className="text-sm text-on-surface-variant leading-relaxed flex-grow line-clamp-3 mb-4">
                  {course.description || 'Khóa học tiếng Nhật chất lượng cao dành cho người học.'}
                </p>

                {/* Footer row */}
                <div className="mt-auto pt-4 border-t border-outline-variant/40 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-on-muted text-xs">
                    <span className="material-symbols-outlined text-base">menu_book</span>
                    <span>Xem nội dung</span>
                  </div>
                  <span className="text-tsubaki-red text-sm font-semibold group-hover:underline decoration-tsubaki-red flex items-center gap-1">
                    Học ngay
                    <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {total > LIMIT && (
        <div className="flex justify-center items-center gap-2 mt-10">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            ← Trước
          </button>
          <span className="px-4 py-2.5 text-sm text-on-muted">
            Trang {page} / {Math.ceil(total / LIMIT)}
          </span>
          <button
            disabled={page * LIMIT >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            Tiếp →
          </button>
        </div>
      )}
    </StudentLayout>
  );
}
