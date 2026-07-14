import { Link } from 'react-router-dom';

// Thẻ + badge ngữ pháp dùng chung giữa Study List (bài đăng) và Mục ngữ pháp
// của khóa học — tách từ ItemCard/NumberBadge/RemoveBadge trong StudyListDetail.
// Caller quyết định link chi tiết (`to`) và callback xóa (`onRemove`).

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

export function NumberBadge({ n }) {
  return (
    <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-charcoal/80 text-white text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

export function RemoveBadge({ onRemove, title = 'Xóa khỏi bài đăng' }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
      title={title}
      className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/90 text-on-muted hover:text-error hover:bg-white flex items-center justify-center shadow-sm transition-colors"
    >
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  );
}

// Thẻ gọn, bấm vào mở trang chi tiết riêng (URL thật, back trình duyệt hoạt động đúng)
export default function GrammarItemCard({ item, index, to, editable, onRemove, removeTitle }) {
  return (
    <div className="relative">
      {editable && <RemoveBadge onRemove={onRemove} title={removeTitle} />}
      <Link
        to={to}
        className="relative glass-card rounded-2xl p-5 pt-8 block hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all"
      >
        <NumberBadge n={index + 1} />
        <p className="text-xl font-bold text-tsubaki-red">{item.title}</p>
        {item.title_ja && <p className="text-sm text-on-muted">{item.title_ja}</p>}
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        <div className="flex items-center justify-between mt-3">
          {item.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
          <span className="flex items-center gap-1 text-xs text-tsubaki-red font-semibold ml-auto">
            Xem chi tiết <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </div>
      </Link>
    </div>
  );
}
