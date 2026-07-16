import { useEffect, useMemo, useRef, useState } from 'react';
import FuriganaText from '../ui/FuriganaText';

// ── SyncedVideoTranscript ─────────────────────────────────────────────────────
// Video bài học + panel "Bản chép" đồng bộ thời gian (pattern SyncedTranscriptPlayer
// của Listening, mở rộng cho video upload lẫn YouTube).
// segments: [{ start, end, parts: [{ lang: 'ja'|'vi'|'en', text }] }]
// Dòng đang phát tự highlight + auto-scroll; click dòng → tua video tới start.
// YouTube không có event timeupdate → dùng IFrame API, poll getCurrentTime ~250ms.

const YT_ID_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/;

let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return ytApiPromise;
}

const LANG_META = {
  ja: { label: '日', badge: 'bg-tsubaki-red/10 text-tsubaki-red' },
  vi: { label: 'VI', badge: 'bg-blue-100 text-blue-700' },
  en: { label: 'EN', badge: 'bg-sumire-purple/10 text-sumire-purple' },
};

export default function SyncedVideoTranscript({ videoUrl, segments, title }) {
  const ytId = useMemo(() => videoUrl?.match(YT_ID_RE)?.[1] || null, [videoUrl]);
  const videoRef  = useRef(null);   // <video> native
  const ytHostRef = useRef(null);   // div chứa YT.Player
  const ytPlayerRef = useRef(null);
  const activeRef = useRef(null);
  const listRef   = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [furigana, setFurigana] = useState(false);
  const [langShow, setLangShow] = useState({ ja: true, vi: true, en: true });

  const safeSegments = Array.isArray(segments) ? segments : [];

  // ── YouTube: dựng player + poll thời gian ────────────────────────────────
  useEffect(() => {
    if (!ytId || !ytHostRef.current) return;
    let interval = null;
    let destroyed = false;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !ytHostRef.current) return;
      ytPlayerRef.current = new YT.Player(ytHostRef.current, {
        videoId: ytId,
        playerVars: { enablejsapi: 1, rel: 0 },
        events: {
          onReady: () => {
            interval = setInterval(() => {
              const p = ytPlayerRef.current;
              if (p?.getCurrentTime) setCurrentTime(p.getCurrentTime());
            }, 250);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      if (interval) clearInterval(interval);
      try { ytPlayerRef.current?.destroy?.(); } catch { /* đã unmount */ }
      ytPlayerRef.current = null;
    };
  }, [ytId]);

  // ── Dòng active: dòng cuối cùng có start <= currentTime (bỏ highlight khi
  // đã qua end quá 0.5s — khoảng lặng giữa 2 dòng) ─────────────────────────
  const activeIdx = (() => {
    for (let i = safeSegments.length - 1; i >= 0; i--) {
      const start = Number(safeSegments[i].start);
      const end   = Number(safeSegments[i].end);
      if (currentTime >= start) {
        if (currentTime > end + 0.5) return -1;
        return i;
      }
    }
    return -1;
  })();

  useEffect(() => {
    if (!activeRef.current || !listRef.current) return;
    const el = activeRef.current;
    const box = listRef.current;
    if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 2, behavior: 'smooth' });
    }
  }, [activeIdx]);

  const seekTo = (time) => {
    const t = Number(time);
    if (ytId) {
      ytPlayerRef.current?.seekTo?.(t, true);
      ytPlayerRef.current?.playVideo?.();
    } else if (videoRef.current) {
      videoRef.current.currentTime = t;
      videoRef.current.play();
    }
  };

  const toggleLang = (lang) => setLangShow(s => ({ ...s, [lang]: !s[lang] }));

  // Ngôn ngữ thực sự xuất hiện trong segments — chỉ hiện chip toggle cho các ngôn ngữ đó
  const usedLangs = useMemo(() => {
    const set = new Set();
    safeSegments.forEach(seg => (seg.parts || []).forEach(p => set.add(p.lang)));
    return ['ja', 'vi', 'en'].filter(l => set.has(l));
  }, [safeSegments]);

  return (
    <div className="lg:grid lg:grid-cols-5">
      {/* ── Video ─────────────────────────────────────────────────────── */}
      <div className="lg:col-span-3 aspect-video bg-black">
        {ytId
          ? <div ref={ytHostRef} className="w-full h-full" title={title} />
          : <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full"
              onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
            />}
      </div>

      {/* ── Panel Bản chép ────────────────────────────────────────────── */}
      <div className="lg:col-span-2 flex flex-col border-t lg:border-t-0 lg:border-l border-outline/20">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-outline/20 flex-wrap">
          <h3 className="font-display font-bold text-sm tracking-wide">BẢN CHÉP</h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFurigana(v => !v)}
              title={furigana ? 'Ẩn furigana' : 'Hiện furigana'}
              className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all select-none ${
                furigana
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              ふりがな
            </button>
            {usedLangs.map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLang(lang)}
                title={langShow[lang] ? `Ẩn phần ${lang.toUpperCase()}` : `Hiện phần ${lang.toUpperCase()}`}
                className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all select-none ${
                  langShow[lang]
                    ? `border-transparent ${LANG_META[lang].badge}`
                    : 'bg-white border-outline/60 text-on-muted/50 line-through'
                }`}
              >
                {LANG_META[lang].label}
              </button>
            ))}
          </div>
        </div>

        <div ref={listRef} className="overflow-y-auto p-3 space-y-2 max-h-80 lg:max-h-[420px]">
          {safeSegments.map((seg, i) => {
            const isActive = i === activeIdx;
            const parts = (seg.parts || []).filter(p => langShow[p.lang] !== false);
            return (
              <div
                key={i}
                ref={isActive ? activeRef : null}
                onClick={() => seekTo(seg.start)}
                title={`${Number(seg.start).toFixed(1)}s`}
                className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-outline/30 hover:border-blue-200'
                }`}
              >
                <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5 ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-surface-container text-on-muted'
                }`}>
                  #{i + 1}
                </span>
                {parts.length === 0 ? (
                  <p className="text-xs text-on-muted/50 italic">(đã ẩn hết ngôn ngữ của dòng này)</p>
                ) : (
                  <div className="space-y-1">
                    {parts.map((p, j) => (
                      <div key={j} className="flex items-start gap-1.5">
                        <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded mt-0.5 ${LANG_META[p.lang]?.badge || 'bg-surface-container text-on-muted'}`}>
                          {LANG_META[p.lang]?.label || p.lang}
                        </span>
                        {p.lang === 'ja'
                          ? <FuriganaText text={p.text} enabled={furigana} textClassName="text-sm text-on-surface" />
                          : <span className={`text-xs leading-relaxed ${p.lang === 'vi' ? 'text-on-muted italic' : 'text-on-muted'}`}>{p.text}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
