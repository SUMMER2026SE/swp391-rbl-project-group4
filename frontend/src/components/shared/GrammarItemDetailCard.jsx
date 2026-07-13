import FuriganaText from '../ui/FuriganaText';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

// Thẻ chi tiết 1 mẫu ngữ pháp có prev/next — tách từ StudyListItemDetail để
// dùng chung cho bài đăng và Mục ngữ pháp của khóa học. Caller lo data + điều hướng.
export default function GrammarItemDetailCard({ item, index, total, onPrev, onNext }) {
  return (
    <div className="glass-card rounded-3xl overflow-hidden max-w-2xl">
      <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />

      <div className="px-8 pt-8 pb-2">
        <div className="flex items-center gap-2 mb-3">
          {item.level && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>
              {item.level}
            </span>
          )}
          <span className="text-xs text-on-muted">Mục {index + 1}/{total}</span>
        </div>
        <h1 className="text-3xl font-bold text-tsubaki-red leading-tight">{item.title}</h1>
        {item.title_ja && <p className="text-on-muted mt-1">{item.title_ja}</p>}

        <div className="mt-6">
          <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa</p>
          <p className="text-lg font-bold text-charcoal">{item.meaning_vi}</p>
        </div>

        {item.explanation && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Cấu trúc / Cách dùng</p>
            <p className="text-charcoal whitespace-pre-wrap leading-relaxed">{item.explanation}</p>
          </div>
        )}

        {item.example_sentence && (
          <div className="mt-6 mb-2">
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Ví dụ</p>
            <div className="text-charcoal italic bg-surface-low rounded-xl px-4 py-3">
              「<FuriganaText text={item.example_sentence} textClassName="italic" />」
            </div>
          </div>
        )}
      </div>

      <div className="px-8 pb-8 pt-6 flex gap-2 border-t border-outline/30 mt-4">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
        </button>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
        >
          Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
