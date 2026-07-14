import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Button from '../ui/Button';
import { SERIF } from '../../lib/kanjiWorksheet';

const SIZE = 300;

const KanjiCanvas = forwardRef(function KanjiCanvas({ char, showGuide, brush, onCount }, ref) {
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

export default KanjiCanvas;
