import { useCallback, useRef, useState } from 'react';
import Button from '../ui/Button';
import KanjiCanvas from './KanjiCanvas';
import api from '../../lib/api';

// Modal luyện viết kanji + chấm điểm AI — dùng chung cho bài đăng (Study List)
// và mục kanji trong bài học của khóa học.
// `items`: [{ character, reading_on, reading_kun, meaning_vi }] — field gốc là
// `character`, component tự map sang `char` cho hàng đợi nội bộ.
// Parent mount/unmount có điều kiện ({open && <KanjiWritingPracticeModal/>})
// để state tự reset mỗi lần mở.

const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#ae2826';
const scoreBg    = (s) => s >= 80 ? '#f0fdf4' : s >= 50 ? '#fffbeb' : '#fdf2f2';

export default function KanjiWritingPracticeModal({ items, startIndex = 0, onClose }) {
  const canvasRef = useRef(null);
  const [queue, setQueue] = useState(() => (items || []).map(item => ({
    char: item.character,
    reading_on:  item.reading_on  || [],
    reading_kun: item.reading_kun || [],
    meaning_vi:  item.meaning_vi  || '',
  })));
  const [idx,         setIdx]         = useState(startIndex);
  const [showGuide,   setShowGuide]   = useState(true);
  const [brush,       setBrush]       = useState(14);
  const [strokeCount, setStrokeCount] = useState(0);
  const [scoring,     setScoring]     = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [scoreErr,    setScoreErr]    = useState('');

  const removeFromQueue = (i) => {
    setScoreResult(null);
    setScoreErr('');
    setQueue(q => {
      const next = q.filter((_, j) => j !== i);
      setIdx(cur => i < cur ? cur - 1 : i === cur ? Math.min(cur, next.length - 1) : cur);
      return next;
    });
  };

  const handleWriteCount = useCallback((c) => {
    setStrokeCount(c);
    setScoreResult(null);
    setScoreErr('');
  }, []);

  const handleWriteScore = async () => {
    const img = canvasRef.current?.getImage();
    if (!img || !queue[idx]) return;
    setScoring(true); setScoreErr(''); setScoreResult(null);
    try {
      const r = await api.post('/kanji/score-writing', { image: img, character: queue[idx].char });
      setScoreResult(r.data);
    } catch (e) { setScoreErr(e.response?.data?.error || 'Không chấm được, thử lại.'); }
    finally { setScoring(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/40 shrink-0">
          <h2 className="font-display font-bold text-lg">Luyện viết Kanji</h2>
          <button onClick={onClose} className="text-on-muted hover:text-charcoal">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Queue chips */}
          {queue.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {queue.map((k, i) => (
                <div key={i} className="relative group">
                  <button
                    onClick={() => { setIdx(i); setScoreResult(null); setScoreErr(''); }}
                    className={`w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-all ${i === idx ? 'border-tsubaki-red bg-tsubaki-red/10 text-tsubaki-red ring-2 ring-tsubaki-red/20' : 'border-outline hover:bg-surface-low'}`}>
                    {k.char}
                  </button>
                  <button
                    onClick={() => removeFromQueue(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {queue.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">check_circle</span>
              <p className="font-semibold mb-1">Đã bỏ qua hết!</p>
              <p className="text-on-muted text-sm">Không còn kanji nào trong danh sách.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-on-muted flex flex-wrap justify-center gap-x-3 min-h-[1rem]">
                {queue[idx]?.reading_on?.length > 0 && <span>On: <b className="text-charcoal">{queue[idx].reading_on.join('、')}</b></span>}
                {queue[idx]?.reading_kun?.length > 0 && <span>Kun: <b className="text-charcoal">{queue[idx].reading_kun.join('、')}</b></span>}
                {queue[idx]?.meaning_vi && <span>Nghĩa: <b className="text-charcoal">{queue[idx].meaning_vi}</b></span>}
              </p>

              <div className="flex justify-center">
                <KanjiCanvas ref={canvasRef} char={queue[idx]?.char} showGuide={showGuide} brush={brush} onCount={handleWriteCount} />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={showGuide} onChange={e => setShowGuide(e.target.checked)} className="accent-tsubaki-red" /> Chữ mờ
                </label>
                <label className="flex items-center gap-2 text-sm">Cỡ nét
                  <input type="range" min="6" max="28" value={brush} onChange={e => setBrush(Number(e.target.value))} className="accent-tsubaki-red w-24" />
                </label>
              </div>

              <div className="flex flex-col items-center gap-2">
                <Button onClick={handleWriteScore} loading={scoring} disabled={strokeCount === 0}>
                  <span className="material-symbols-outlined text-lg">auto_awesome</span> Chấm điểm AI
                </Button>
                {strokeCount === 0 && !scoreResult && <p className="text-xs text-on-muted">Vẽ chữ trước rồi bấm chấm điểm.</p>}
              </div>

              {scoreErr && <p className="text-sm text-tsubaki-red text-center">{scoreErr}</p>}

              {scoreResult && (
                <div className="rounded-2xl border p-4"
                  style={{ borderColor: scoreResult.similarity != null ? scoreColor(scoreResult.similarity) + '44' : '#e5e7eb', background: scoreResult.similarity != null ? scoreBg(scoreResult.similarity) : '#f9fafb' }}>
                  {scoreResult.similarity != null && (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-sm text-on-muted">Độ giống</span>
                      <span className="text-4xl font-display font-bold" style={{ color: scoreColor(scoreResult.similarity) }}>{scoreResult.similarity}%</span>
                    </div>
                  )}
                  {scoreResult.comment && <p className="text-sm text-center text-charcoal mb-2">{scoreResult.comment}</p>}
                  {scoreResult.errors?.length > 0 && (
                    <ul className="space-y-1 mt-1">
                      {scoreResult.errors.map((e, i) => (
                        <li key={i} className="text-sm text-charcoal flex gap-1.5">
                          <span className="material-symbols-outlined text-base text-tsubaki-red shrink-0">close</span>{e}
                        </li>
                      ))}
                    </ul>
                  )}
                  {scoreResult.similarity != null && !scoreResult.errors?.length && (
                    <p className="text-sm text-center text-emerald-600 flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-lg">check_circle</span> Viết tốt, không có lỗi!
                    </p>
                  )}
                </div>
              )}

              {queue.length > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <Button variant="secondary" onClick={() => { setIdx(i => Math.max(0, i - 1)); setScoreResult(null); setScoreErr(''); }} disabled={idx === 0}>← Trước</Button>
                  <span className="text-sm text-on-muted">{idx + 1}/{queue.length}</span>
                  <Button variant="secondary" onClick={() => { setIdx(i => Math.min(queue.length - 1, i + 1)); setScoreResult(null); setScoreErr(''); }} disabled={idx === queue.length - 1}>Sau →</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
