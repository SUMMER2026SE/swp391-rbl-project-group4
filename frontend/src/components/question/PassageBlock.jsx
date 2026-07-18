import FuriganaText from '../ui/FuriganaText';

// Renders a frozen passage snapshot (reading or listening) above a question.
// snapshot: { kind:'reading'|'listening', title, content?, image_url?, audio_url?, transcript?, description?, duration_sec? }
export default function PassageBlock({ snapshot, furigana = false, className = '' }) {
  if (!snapshot || !snapshot.kind) return null;

  if (snapshot.kind === 'listening') {
    const fmt = (sec) => { if (!sec) return null; const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };
    return (
      <div className={`bg-sky-50 border border-sky-200 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-sky-100/60 border-b border-sky-200">
          <span className="material-symbols-outlined text-[16px] text-sky-700">headphones</span>
          <span className="text-xs font-bold text-sky-800 uppercase tracking-wide">Bài nghe</span>
          {snapshot.title && <span className="text-xs font-semibold text-sky-700">— {snapshot.title}</span>}
          {fmt(snapshot.duration_sec) && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-sky-200 rounded font-bold text-sky-800">
              <span className="material-symbols-outlined text-[11px]">schedule</span>{fmt(snapshot.duration_sec)}
            </span>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {snapshot.audio_url && (
            <div className="px-4 pt-3"><audio controls src={snapshot.audio_url} className="w-full h-10" /></div>
          )}
          {snapshot.transcript && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">Transcript</p>
              <p className="text-sm text-sky-900 leading-relaxed whitespace-pre-wrap">{snapshot.transcript}</p>
            </div>
          )}
          {snapshot.description && !snapshot.transcript && (
            <div className="px-4 py-3"><p className="text-sm text-sky-900 leading-relaxed">{snapshot.description}</p></div>
          )}
        </div>
      </div>
    );
  }

  // reading
  const hasText = !!snapshot.content;
  const hasImage = !!snapshot.image_url;
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
        <span className="material-symbols-outlined text-[16px] text-amber-700">menu_book</span>
        <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Bài đọc</span>
        {snapshot.title && <span className="text-xs font-semibold text-amber-700">— {snapshot.title}</span>}
      </div>
      <div className="max-h-72 overflow-y-auto">
        {hasImage && (
          <div className="px-4 pt-3">
            <img src={snapshot.image_url} alt="passage" className="w-full rounded-lg max-h-48 object-contain bg-white border border-amber-200" />
          </div>
        )}
        {hasText && (
          <div className="px-4 py-3">
            <FuriganaText text={snapshot.content} enabled={furigana} block
              textClassName="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap" className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

// True when two consecutive questions share the same passage (so we render it once).
export function sameSnapshot(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
