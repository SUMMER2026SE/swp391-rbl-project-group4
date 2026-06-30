import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import CourseCard, { CourseCardSkeleton } from '../../components/ui/CourseCard';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SORTS = [
  { value: 'newest',  label: 'Mới nhất' },
  { value: 'popular', label: 'Nhiều học viên' },
  { value: 'rating',  label: 'Đánh giá cao' },
];
const PRICE = [
  { value: '',      label: 'Tất cả' },
  { value: 'true',  label: 'Miễn phí' },
  { value: 'false', label: 'Có phí' },
];

const LIMIT = 9;

export default function Courses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const difficulty = searchParams.get('difficulty') || '';
  const isFree     = searchParams.get('is_free')    || '';
  const sort       = searchParams.get('sort')       || 'newest';
  const q          = searchParams.get('search')     || '';
  const page       = Number(searchParams.get('page') || 1);

  const [courses, setCourses] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [searchInput, setSearchInput] = useState(q);

  // Cập nhật URL params; mọi thay đổi bộ lọc reset về trang 1 (trừ khi đổi chính page).
  const setParam = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => { setSearchInput(q); }, [q]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page, limit: LIMIT, sort });
    if (q)          params.set('search', q);
    if (difficulty) params.set('difficulty', difficulty);
    if (isFree)     params.set('is_free', isFree);
    api.get(`/courses?${params}`)
      .then(r => { setCourses(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, sort, q, difficulty, isFree]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = difficulty || isFree || q;

  return (
    <StudentLayout title="Khóa học">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="font-display text-display-mobile font-bold text-on-surface mb-2 tracking-tight">
          Danh mục khóa học
        </h1>
        <p className="text-on-surface-variant text-base max-w-xl leading-relaxed">
          Khám phá hành trình tiếng Nhật của bạn — từ N5 cơ bản đến N1 nâng cao.
        </p>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-4 mb-8 space-y-4 border border-outline-variant/40">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          {/* Search */}
          <form
            onSubmit={e => { e.preventDefault(); setParam({ search: searchInput.trim() }); }}
            className="relative flex-1 max-w-md"
          >
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-lg pointer-events-none">
              search
            </span>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm khóa học theo tên..."
              className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-sm outline-none focus:border-tsubaki-red bg-white transition-colors"
            />
          </form>

          <div className="flex flex-wrap gap-3">
            {/* Price */}
            <select
              value={isFree}
              onChange={e => setParam({ is_free: e.target.value })}
              className="px-4 py-2.5 bg-white border border-outline-variant rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            >
              {PRICE.map(p => <option key={p.value} value={p.value}>{p.label === 'Tất cả' ? 'Tất cả học phí' : p.label}</option>)}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setParam({ sort: e.target.value })}
              className="px-4 py-2.5 bg-white border border-outline-variant rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Difficulty chips */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setParam({ difficulty: '' })}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              !difficulty
                ? 'bg-tsubaki-red text-white shadow-md shadow-tsubaki-red/20'
                : 'bg-white border border-outline-variant text-charcoal-text hover:border-tsubaki-red hover:text-tsubaki-red'
            }`}
          >
            Tất cả cấp độ
          </button>
          {LEVELS.map(l => (
            <button
              key={l}
              onClick={() => setParam({ difficulty: l })}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                difficulty === l
                  ? 'bg-tsubaki-red text-white shadow-md shadow-tsubaki-red/20'
                  : 'bg-white border border-outline-variant text-charcoal-text hover:border-tsubaki-red hover:text-tsubaki-red'
              }`}
            >
              JLPT {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && <p className="text-center py-6 text-error text-sm">{error}</p>}

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">menu_book</span>
          <p className="font-semibold text-on-surface mb-1">Không tìm thấy khóa học</p>
          <p className="text-on-muted text-sm">
            {hasFilters ? 'Thử bỏ bộ lọc hoặc nhập từ khóa khác' : 'Hãy quay lại sau!'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => <CourseCard key={course.id} course={course} />)}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-10">
          <button
            disabled={page === 1}
            onClick={() => setParam({ page: page - 1 })}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            ← Trước
          </button>
          <span className="px-4 py-2.5 text-sm text-on-muted">Trang {page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setParam({ page: page + 1 })}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            Tiếp →
          </button>
        </div>
      )}
    </StudentLayout>
  );
}
