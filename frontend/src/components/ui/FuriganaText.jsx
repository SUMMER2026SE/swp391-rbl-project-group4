import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';

// Allow only ruby/rt/rb/rp and text — strip everything else
function sanitizeRuby(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(?!\/?(?:ruby|rt|rb|rp)\b)[^>]*>/gi, '');
}

// Has kanji?
const hasKanji = (t) => /[一-鿿㐀-䶿]/.test(t);

/**
 * FuriganaText — renders Japanese text with optional ruby furigana.
 *
 * Modes:
 *  - Uncontrolled (no `enabled` prop): renders its own toggle button.
 *  - Controlled (`enabled` prop provided): parent manages the toggle; no button rendered.
 *
 * Props:
 *  text         — plain Japanese string
 *  enabled      — (optional) controlled boolean; when true, furigana is shown
 *  className    — wrapper span class
 *  textClassName — class applied to the text span/p
 *  block        — if true, uses <p> instead of <span> for text
 */
export default function FuriganaText({ text, enabled: externalEnabled, className = '', textClassName = '', block = false }) {
  const isControlled = externalEnabled !== undefined;
  const [active, setActive]   = useState(false);
  const [loading, setLoading] = useState(false);
  const htmlRef = useRef(null);   // cached annotated HTML
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Which flag drives display
  const show = isControlled ? externalEnabled : active;

  useEffect(() => {
    if (!show || htmlRef.current || loading) return;
    if (!hasKanji(text)) { htmlRef.current = text; return; }

    setLoading(true);
    api.post('/ai/furigana', { text })
      .then(r => { if (mountedRef.current) htmlRef.current = sanitizeRuby(r.data.html || text); })
      .catch(() => { if (mountedRef.current) htmlRef.current = text; })
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [show, text]);

  const Tag = block ? 'p' : 'span';
  const displayed = show && htmlRef.current && !loading;

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      {displayed ? (
        <Tag
          className={`leading-[2.8] ${textClassName}`}
          dangerouslySetInnerHTML={{ __html: htmlRef.current }}
        />
      ) : (
        <Tag className={`leading-relaxed ${textClassName}`}>
          {loading && show
            ? <span className="flex items-center gap-1.5 text-on-muted"><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>{text}</span>
            : text
          }
        </Tag>
      )}

      {/* Toggle button — only in uncontrolled mode */}
      {!isControlled && (
        <button
          type="button"
          onClick={() => setActive(v => !v)}
          title={active ? 'Ẩn furigana' : 'Hiển thị furigana (ふりがな)'}
          className={`self-start inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all select-none ${
            loading
              ? 'bg-surface-low border-outline text-on-muted cursor-wait'
              : active
              ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-50'
              : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
          }`}
        >
          <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
          {loading ? 'loading...' : active ? 'ふりがな ✓' : 'ふりがな'}
        </button>
      )}
    </span>
  );
}
