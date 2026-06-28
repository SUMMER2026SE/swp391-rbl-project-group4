import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const KANJI_RE = /[一-龯㐀-䶿]/g;

// ── Canvas vẽ/tô 1 chữ kanji (米字格 + chữ mờ để tô) ─────────────────────────
function KanjiCanvas({ char, showGuide, brush }) {
  const SIZE = 320;
  const canvasRef = useRef(null);
  const strokes   = useRef([]);   // các nét đã vẽ xong
  const cur       = useRef(null); // nét đang vẽ
  const drawing   = useRef(false);
  const [count, setCount] = useState(0); // để re-render nút undo

  const styleCtx = (ctx) => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = brush; };
  const redraw = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    styleCtx(ctx);
    for (const st of strokes.current) {
      if (st.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(st[0].x, st[0].y);
      for (const p of st.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }, [brush]);

  // đổi chữ → xóa nét cũ
  useEffect(() => { strokes.current = []; cur.current = null; setCount(0); redraw(); }, [char, redraw]);
  useEffect(() => { redraw(); }, [brush, redraw]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (SIZE / r.width), y: (e.clientY - r.top) * (SIZE / r.height) };
  };
  const down = (e) => { drawing.current = true; cur.current = [pos(e)]; canvasRef.current.setPointerCapture(e.pointerId); };
  const move = (e) => {
    if (!drawing.current) return;
    const p = pos(e), pts = cur.current;
    const ctx = canvasRef.current.getContext('2d'); styleCtx(ctx);
    ctx.beginPath(); ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.lineTo(p.x, p.y); ctx.stroke();
    pts.push(p);
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; if (cur.current.length > 1) { strokes.current.push(cur.current); setCount(c => c + 1); } cur.current = null; };

  const clear = () => { strokes.current = []; setCount(0); redraw(); };
  const undo  = () => { strokes.current.pop(); setCount(c => Math.max(0, c - 1)); redraw(); };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-2xl border-2 border-charcoal/40 bg-white" style={{ width: SIZE, height: SIZE }}>
        {/* đường gióng 米字格 */}
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-charcoal/20" />
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-charcoal/20" />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(45deg, transparent 49.6%, rgba(0,0,0,0.08) 49.6%, rgba(0,0,0,0.08) 50.4%, transparent 50.4%), linear-gradient(-45deg, transparent 49.6%, rgba(0,0,0,0.08) 49.6%, rgba(0,0,0,0.08) 50.4%, transparent 50.4%)' }} />
        {/* chữ mờ để tô */}
        {showGuide && char && (
          <span className="absolute inset-0 flex items-center justify-center leading-none select-none pointer-events-none"
            style={{ fontSize: SIZE * 0.74, color: 'rgba(0,0,0,0.14)', fontFamily: "'Noto Sans JP','Yu Mincho',serif" }}>{char}</span>
        )}
        {/* canvas vẽ */}
        <canvas ref={canvasRef} width={SIZE} height={SIZE}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair" style={{ touchAction: 'none' }} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={undo} disabled={count === 0}>
          <span className="material-symbols-outlined text-lg">undo</span> Hoàn tác
        </Button>
        <Button variant="secondary" onClick={clear} disabled={count === 0}>
          <span className="material-symbols-outlined text-lg">ink_eraser</span> Xóa hết
        </Button>
      </div>
    </div>
  );
}

