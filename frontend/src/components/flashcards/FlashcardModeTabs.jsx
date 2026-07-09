import { Link } from 'react-router-dom';

// Thanh chọn chế độ học của 1 học phần: Thẻ ghi nhớ / Học / Kiểm tra.
// active ∈ 'cards' | 'learn' | 'test'
const MODES = [
  { key: 'cards', label: 'Thẻ ghi nhớ', icon: 'style',  to: (id) => `/flashcards/${id}` },
  { key: 'learn', label: 'Học',         icon: 'school', to: (id) => `/flashcards/${id}/learn` },
  { key: 'test',  label: 'Kiểm tra',    icon: 'quiz',   to: (id) => `/flashcards/${id}/test` },
];

export default function FlashcardModeTabs({ setId, active }) {
  return (
    <div className="flex w-full sm:w-auto sm:inline-flex items-center gap-1 p-1 bg-surface-low rounded-2xl mb-6">
      {MODES.map(m => {
        const isActive = m.key === active;
        return (
          <Link
            key={m.key}
            to={m.to(setId)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsubaki-red/40 ${
              isActive
                ? 'bg-white text-tsubaki-red shadow-sm'
                : 'text-on-muted hover:text-charcoal hover:bg-white/50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{m.icon}</span>
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}
