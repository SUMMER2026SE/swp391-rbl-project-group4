import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const KANJI_RE = /[一-龯㐀-䶿]/g;
const SERIF = "'Noto Sans JP','Yu Mincho','Hiragino Mincho Pro',serif";

// ─── Ô luyện viết (CSS-only, dùng trong worksheet) ───────────────────────────
function PracticeBox({ char, opacity = 0, size = 68 }) {
  return (
    <div style={{ position:'relative', width:size, height:size, border:'1px solid #bbb', flexShrink:0, background:'#fff' }}>
      {/* đường gióng chữ thập */}
      <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1,
        background:'repeating-linear-gradient(to bottom,#d0d0d0 0,#d0d0d0 3px,transparent 3px,transparent 7px)' }} />
      <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1,
        background:'repeating-linear-gradient(to right,#d0d0d0 0,#d0d0d0 3px,transparent 3px,transparent 7px)' }} />
      {/* đường chéo mờ */}
      <div style={{ position:'absolute', inset:0, backgroundImage:
        'linear-gradient(45deg,transparent 49.2%,#e8e8e8 49.2%,#e8e8e8 50.8%,transparent 50.8%),' +
        'linear-gradient(-45deg,transparent 49.2%,#e8e8e8 49.2%,#e8e8e8 50.8%,transparent 50.8%)' }} />
      {char && opacity > 0 && (
        <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:size*0.74, fontFamily:SERIF, color:`rgba(0,0,0,${opacity})`,
          userSelect:'none', pointerEvents:'none', lineHeight:1 }}>{char}</span>
      )}
    </div>
  );
}

// ─── Một khối kanji trong worksheet ──────────────────────────────────────────
function WorksheetEntry({ k, boxSize, guideCount }) {
  const REF = boxSize * 1.6;
  const FADE = [0.22, 0.13, 0.07].slice(0, guideCount);
  const empty = Math.max(0, 10 - guideCount);
  return (
    <div style={{ marginBottom:20, pageBreakInside:'avoid', border:'1px solid #ccc', borderRadius:6, overflow:'hidden' }}>
      {/* hàng thông tin */}
      <div style={{ display:'flex', alignItems:'stretch', borderBottom:'1px solid #e0e0e0' }}>
        {/* ô mẫu lớn */}
        <div style={{ position:'relative', width:REF, height:REF, flexShrink:0,
          borderRight:'1px solid #e0e0e0', background:'#fafafa' }}>
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'#ddd' }} />
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'#ddd' }} />
          <div style={{ position:'absolute', inset:0, backgroundImage:
            'linear-gradient(45deg,transparent 49.2%,#ececec 49.2%,#ececec 50.8%,transparent 50.8%),' +
            'linear-gradient(-45deg,transparent 49.2%,#ececec 49.2%,#ececec 50.8%,transparent 50.8%)' }} />
          <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:REF*0.72, fontFamily:SERIF, lineHeight:1, userSelect:'none' }}>{k.char}</span>
        </div>
        {/* thông tin */}
        <div style={{ padding:'10px 14px', fontSize:13, lineHeight:1.9, color:'#333' }}>
          {k.reading_on?.length  > 0 && <div><b>Âm On:</b> {k.reading_on.join('、')}</div>}
          {k.reading_kun?.length > 0 && <div><b>Âm Kun:</b> {k.reading_kun.join('、')}</div>}
          {k.han_viet             && <div><b>Hán Việt:</b> {k.han_viet}</div>}
          {k.meaning_vi           && <div><b>Nghĩa:</b> {k.meaning_vi}</div>}
        </div>
      </div>
      {/* hàng ô luyện viết */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:2, padding:6, background:'#fff' }}>
        {FADE.map((op, i) => <PracticeBox key={i} char={k.char} opacity={op} size={boxSize} />)}
        {Array.from({ length: empty }, (_, i) => <PracticeBox key={i+guideCount} size={boxSize} />)}
      </div>
    </div>
  );
}

