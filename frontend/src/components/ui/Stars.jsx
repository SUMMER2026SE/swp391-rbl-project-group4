import { useState } from 'react';

// Sao đánh giá — dùng được cả readonly (hiển thị) lẫn interactive (form).
// value: số sao đang chọn/hiển thị (làm tròn khi readonly).
export default function Stars({ value = 0, max = 5, size = 'text-base', interactive = false, onChange, className = '' }) {
  const [hover, setHover] = useState(0);
  const shown = interactive ? (hover || value) : value;

  return (
    <div
      className={`inline-flex items-center ${className}`}
      onMouseLeave={() => interactive && setHover(0)}
      role={interactive ? 'radiogroup' : undefined}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const i = idx + 1;
        const filled = shown >= i;
        const cls = `material-symbols-outlined ${size} ${filled ? 'fill text-amber-400' : 'text-outline/40'}`;
        if (!interactive) return <span key={i} className={cls}>star</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i)}
            onMouseEnter={() => setHover(i)}
            aria-label={`${i} sao`}
            className="p-0.5 leading-none transition-transform hover:scale-110 focus:outline-none"
          >
            <span className={`material-symbols-outlined ${size} ${shown >= i ? 'fill text-amber-400' : 'text-outline/50'}`}>star</span>
          </button>
        );
      })}
    </div>
  );
}
