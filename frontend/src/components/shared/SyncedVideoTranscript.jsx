import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import FuriganaText from '../ui/FuriganaText';
import { YT_ID_RE, loadYouTubeApi } from '../../lib/youtubePlayer';

// ── SyncedVideoTranscript ─────────────────────────────────────────────────────
// Player học tiếng Nhật: video/audio + điều khiển THEO CÂU + thẻ câu đang phát +
// sidebar "Bản chép" đồng bộ. Dòng đang phát tự sáng + auto-scroll; bấm dòng → tua.
// YouTube dùng IFrame API (poll getCurrentTime); native <video>/<audio> dùng timeupdate.
// segments: [{ start, end, parts: [{ lang:'ja'|'vi'|'en', text }] }]

const SPEEDS = [0.75, 1, 1.25, 1.5];

const GRID_BG = {
  backgroundColor: '#fcfbfd',
  backgroundImage: 'linear-gradient(rgba(174,40,38,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(174,40,38,0.045) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};

export default function SyncedVideoTranscript({ videoUrl, segments, title, audio = false, hideVideo = false, onToggleVideo }) {
  const ytId = useMemo(() => videoUrl?.match(YT_ID_RE)?.[1] || null, [videoUrl]);
  const isYT = !!ytId;
  const videoRef  = useRef(null);   // <video>/<audio> native
  const ytHostRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const activeRef = useRef(null);
  const listRef   = useRef(null);
  const repeatRef = useRef(false);
  const speedRef  = useRef(1);

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [furigana, setFurigana] = useState(false);
  const [showTrans, setShowTrans] = useState(true);
  const [speed, setSpeed]       = useState(1);
  const [repeat, setRepeat]     = useState(false);
  const [marked, setMarked]     = useState(() => new Set());

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  const safeSegments = Array.isArray(segments) ? segments : [];

  // ── Câu đang phát (start<=t<=end, kèm khoảng lặng) & câu gần nhất đã bắt đầu ──
  const activeIdx = (() => {
    for (let i = safeSegments.length - 1; i >= 0; i--) {
      if (currentTime >= Number(safeSegments[i].start)) {
        return currentTime > Number(safeSegments[i].end) + 0.5 ? -1 : i;
      }
    }
    return -1;
  })();
  const captionIdx = (() => {
    for (let i = safeSegments.length - 1; i >= 0; i--) {
      if (currentTime >= Number(safeSegments[i].start)) return i;
    }
    return -1;
  })();
  const curIdx = captionIdx >= 0 ? captionIdx : 0;

  // ── Tua ─────────────────────────────────────────────────────────────────────
  const doSeek = useCallback((t) => {
    const time = Number(t);
    if (isYT) { ytPlayerRef.current?.seekTo?.(time, true); ytPlayerRef.current?.playVideo?.(); }
    else if (videoRef.current) { videoRef.current.currentTime = time; videoRef.current.play(); }
  }, [isYT]);

  // Lặp câu: khi vượt cuối câu đang phát mà repeat bật → tua về đầu câu.
  const onTick = useCallback((t) => {
    setCurrentTime(t);
    if (!repeatRef.current) return;
    let i = -1;
    for (let k = safeSegments.length - 1; k >= 0; k--) { if (t >= Number(safeSegments[k].start)) { i = k; break; } }
    if (i >= 0 && t > Number(safeSegments[i].end) + 0.15) doSeek(safeSegments[i].start);
  }, [safeSegments, doSeek]);

  // ── YouTube player ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isYT || !ytHostRef.current) return;
    let interval = null, destroyed = false;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !ytHostRef.current) return;
      ytPlayerRef.current = new YT.Player(ytHostRef.current, {
        videoId: ytId,
        playerVars: { enablejsapi: 1, rel: 0 },
        events: {
          onReady: () => {
            ytPlayerRef.current?.setPlaybackRate?.(speedRef.current);
            interval = setInterval(() => {
              const p = ytPlayerRef.current;
              if (p?.getCurrentTime) onTick(p.getCurrentTime());
            }, 200);
          },
          onStateChange: (e) => setPlaying(e.data === 1),   // 1 = PLAYING
        },
      });
    });
    return () => {
      destroyed = true;
      if (interval) clearInterval(interval);
      try { ytPlayerRef.current?.destroy?.(); } catch { /* unmounted */ }
      ytPlayerRef.current = null;
    };
  }, [ytId, isYT, onTick]);

  // ── Auto-scroll dòng active ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeRef.current || !listRef.current) return;
    const el = activeRef.current, box = listRef.current;
    if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 2, behavior: 'smooth' });
    }
  }, [activeIdx]);

  // ── Điều khiển ────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (isYT) { const p = ytPlayerRef.current; if (!p) return; playing ? p.pauseVideo?.() : p.playVideo?.(); }
    else if (videoRef.current) { playing ? videoRef.current.pause() : videoRef.current.play(); }
  }, [isYT, playing]);
  const prevSentence = useCallback(() => { const i = Math.max(0, curIdx - 1); if (safeSegments[i]) doSeek(safeSegments[i].start); }, [curIdx, safeSegments, doSeek]);
  const nextSentence = useCallback(() => { const i = Math.min(safeSegments.length - 1, curIdx + 1); if (safeSegments[i]) doSeek(safeSegments[i].start); }, [curIdx, safeSegments, doSeek]);
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next); speedRef.current = next;
    if (isYT) ytPlayerRef.current?.setPlaybackRate?.(next);
    else if (videoRef.current) videoRef.current.playbackRate = next;
  };
  const toggleMark = (i) => setMarked(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  // ── Phím tắt: Space=play/pause, ←/→=câu, R=lặp (bỏ qua khi đang gõ input) ──
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowLeft')  { e.preventDefault(); prevSentence(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); nextSentence(); }
      else if (e.code === 'KeyR')       { setRepeat(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, prevSentence, nextSentence]);

  // Ngôn ngữ dịch thực sự có trong segments (ja luôn có; vi/en tuỳ nội dung)
  const hasTrans = useMemo(() =>
    safeSegments.some(seg => (seg.parts || []).some(p => p.lang !== 'ja')), [safeSegments]);

  const jaPart = (seg) => (seg?.parts || []).find(p => p.lang === 'ja') || (seg?.parts || [])[0];
  const jaOf   = (seg) => jaPart(seg)?.text || '';
  const furiganaOf = (seg) => jaPart(seg)?.furigana;   // ruby HTML dựng sẵn → hiện tức thì
  const transOf = (seg) => (seg?.parts || []).filter(p => p.lang !== 'ja');

  const capSeg = captionIdx >= 0 ? safeSegments[captionIdx] : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={GRID_BG}>
      <div className="lg:grid lg:grid-cols-5">
        {/* ── Cột trái: video + điều khiển + câu đang phát ──────────────── */}
        <div className="lg:col-span-3 flex flex-col p-3 sm:p-4 gap-3">
          {/* Player */}
          <div className={hideVideo ? 'h-0 overflow-hidden' : ''}>
            {audio && !isYT ? (
              <div className="rounded-2xl bg-charcoal/90 px-5 py-8 flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-5xl text-white/80">graphic_eq</span>
                <audio ref={videoRef} src={videoUrl} className="w-full max-w-md"
                  onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                  onTimeUpdate={e => onTick(e.target.currentTime)} controls />
              </div>
            ) : (
              <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                {isYT
                  ? <div ref={ytHostRef} className="w-full h-full" title={title} />
                  : <video ref={videoRef} src={videoUrl} controls className="w-full h-full"
                      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                      onTimeUpdate={e => onTick(e.target.currentTime)} />}
              </div>
            )}
          </div>

          {/* Thanh điều khiển theo câu */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CtrlBtn icon="skip_previous" title="Câu trước (←)" onClick={prevSentence} />
              <CtrlBtn icon="repeat" title="Lặp câu (R)" active={repeat} onClick={() => setRepeat(v => !v)} />
              <button onClick={togglePlay} title="Phát/Dừng (Space)"
                className="w-12 h-12 rounded-full bg-tsubaki-red text-white flex items-center justify-center shadow hover:shadow-lg active:scale-95 transition-all">
                <span className="material-symbols-outlined text-3xl">{playing ? 'pause' : 'play_arrow'}</span>
              </button>
              <CtrlBtn icon="skip_next" title="Câu sau (→)" onClick={nextSentence} />
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {hasTrans && <TogglePill active={showTrans} onClick={() => setShowTrans(v => !v)} icon="translate">Bản dịch</TogglePill>}
              <TogglePill active={furigana} onClick={() => setFurigana(v => !v)}>ふりがな</TogglePill>
              <button onClick={cycleSpeed} title="Tốc độ phát"
                className="px-2.5 h-8 rounded-lg border border-outline/60 text-xs font-bold text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">
                {speed}×
              </button>
            </div>
          </div>

          {/* Thẻ câu đang phát */}
          <div
            onClick={() => capSeg && doSeek(capSeg.start)}
            title={capSeg ? 'Bấm để phát lại câu này' : undefined}
            className={`min-h-[6.5rem] rounded-2xl bg-white border border-outline/20 shadow-sm px-6 py-5 flex flex-col items-center justify-center gap-2 text-center ${capSeg ? 'cursor-pointer' : ''}`}
          >
            {!capSeg ? (
              <p className="text-sm text-on-muted/50 italic">Phát video để hiện câu đang nói tại đây</p>
            ) : (
              <>
                <FuriganaText text={jaOf(capSeg)} html={furiganaOf(capSeg)} enabled={furigana}
                  textClassName="text-2xl sm:text-[26px] font-bold text-on-surface" block />
                {showTrans && transOf(capSeg).map((p, j) => (
                  <p key={j} className="text-sm text-on-muted italic">{p.text}</p>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Cột phải: BẢN CHÉP ────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col border-t lg:border-t-0 lg:border-l border-outline/15 bg-white/60 lg:min-h-[460px]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-outline/15">
            <h3 className="font-display font-bold text-sm tracking-wide">BẢN CHÉP</h3>
            <div className="flex items-center gap-1.5">
              <MiniToggle active={furigana} onClick={() => setFurigana(v => !v)} icon="visibility" label="Furigana" />
              {hasTrans && <MiniToggle active={showTrans} onClick={() => setShowTrans(v => !v)} icon="translate" label="Dịch" />}
              {onToggleVideo && (
                <button onClick={onToggleVideo} title={hideVideo ? 'Hiện video' : 'Ẩn video, tập trung bản chép'}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/5 transition-colors">
                  <span className="material-symbols-outlined text-base">{hideVideo ? 'open_in_full' : 'close_fullscreen'}</span>
                </button>
              )}
            </div>
          </div>

          <div ref={listRef} className="overflow-y-auto p-3 space-y-2 max-h-96 lg:max-h-none lg:flex-1 lg:min-h-0">
            {safeSegments.length === 0 ? (
              <p className="text-sm text-on-muted/60 text-center py-8">Chưa có bản chép.</p>
            ) : safeSegments.map((seg, i) => {
              const isActive = i === activeIdx;
              const trans = transOf(seg);
              return (
                <div key={i} ref={isActive ? activeRef : null}
                  onClick={() => doSeek(seg.start)}
                  className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                    isActive ? 'bg-tsubaki-red/5 border-tsubaki-red/40' : 'bg-white border-outline/25 hover:border-tsubaki-red/25'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-tsubaki-red text-white' : 'bg-surface-container text-on-muted'}`}>#{i + 1}</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleMark(i); }} title="Đánh dấu để soát lại"
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        marked.has(i) ? 'text-tsubaki-red' : 'text-on-muted/40 hover:text-tsubaki-red'}`}>
                      <span className="material-symbols-outlined text-base" style={marked.has(i) ? { fontVariationSettings: "'FILL' 1" } : undefined}>flag</span>
                    </button>
                  </div>
                  <FuriganaText text={jaOf(seg)} html={furiganaOf(seg)} enabled={furigana}
                    textClassName={`text-base ${isActive ? 'text-on-surface font-semibold' : 'text-on-surface'}`} block />
                  {showTrans && trans.map((p, j) => (
                    <p key={j} className="text-xs text-on-muted italic mt-0.5">{p.text}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CtrlBtn({ icon, title, onClick, active }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
        active ? 'bg-tsubaki-red/10 text-tsubaki-red' : 'text-on-muted hover:bg-tsubaki-red/10 hover:text-tsubaki-red'}`}>
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </button>
  );
}

function TogglePill({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 h-8 rounded-lg border transition-all select-none ${
        active ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'bg-white border-outline/60 text-on-muted hover:border-tsubaki-red'}`}>
      {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
      {children}
    </button>
  );
}

function MiniToggle({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} title={active ? `Ẩn ${label}` : `Hiện ${label}`}
      className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 h-7 rounded-lg transition-colors ${
        active ? 'text-tsubaki-red' : 'text-on-muted/60 hover:text-tsubaki-red'}`}>
      <span className="material-symbols-outlined text-sm">{icon}</span>{label}
    </button>
  );
}