export default function KanjiWriting() {
  const [list, setList]     = useState([]); // [{char, reading_on, reading_kun, meaning_vi}]
  const [idx, setIdx]       = useState(0);
  const [typed, setTyped]   = useState('');
  const [level, setLevel]   = useState('N5');
  const [browse, setBrowse] = useState([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [brush, setBrush]   = useState(14);

  const has = (c) => list.some(k => k.char === c);
  const addKanji = (k) => { if (!has(k.char)) { setList(l => [...l, k]); } };
  const addTyped = () => {
    const chars = [...new Set((typed.match(KANJI_RE) || []))].filter(c => !has(c));
    if (chars.length) setList(l => [...l, ...chars.map(c => ({ char: c, reading_on: [], reading_kun: [], meaning_vi: '' }))]);
    setTyped('');
  };
  const removeAt = (i) => { setList(l => l.filter((_, j) => j !== i)); setIdx(p => (i <= p && p > 0 ? p - 1 : p)); };

  const loadBrowse = async () => {
    setLoadingBrowse(true);
    try { const r = await api.get(`/kanji?level=${level}&limit=80`); setBrowse(r.data?.data || []); }
    catch { setBrowse([]); } finally { setLoadingBrowse(false); }
  };

  const current = list[idx];

  return (
    <StudentLayout title="Luyện viết Kanji">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Luyện viết Kanji</h1>
          <p className="text-sm text-on-muted">Chọn kanji rồi <strong>vẽ trực tiếp</strong> lên khung để luyện viết tay.</p>
        </div>
        <Link to="/kanji" className="text-sm text-on-muted hover:text-tsubaki-red inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-base">arrow_back</span> Kanji
        </Link>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        {/* ── Cột chọn kanji ── */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-semibold mb-2">Nhập kanji</label>
            <div className="flex gap-2">
              <input value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTyped()}
                placeholder="VD: 水火木" className="flex-1 px-3 py-2 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red" />
              <Button onClick={addTyped} disabled={!typed.trim()}>Thêm</Button>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-semibold mb-2">Chọn từ thư viện</label>
            <div className="flex gap-2">
              <select value={level} onChange={e => setLevel(e.target.value)} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
              <Button variant="secondary" onClick={loadBrowse} loading={loadingBrowse}>Tải {level}</Button>
            </div>
            {browse.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-44 overflow-y-auto">
                {browse.map(k => (
                  <button key={k.id} onClick={() => addKanji({ char: k.character, reading_on: k.reading_on, reading_kun: k.reading_kun, meaning_vi: k.meaning_vi })}
                    disabled={has(k.character)}
                    className={`w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-colors ${has(k.character) ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-outline hover:border-tsubaki-red hover:bg-tsubaki-red/5'}`}>
                    {k.character}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* danh sách đã chọn */}
          {list.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <p className="text-sm font-semibold mb-2">Đã chọn ({list.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((k, i) => (
                  <div key={i} className="relative group">
                    <button onClick={() => setIdx(i)}
                      className={`w-10 h-10 rounded-lg border text-xl flex items-center justify-center ${i === idx ? 'border-tsubaki-red bg-tsubaki-red/10 text-tsubaki-red' : 'border-outline hover:bg-surface-low'}`}>
                      {k.char}
                    </button>
                    <button onClick={() => removeAt(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Khu vực vẽ ── */}
        <div className="glass-card rounded-2xl p-6">
          {!current ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">draw</span>
              <p className="font-bold text-lg mb-1">Chưa chọn kanji nào</p>
              <p className="text-on-muted text-sm">Gõ kanji hoặc chọn từ thư viện bên trái để bắt đầu vẽ.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* thông tin chữ */}
              <div className="text-center mb-3">
                <p className="text-xs text-on-muted flex flex-wrap justify-center gap-x-3">
                  {current.reading_on?.length > 0 && <span>On: <b className="text-charcoal">{current.reading_on.join('、')}</b></span>}
                  {current.reading_kun?.length > 0 && <span>Kun: <b className="text-charcoal">{current.reading_kun.join('、')}</b></span>}
                  {current.meaning_vi && <span>Nghĩa: <b className="text-charcoal">{current.meaning_vi}</b></span>}
                </p>
              </div>

              <KanjiCanvas char={current.char} showGuide={showGuide} brush={brush} />

              {/* tùy chọn + điều hướng */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={showGuide} onChange={e => setShowGuide(e.target.checked)} className="accent-tsubaki-red" /> Chữ mờ để tô
                </label>
                <label className="flex items-center gap-2 text-sm">Cỡ nét
                  <input type="range" min="6" max="28" value={brush} onChange={e => setBrush(Number(e.target.value))} className="accent-tsubaki-red" />
                </label>
              </div>
              {list.length > 1 && (
                <div className="flex items-center gap-4 mt-4">
                  <Button variant="secondary" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>← Trước</Button>
                  <span className="text-sm text-on-muted">{idx + 1}/{list.length}</span>
                  <Button variant="secondary" onClick={() => setIdx(i => Math.min(list.length - 1, i + 1))} disabled={idx === list.length - 1}>Sau →</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}
