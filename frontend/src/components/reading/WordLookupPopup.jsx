import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

const JP_REGEX = /[぀-ヿ぀-ゟ゠-ヿ一-龯々ー]/;
const MAX_LEN  = 15;

// Có ít nhất 1 ký tự tiếng Nhật + độ dài hợp lý → mới coi là "từ" đáng tra
function isLookupCandidate(text) {
  const t = (text || '').trim();
  return t.length >= 1 && t.length <= MAX_LEN && JP_REGEX.test(t);
}

/**
 * Popup tra từ điển khi student bôi đen / double-click 1 từ trong vùng đọc.
 * - containerRef: ref tới vùng đọc (chỉ selection nằm trong đây mới kích hoạt).
 * - onAskAI(word): mở chat AI hỏi về từ (dùng khi từ không có trong từ điển).
 * Không tokenize — dựa vào bộ tách từ ICU sẵn có của trình duyệt qua getSelection().
 */
export default function WordLookupPopup({ containerRef, onAskAI }) {
  const navigate = useNavigate();
  const [state, setState] = useState(null); // { x, y, word, loading, entry, notFound }
  const reqIdRef = useRef(0);

  const close = useCallback(() => setState(null), []);

  // Tra từ điển: thử nguyên từ, không thấy thì cắt dần đuôi (xử lý thể chia: 食べました→食べ)
  const lookup = useCallback(async (word, x, y) => {
    const reqId = ++reqIdRef.current;
    setState({ x, y, word, loading: true, entry: null, notFound: false });

    let entry = null;
    let term = word;
    for (let i = 0; i < 6 && term.length >= 1; i++) {
      try {
        const r = await api.get(`/dictionary/search?q=${encodeURIComponent(term)}&limit=1`);
        if (r.data?.data?.length) { entry = r.data.data[0]; break; }
      } catch { /* bỏ qua, thử tiếp bản cắt ngắn */ }
      term = term.slice(0, -1);
    }

    if (reqId !== reqIdRef.current) return; // đã có lượt tra mới hơn → bỏ kết quả cũ
    setState(s => s && { ...s, loading: false, entry, notFound: !entry });
  }, []);

  // Lắng nghe selection trong vùng đọc
  useEffect(() => {
    const onMouseUp = (e) => {
      // Bỏ qua click bên trong chính popup
      if (e.target.closest?.('[data-word-popup]')) return;
      const container = containerRef.current;
      if (!container) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      // Chỉ xử lý khi vùng chọn nằm trong container
      if (!container.contains(range.commonAncestorContainer)) return;
      if (!isLookupCandidate(text)) { close(); return; }

      const rect = range.getBoundingClientRect();
      lookup(text, rect.left + rect.width / 2, rect.bottom);
    };

    const onScroll = () => close();
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [containerRef, lookup, close]);

  if (!state) return null;

  // Định vị: căn giữa dưới selection, kẹp trong viewport
  const width = 280;
  const left = Math.max(12, Math.min(state.x - width / 2, window.innerWidth - width - 12));
  const top  = Math.min(state.y + 8, window.innerHeight - 160);

  return (
    <>
      {/* Lớp phủ bắt click ra ngoài để đóng popup */}
      <div className="fixed inset-0 z-40" onMouseDown={close} />
      <div
        data-word-popup
        style={{ left, top, width }}
        className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-outline/30 p-4 animate-in"
        onMouseDown={e => e.stopPropagation()}
      >
        {state.loading ? (
          <div className="flex items-center gap-2 text-on-muted text-sm py-2">
            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            Đang tra「{state.word}」...
          </div>
        ) : state.entry ? (
          <>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-on-surface leading-tight">
                  {state.entry.kanji || state.entry.kana}
                </p>
                {state.entry.kanji && state.entry.kana && (
                  <p className="text-xs text-on-muted">{state.entry.kana}</p>
                )}
              </div>
              {state.entry.jlpt_level && (
                <span className="shrink-0 text-[10px] font-bold bg-tsubaki-red/10 text-tsubaki-red px-2 py-0.5 rounded-full">
                  {state.entry.jlpt_level}
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-3 line-clamp-3">
              {state.entry.meaning_vi || 'Chưa có nghĩa tiếng Việt.'}
            </p>
            <button
              onClick={() => { close(); navigate(`/dictionary?entry=${state.entry.id}`); }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-tsubaki-red text-white text-sm font-semibold hover:bg-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              Xem chi tiết
            </button>
          </>
        ) : (
          <>
            <p className="font-display text-base font-bold text-on-surface mb-1">「{state.word}」</p>
            <p className="text-sm text-on-muted mb-3">Không tìm thấy trong từ điển.</p>
            {onAskAI && (
              <button
                onClick={() => { close(); onAskAI(state.word); }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sumire-purple text-white text-sm font-semibold hover:opacity-90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                Hỏi trợ lý AI về từ này
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
