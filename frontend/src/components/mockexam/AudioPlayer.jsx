import { useRef, useState, useEffect } from 'react';
import { formatDuration } from '../../lib/mockExamConstants';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * Trình phát audio cho phần Nghe: nghe lại không giới hạn,
 * play/pause, tua theo thanh seek, lùi/tiến 5s, chỉnh tốc độ.
 */
export default function AudioPlayer({ src, label }) {
  const audioRef = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed]       = useState(1);

  useEffect(() => { setCurrent(0); setPlaying(false); setSpeed(1); }, [src]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play();
  };

  const seekBy = (delta) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.min(Math.max(0, a.currentTime + delta), a.duration || 0);
  };

  const seekTo = (e) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
    setCurrent(a.currentTime);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  if (!src) return null;

  return (
    <div className="bg-surface-low border border-outline/50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-11 h-11 shrink-0 rounded-full bg-tsubaki-red text-white flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-charcoal truncate">{label || 'Đoạn ghi âm'}</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={seekTo}
              className="flex-1 h-1.5 accent-tsubaki-red cursor-pointer"
            />
            <span className="text-[11px] text-on-muted tabular-nums shrink-0">
              {formatDuration(current)} / {formatDuration(duration)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => seekBy(-5)} title="Lùi 5 giây"
            className="w-8 h-8 rounded-full text-on-muted hover:bg-outline/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">replay_5</span>
          </button>
          <button type="button" onClick={() => seekBy(5)} title="Tiến 5 giây"
            className="w-8 h-8 rounded-full text-on-muted hover:bg-outline/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">forward_5</span>
          </button>
          <button type="button" onClick={cycleSpeed} title="Tốc độ phát"
            className={`h-8 px-2 rounded-lg text-xs font-bold tabular-nums ${speed !== 1 ? 'bg-tsubaki-red/10 text-tsubaki-red' : 'text-on-muted hover:bg-outline/30'}`}>
            {speed}×
          </button>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={e => setCurrent(e.target.currentTime)}
        onLoadedMetadata={e => setDuration(e.target.duration || 0)}
      />
    </div>
  );
}