// ─── Canvas vẽ tay ───────────────────────────────────────────────────────────
const KanjiCanvas = forwardRef(function KanjiCanvas({ char, showGuide, brush, onCount }, ref) {
  const SIZE = 300;
  const canvasRef = useRef(null);
  const strokes = useRef([]), cur = useRef(null), drawing = useRef(false);
  const [count, setCount] = useState(0);

  const styleCtx = (ctx) => { ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=brush; };
  const redraw = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE); styleCtx(ctx);
    for (const st of strokes.current) {
      if (st.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(st[0].x, st[0].y);
      for (const p of st.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke();
    }
  }, [brush]);

  useEffect(() => { strokes.current = []; cur.current = null; setCount(0); redraw(); }, [char, redraw]);
  useEffect(() => { redraw(); }, [brush, redraw]);
  useEffect(() => { onCount?.(count); }, [count, onCount]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current.length === 0,
    getImage: () => {
      if (!strokes.current.length) return null;
      const tmp = document.createElement('canvas'); tmp.width=SIZE; tmp.height=SIZE;
      const tctx = tmp.getContext('2d'); tctx.fillStyle='#fff'; tctx.fillRect(0,0,SIZE,SIZE);
      tctx.drawImage(canvasRef.current, 0, 0); return tmp.toDataURL('image/png');
    },
  }), []);

  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect();
    return { x:(e.clientX-r.left)*(SIZE/r.width), y:(e.clientY-r.top)*(SIZE/r.height) }; };
  const down = (e) => { drawing.current=true; cur.current=[pos(e)]; canvasRef.current.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!drawing.current) return; const p=pos(e), pts=cur.current;
    const ctx=canvasRef.current.getContext('2d'); styleCtx(ctx);
    ctx.beginPath(); ctx.moveTo(pts[pts.length-1].x, pts[pts.length-1].y); ctx.lineTo(p.x,p.y); ctx.stroke(); pts.push(p); };
  const up = () => { if (!drawing.current) return; drawing.current=false;
    if (cur.current?.length > 1) { strokes.current.push(cur.current); setCount(c=>c+1); } cur.current=null; };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative bg-white border-2 border-charcoal/30 rounded-xl" style={{ width:SIZE, height:SIZE }}>
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-charcoal/20" />
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-charcoal/20" />
        <div className="absolute inset-0" style={{ backgroundImage:
          'linear-gradient(45deg,transparent 49.4%,rgba(0,0,0,0.07) 49.4%,rgba(0,0,0,0.07) 50.6%,transparent 50.6%),' +
          'linear-gradient(-45deg,transparent 49.4%,rgba(0,0,0,0.07) 49.4%,rgba(0,0,0,0.07) 50.6%,transparent 50.6%)' }} />
        {showGuide && char && (
          <span className="absolute inset-0 flex items-center justify-center leading-none select-none pointer-events-none"
            style={{ fontSize:SIZE*0.74, color:'rgba(0,0,0,0.13)', fontFamily:SERIF }}>{char}</span>
        )}
        <canvas ref={canvasRef} width={SIZE} height={SIZE}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair rounded-xl" style={{ touchAction:'none' }} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => { strokes.current.pop(); setCount(c=>Math.max(0,c-1)); redraw(); }} disabled={count===0}>
          <span className="material-symbols-outlined text-lg">undo</span> Hoàn tác
        </Button>
        <Button variant="secondary" onClick={() => { strokes.current=[]; setCount(0); redraw(); }} disabled={count===0}>
          <span className="material-symbols-outlined text-lg">ink_eraser</span> Xóa
        </Button>
      </div>
    </div>
  );
});

