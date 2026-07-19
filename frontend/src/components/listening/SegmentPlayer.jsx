import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { youtubeId, loadYouTubeApi } from '../../lib/youtubePlayer';

// Phát audio THEO ĐOẠN cho cả nguồn audio/video (thẻ <audio>) lẫn YouTube (IFrame API).
// Phơi ra playSegment(start, end) + stop() qua ref.
//  - cover: phủ lớp mờ lên player YouTube (dùng cho Chép chính tả để không lộ chữ).
const SegmentPlayer = forwardRef(function SegmentPlayer({ audioUrl, youtubeUrl, cover = false }, ref) {
  const ytId = youtubeId(youtubeUrl);
  const isYT = !!ytId;
  const audioRef  = useRef(null);
  const ytHostRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const timerRef  = useRef(null);
  const audioStopRef = useRef(null);

  // Mount YouTube player (khung nhỏ nhưng KÍCH THƯỚC THẬT để phát đáng tin cậy).
  useEffect(() => {
    if (!isYT || !ytHostRef.current) return;
    let destroyed = false;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !ytHostRef.current) return;
      ytPlayerRef.current = new YT.Player(ytHostRef.current, {
        videoId: ytId,
        playerVars: { enablejsapi: 1, rel: 0, controls: 0, modestbranding: 1 },
      });
    });
    return () => {
      destroyed = true;
      if (timerRef.current) clearInterval(timerRef.current);
      try { ytPlayerRef.current?.destroy?.(); } catch { /* unmounted */ }
      ytPlayerRef.current = null;
    };
  }, [ytId, isYT]);

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (isYT) { try { ytPlayerRef.current?.pauseVideo?.(); } catch { /* chưa sẵn sàng */ } }
    else if (audioRef.current) {
      audioRef.current.pause();
      if (audioStopRef.current) { audioRef.current.removeEventListener('timeupdate', audioStopRef.current); audioStopRef.current = null; }
    }
  };

  useImperativeHandle(ref, () => ({
    playSegment(start, end) {
      stop();
      if (isYT) {
        const p = ytPlayerRef.current;
        if (!p?.seekTo) return;
        p.seekTo(start, true); p.playVideo();
        timerRef.current = setInterval(() => {
          const t = p.getCurrentTime?.();
          if (t != null && t >= end) { p.pauseVideo(); clearInterval(timerRef.current); timerRef.current = null; }
        }, 120);
      } else {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = start; el.play();
        const check = () => { if (el.currentTime >= end) { el.pause(); el.removeEventListener('timeupdate', check); audioStopRef.current = null; } };
        audioStopRef.current = check;
        el.addEventListener('timeupdate', check);
      }
    },
    stop,
  }), [isYT]);

  useEffect(() => () => stop(), []); // dọn khi unmount

  if (isYT) {
    return (
      <div className="relative rounded-xl overflow-hidden w-full max-w-xs aspect-video bg-black">
        <div ref={ytHostRef} className="w-full h-full" />
        {cover && (
          <div className="absolute inset-0 bg-charcoal/95 flex flex-col items-center justify-center gap-1 text-white/80">
            <span className="material-symbols-outlined text-3xl">headphones</span>
            <span className="text-xs">Nghe và chép — không xem hình</span>
          </div>
        )}
      </div>
    );
  }
  return <audio ref={audioRef} src={audioUrl} className="hidden" />;
});

export default SegmentPlayer;
