import { useRef, useState, useEffect } from 'react';

/**
 * Trình phát audio cho phần Nghe.
 *  - Chế độ thi (maxPlays): giới hạn số lần phát, không cho tua (mô phỏng thi thật).
 *  - Chế độ review (maxPlays = 0/undefined): phát lại tự do, có thanh tua.
 */
export default function AudioPlayer({ src, maxPlays = 0, label }) {
  const audioRef = useRef(null);
  const [plays, setPlays]     = useState(0);
  const [playing, setPlaying] = useState(false);
  const limited = maxPlays > 0;
  const outOfPlays = limited && plays >= maxPlays;

  useEffect(() => { setPlays(0); }, [src]);

  const handlePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    if (outOfPlays) return;
    a.play();
  };

  if (!src) return null;

  return (
    <div className="flex items-center gap-3 bg-surface-low border border-outline/50 rounded-xl px-4 py-3">
      <button
        type="button"
        onClick={handlePlay}
        disabled={outOfPlays}
        className="w-11 h-11 shrink-0 rounded-full bg-tsubaki-red text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined">{playing ? 'pause' : 'volume_up'}</span>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-charcoal truncate">{label || 'Đoạn ghi âm'}</p>
        {limited ? (
          <p className="text-xs text-on-muted">
            {outOfPlays ? 'Đã hết lượt nghe' : `Còn ${maxPlays - plays}/${maxPlays} lượt nghe · không tua`}
          </p>
        ) : (
          <p className="text-xs text-on-muted">Nghe lại tự do</p>
        )}
      </div>
      <audio
        ref={audioRef}
        src={src}
        controls={!limited}
        className={limited ? 'hidden' : 'max-w-[45%]'}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); if (limited) setPlays(p => p + 1); }}
      />
    </div>
  );
}
