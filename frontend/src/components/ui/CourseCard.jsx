import { Link } from 'react-router-dom';
import Stars from './Stars';
import { formatVnd, formatCount } from '../../lib/format';

const LEVEL_BADGE = {
  N5:    'bg-green-100 text-green-700 border-green-200',
  N4:    'bg-blue-100 text-blue-700 border-blue-200',
  N3:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  N2:    'bg-orange-100 text-orange-700 border-orange-200',
  N1:    'bg-red-100 text-red-700 border-red-200',
  mixed: 'bg-purple-100 text-purple-700 border-purple-200',
};

const LEVEL_GRADIENT = {
  N5:    'from-green-500/10 to-emerald-400/10',
  N4:    'from-blue-500/10 to-sky-400/10',
  N3:    'from-yellow-500/10 to-amber-400/10',
  N2:    'from-orange-500/10 to-red-400/10',
  N1:    'from-red-600/15 to-rose-400/10',
  mixed: 'from-purple-500/10 to-violet-400/10',
};

export function CourseCardSkeleton() {
  return (
    <div className="glass-card rounded-xl overflow-hidden animate-pulse">
      <div className="h-44 bg-surface-container" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-surface-container rounded-full w-3/4" />
        <div className="h-3 bg-surface-container rounded-full w-1/3" />
        <div className="h-3 bg-surface-container rounded-full w-full" />
        <div className="pt-3 flex justify-between">
          <div className="h-3 bg-surface-container rounded-full w-1/3" />
          <div className="h-3 bg-surface-container rounded-full w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default function CourseCard({ course }) {
  const lvl = course.difficulty_level || course.level;
  const rating = Number(course.avg_rating) || 0;
  const reviewCount = course.review_count || 0;
  const isAdmin = course.creator_type === 'admin';
  const author = course.creator_name || (isAdmin ? 'Kizuna Nihongo' : 'Giáo viên');

  return (
    <Link
      to={`/courses/${course.id}`}
      className="glass-card rounded-xl overflow-hidden group cursor-pointer border-2 border-transparent hover:border-tsubaki-red hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-44 w-full overflow-hidden bg-surface-container shrink-0">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${LEVEL_GRADIENT[lvl] || 'from-tsubaki-red/10 to-sumire-purple/10'} flex items-center justify-center`}>
            <span className="material-symbols-outlined text-6xl text-tsubaki-red/15">menu_book</span>
          </div>
        )}

        {/* Difficulty badge */}
        {lvl && (
          <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold border ${LEVEL_BADGE[lvl] || 'bg-white/90 text-charcoal-text border-outline-variant'}`}>
            {lvl === 'mixed' ? 'Tổng hợp' : lvl}
          </span>
        )}

        {/* Price / Free badge */}
        <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${
          course.is_free ? 'bg-green-500 text-white' : 'bg-white/95 text-tsubaki-red'
        }`}>
          {course.is_free ? 'Miễn phí' : formatVnd(course.price)}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-display text-lg font-bold text-on-surface mb-1 group-hover:text-tsubaki-red transition-colors line-clamp-2 leading-snug">
          {course.title}
        </h3>
        {course.title_ja && <p className="text-sm text-on-muted mb-2">{course.title_ja}</p>}

        {/* Rating */}
        <div className="flex items-center gap-1.5 text-xs mb-3">
          {reviewCount > 0 ? (
            <>
              <Stars value={Math.round(rating)} size="text-sm" />
              <span className="font-bold text-charcoal-text">{rating.toFixed(1)}</span>
              <span className="text-on-muted">({reviewCount})</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-on-muted/70">
              <span className="material-symbols-outlined text-sm">star</span>
              Chưa có đánh giá
            </span>
          )}
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed flex-grow line-clamp-2 mb-4">
          {course.description || 'Khóa học tiếng Nhật chất lượng cao dành cho người học.'}
        </p>

        {/* Footer: tác giả + lượt đăng ký */}
        <div className="mt-auto pt-4 border-t border-outline-variant/40 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-on-muted min-w-0">
            <span className={`material-symbols-outlined text-base shrink-0 ${isAdmin ? 'text-tsubaki-red fill' : ''}`}>
              {isAdmin ? 'verified' : 'person'}
            </span>
            <span className="truncate">{author}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-on-muted shrink-0">
            <span className="material-symbols-outlined text-base">group</span>
            {formatCount(course.enrollment_count)} học viên
          </span>
        </div>
      </div>
    </Link>
  );
}
