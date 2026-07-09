import { useEffect, useRef, useState } from 'react';
import { SERIF } from '../../lib/kanjiWorksheet';

// Nội dung bộ luyện viết — render DOM `#ws-print` để html2canvas chụp khi tải PDF.
// Mỗi phần tử trong `list` có dạng { char, reading_on, reading_kun, meaning_vi, han_viet }.

// Glyph kanji vẽ sẵn vào canvas rồi nhúng dạng <img>: html2canvas chép ảnh nguyên pixel,
// tránh lỗi nó tính sai baseline khi vẽ text CJK khiến chữ bị lệch trong PDF.
function glyphDataUrl(char, size, color) {
  const scale = 2; // vẽ 2x cho nét
  const px = size * scale;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.font = `${Math.round(size * 0.72 * scale)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  // căn giữa theo phần mực thật của glyph (baseline 'middle' của font CJK thường bị lệch)
  const m = ctx.measureText(char);
  const yOff = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(char, px / 2, px / 2 + yOff);
  return c.toDataURL();
}

function Glyph({ char, size, color = '#1a1a1a' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    document.fonts.load(`${size}px ${SERIF}`, char)
      .catch(() => {})
      .then(() => { if (alive) setSrc(glyphDataUrl(char, size, color)); });
    return () => { alive = false; };
  }, [char, size, color]);
  if (!src) return null;
  return <img src={src} alt={char} draggable={false}
    style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', userSelect:'none', pointerEvents:'none' }} />;
}

// ─── Ô luyện viết (CSS-only, dùng trong worksheet) ───────────────────────────
function PracticeBox({ char, opacity = 0, size = 68 }) {
  return (
    <div style={{ position:'relative', width:'100%', aspectRatio:'1', border:'1px solid #bbb', background:'#fff' }}>
      {/* đường gióng chữ thập */}
      <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1,
        background:'repeating-linear-gradient(to bottom,#d0d0d0 0,#d0d0d0 3px,transparent 3px,transparent 7px)' }} />
      <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1,
        background:'repeating-linear-gradient(to right,#d0d0d0 0,#d0d0d0 3px,transparent 3px,transparent 7px)' }} />
      {/* đường chéo mờ */}
      <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundImage:
        'linear-gradient(45deg,transparent 49.2%,#e8e8e8 49.2%,#e8e8e8 50.8%,transparent 50.8%),' +
        'linear-gradient(-45deg,transparent 49.2%,#e8e8e8 49.2%,#e8e8e8 50.8%,transparent 50.8%)' }} />
      {char && opacity > 0 && <Glyph char={char} size={size} color={`rgba(0,0,0,${opacity})`} />}
    </div>
  );
}

// ─── Một khối kanji trong worksheet ──────────────────────────────────────────
const GAP = 2, ROW_PAD = 6, PRACTICE_ROWS = 2;

function WorksheetEntry({ k, boxSize, guideCount }) {
  const REF = boxSize * 1.6;
  const FADE = [0.22, 0.13, 0.07].slice(0, guideCount);

  // Số cột = số ô cỡ `boxSize` vừa khít bề rộng khung — điền cho đầy, không chừa chỗ trống.
  const rowRef = useRef(null);
  const [cols, setCols] = useState(10);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - ROW_PAD * 2;
      setCols(Math.max(1, Math.floor((avail + GAP) / (boxSize + GAP))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boxSize]);

  const empty = Math.max(0, cols * PRACTICE_ROWS - guideCount);
  return (
    <div data-worksheet-entry style={{ marginBottom:20, pageBreakInside:'avoid', border:'1px solid #ccc', borderRadius:6, overflow:'hidden' }}>
      {/* hàng thông tin */}
      <div style={{ display:'flex', alignItems:'stretch', borderBottom:'1px solid #e0e0e0' }}>
        {/* ô mẫu lớn */}
        <div style={{ position:'relative', width:REF, height:REF, flexShrink:0,
          borderRight:'1px solid #e0e0e0', background:'#fafafa' }}>
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'#ddd' }} />
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'#ddd' }} />
          <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundImage:
            'linear-gradient(45deg,transparent 49.2%,#ececec 49.2%,#ececec 50.8%,transparent 50.8%),' +
            'linear-gradient(-45deg,transparent 49.2%,#ececec 49.2%,#ececec 50.8%,transparent 50.8%)' }} />
          <Glyph char={k.char} size={REF} />
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
      <div ref={rowRef} style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:GAP, padding:ROW_PAD, background:'#fff' }}>
        {FADE.map((op, i) => <PracticeBox key={i} char={k.char} opacity={op} size={boxSize} />)}
        {Array.from({ length: empty }, (_, i) => <PracticeBox key={i+guideCount} size={boxSize} />)}
      </div>
    </div>
  );
}

export default function WorksheetPreview({ list, boxSize = 68, guideCount = 3 }) {
  return (
    <div id="ws-print" className="bg-white rounded-2xl shadow-sm p-6">
      <div className="hidden print:block text-center mb-5">
        <p className="text-xl font-bold tracking-wide">Luyện viết Kanji — Kizuna Nihongo</p>
      </div>
      {list.map((k,i) => <WorksheetEntry key={i} k={k} boxSize={boxSize} guideCount={guideCount} />)}
    </div>
  );
}