// ─── Kết quả AI ──────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#ae2826';
const scoreBg    = (s) => s >= 80 ? '#f0fdf4' : s >= 50 ? '#fffbeb' : '#fdf2f2';

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KanjiWriting() {
  const [tab, setTab]     = useState('draw');   // 'draw' | 'sheet'
  const [list, setList]   = useState([]);
  const [idx, setIdx]     = useState(0);
  const [typed, setTyped] = useState('');
  const [level, setLevel] = useState('N5');
  const [browse, setBrowse]     = useState([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  // draw options
  const [showGuide, setShowGuide] = useState(true);
  const [brush, setBrush]   = useState(14);
  const canvasApi = useRef(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [scoring, setScoring]   = useState(false);
  const [result, setResult]     = useState(null);
  const [scoreErr, setScoreErr] = useState('');
  // sheet options
  const [boxSize, setBoxSize]     = useState(68);
  const [guideCount, setGuideCount] = useState(3);

  const has = (c) => list.some(k => k.char === c);
  const addKanji = (k) => { if (!has(k.char)) setList(l => [...l, k]); };
  const addTyped = () => {
    const chars = [...new Set((typed.match(KANJI_RE)||[]))].filter(c => !has(c));
    if (chars.length) setList(l => [...l, ...chars.map(c => ({ char:c, reading_on:[], reading_kun:[], meaning_vi:'', han_viet:'' }))]);
    setTyped('');
  };
  const removeAt = (i) => { setList(l => l.filter((_,j)=>j!==i)); setIdx(p => i<=p&&p>0?p-1:p); };

  const loadBrowse = async () => {
    setLoadingBrowse(true);
    try { const r = await api.get(`/kanji?level=${level}&limit=80`); setBrowse(r.data?.data||[]); }
    catch { setBrowse([]); } finally { setLoadingBrowse(false); }
  };

  const handleCount = useCallback((c) => { setStrokeCount(c); setResult(null); setScoreErr(''); }, []);

  const handleScore = async () => {
    const img = canvasApi.current?.getImage();
    if (!img || !list[idx]) return;
    setScoring(true); setScoreErr(''); setResult(null);
    try { const r = await api.post('/kanji/score-writing', { image:img, character:list[idx].char }); setResult(r.data); }
    catch (e) { setScoreErr(e.response?.data?.error||'Không chấm được, thử lại.'); }
    finally { setScoring(false); }
  };

  const current = list[idx];

  return (
    <StudentLayout title="Luyện viết Kanji">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-2xl font-bold">Luyện viết Kanji</h1>
          <Link to="/kanji" className="text-sm text-on-muted hover:text-tsubaki-red inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span> Kanji
          </Link>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-outline p-1 mb-5 bg-surface-low gap-1">
          {[['draw','draw','Vẽ trực tuyến'],['sheet','article','Tạo bộ luyện viết']].map(([key,icon,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${tab===key?'bg-white shadow text-charcoal':'text-on-muted hover:text-charcoal'}`}>
              <span className="material-symbols-outlined text-base">{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* Kanji selector — dùng chung 2 tab */}
        <div className="glass-card rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <input value={typed} onChange={e=>setTyped(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTyped()}
                placeholder="Gõ kanji, VD: 水火木" className="flex-1 min-w-0 px-3 py-2 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red" />
              <Button onClick={addTyped} disabled={!typed.trim()}>Thêm</Button>
            </div>
            <div className="flex gap-2">
              <select value={level} onChange={e=>setLevel(e.target.value)} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                {LEVELS.map(l=><option key={l}>{l}</option>)}
              </select>
              <Button variant="secondary" onClick={loadBrowse} loading={loadingBrowse}>Thư viện</Button>
            </div>
          </div>
          {browse.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1 border-t border-outline/40">
              {browse.map(k=>(
                <button key={k.id} onClick={()=>addKanji({char:k.character,reading_on:k.reading_on,reading_kun:k.reading_kun,meaning_vi:k.meaning_vi,han_viet:k.han_viet||''})}
                  disabled={has(k.character)}
                  className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${has(k.character)?'border-emerald-300 bg-emerald-50 text-emerald-600':'border-outline hover:border-tsubaki-red hover:bg-tsubaki-red/5'}`}>
                  {k.character}
                </button>
              ))}
            </div>
          )}
          {list.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline/40">
              {list.map((k,i)=>(
                <div key={i} className="relative group">
                  <button onClick={()=>setIdx(i)}
                    className={`w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-all ${i===idx?'border-tsubaki-red bg-tsubaki-red/10 text-tsubaki-red ring-2 ring-tsubaki-red/20':'border-outline hover:bg-surface-low'}`}>
                    {k.char}
                  </button>
                  <button onClick={()=>removeAt(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tab: Vẽ trực tuyến ── */}
        {tab === 'draw' && (
          !current ? (
            <div className="glass-card rounded-2xl py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">draw</span>
              <p className="font-semibold mb-1">Chưa chọn kanji</p>
              <p className="text-on-muted text-sm">Gõ hoặc chọn từ thư viện ở trên.</p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
              <p className="text-xs text-on-muted flex flex-wrap justify-center gap-x-3 mb-4 min-h-[1rem]">
                {current.reading_on?.length>0 && <span>On: <b className="text-charcoal">{current.reading_on.join('、')}</b></span>}
                {current.reading_kun?.length>0 && <span>Kun: <b className="text-charcoal">{current.reading_kun.join('、')}</b></span>}
                {current.meaning_vi && <span>Nghĩa: <b className="text-charcoal">{current.meaning_vi}</b></span>}
              </p>
              <KanjiCanvas ref={canvasApi} char={current.char} showGuide={showGuide} brush={brush} onCount={handleCount} />
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={showGuide} onChange={e=>setShowGuide(e.target.checked)} className="accent-tsubaki-red" /> Chữ mờ
                </label>
                <label className="flex items-center gap-2 text-sm">Cỡ nét
                  <input type="range" min="6" max="28" value={brush} onChange={e=>setBrush(Number(e.target.value))} className="accent-tsubaki-red w-24" />
                </label>
              </div>
              <Button onClick={handleScore} loading={scoring} disabled={strokeCount===0} className="mt-4">
                <span className="material-symbols-outlined text-lg">auto_awesome</span> Chấm điểm AI
              </Button>
              {strokeCount===0&&!result&&<p className="text-xs text-on-muted mt-2">Vẽ chữ trước rồi bấm chấm điểm.</p>}
              {scoreErr && <p className="text-sm text-tsubaki-red mt-3">{scoreErr}</p>}
              {result && (
                <div className="w-full max-w-sm mt-4 rounded-2xl border p-4"
                  style={{ borderColor: result.similarity!=null ? scoreColor(result.similarity)+'44' : '#e5e7eb', background: result.similarity!=null ? scoreBg(result.similarity) : '#f9fafb' }}>
                  {result.similarity != null && (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-sm text-on-muted">Độ giống</span>
                      <span className="text-4xl font-display font-bold" style={{ color:scoreColor(result.similarity) }}>{result.similarity}%</span>
                    </div>
                  )}
                  {result.comment && <p className="text-sm text-center text-charcoal mb-2">{result.comment}</p>}
                  {result.errors?.length > 0 && (
                    <ul className="space-y-1 mt-1">
                      {result.errors.map((e,i)=>(
                        <li key={i} className="text-sm text-charcoal flex gap-1.5">
                          <span className="material-symbols-outlined text-base text-tsubaki-red shrink-0">close</span>{e}
                        </li>
                      ))}
                    </ul>
                  )}
                  {result.similarity!=null&&!result.errors?.length&&(
                    <p className="text-sm text-center text-emerald-600 flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-lg">check_circle</span> Viết tốt, không có lỗi!
                    </p>
                  )}
                </div>
              )}
              {list.length > 1 && (
                <div className="flex items-center gap-4 mt-5">
                  <Button variant="secondary" onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0}>← Trước</Button>
                  <span className="text-sm text-on-muted">{idx+1}/{list.length}</span>
                  <Button variant="secondary" onClick={()=>setIdx(i=>Math.min(list.length-1,i+1))} disabled={idx===list.length-1}>Sau →</Button>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Tab: Tạo bộ luyện viết ── */}
        {tab === 'sheet' && (
          <div>
            {/* Options */}
            <div className="glass-card rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm">Cỡ ô
                <select value={boxSize} onChange={e=>setBoxSize(Number(e.target.value))} className="px-2 py-1 border border-outline rounded-lg text-sm">
                  <option value={56}>Nhỏ</option><option value={68}>Vừa</option><option value={84}>Lớn</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">Ô chữ mờ
                <select value={guideCount} onChange={e=>setGuideCount(Number(e.target.value))} className="px-2 py-1 border border-outline rounded-lg text-sm">
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={0}>Không</option>
                </select>
              </label>
              <div className="ml-auto">
                <Button onClick={()=>window.print()} disabled={list.length===0}>
                  <span className="material-symbols-outlined text-lg">download</span> Tải PDF / In
                </Button>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="glass-card rounded-2xl py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">article</span>
                <p className="font-semibold mb-1">Chưa chọn kanji</p>
                <p className="text-on-muted text-sm">Chọn kanji ở trên để xem trước bộ luyện viết.</p>
              </div>
            ) : (
              /* Preview — cũng là nội dung được in */
              <div id="ws-print" className="bg-white rounded-2xl shadow-sm p-6">
                <div className="hidden print:block text-center mb-5">
                  <p className="text-xl font-bold tracking-wide">Luyện viết Kanji — Kizuna Nihongo</p>
                </div>
                {list.map((k,i) => <WorksheetEntry key={i} k={k} boxSize={boxSize} guideCount={guideCount} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body > * { visibility: hidden; }
          #ws-print, #ws-print * { visibility: visible; }
          #ws-print { position: fixed; inset: 0; padding: 0; margin: 0; box-shadow: none; border-radius: 0; overflow: visible; }
        }
      `}</style>
    </StudentLayout>
  );
}
