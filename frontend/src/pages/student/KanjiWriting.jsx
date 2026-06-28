import { useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const KANJI_RE = /[一-龯㐀-䶿]/g;

// Ô tập viết kiểu 米字格 (có đường gióng chữ thập + chéo mờ)
function WriteBox({ ch, faint, size }) {
  return (
    <div className="relative shrink-0 border border-charcoal/40"
      style={{ width: size, height: size }}>
      {/* đường gióng */}
      <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-charcoal/20" />
      <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-charcoal/20" />
      {ch && (
        <span className="absolute inset-0 flex items-center justify-center leading-none"
          style={{ fontSize: size * 0.72, color: faint ? 'rgba(0,0,0,0.18)' : '#1a1a1a',
                   fontFamily: "'Noto Sans JP','Yu Mincho',serif" }}>
          {ch}
        </span>
      )}
    </div>
  );
}

export default function KanjiWriting() {
  const [sheet, setSheet]   = useState([]); // [{char, reading_on, reading_kun, meaning_vi}]
  const [typed, setTyped]   = useState('');
  const [level, setLevel]   = useState('N5');
  const [browse, setBrowse] = useState([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  // tùy chọn
  const [rows, setRows]       = useState(3);
  const [guide, setGuide]     = useState(true);  // ô đầu mỗi dòng là chữ mờ để tô
  const [showInfo, setShowInfo] = useState(true);
  const [boxSize, setBoxSize] = useState(60);

  const has = (c) => sheet.some(k => k.char === c);
  const addKanji = (k) => { if (!has(k.char)) setSheet(s => [...s, k]); };
  const removeAt = (i) => setSheet(s => s.filter((_, j) => j !== i));

  const addTyped = () => {
    const chars = [...new Set((typed.match(KANJI_RE) || []))];
    const next = chars.filter(c => !has(c)).map(c => ({ char: c, reading_on: [], reading_kun: [], meaning_vi: '' }));
    setSheet(s => [...s, ...next]); setTyped('');
  };

  const loadBrowse = async () => {
    setLoadingBrowse(true);
    try { const r = await api.get(`/kanji?level=${level}&limit=80`); setBrowse(r.data?.data || []); }
    catch { setBrowse([]); }
    finally { setLoadingBrowse(false); }
  };

  const boxesPerRow = Math.max(6, Math.floor(680 / (boxSize + 2)));

  return (
    <StudentLayout title="Luyện viết Kanji">
      {/* ── Thanh công cụ (ẩn khi in) ── */}
      <div className="print:hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Luyện viết Kanji</h1>
            <p className="text-sm text-on-muted">Chọn kanji, tùy chỉnh rồi In / Lưu PDF để luyện viết tay.</p>
          </div>
          <Link to="/kanji" className="text-sm text-on-muted hover:text-tsubaki-red inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span> Kanji
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-5">
          {/* Nhập kanji */}
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-semibold mb-2">Nhập kanji (gõ hoặc dán)</label>
            <div className="flex gap-2">
              <input value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTyped()}
                placeholder="VD: 水火木金土" className="flex-1 px-3 py-2 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red" />
              <Button onClick={addTyped} disabled={!typed.trim()}>Thêm</Button>
            </div>
          </div>
          {/* Chọn theo cấp độ */}
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-semibold mb-2">Chọn từ thư viện</label>
            <div className="flex gap-2">
              <select value={level} onChange={e => setLevel(e.target.value)} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
              <Button variant="secondary" onClick={loadBrowse} loading={loadingBrowse}>Tải kanji {level}</Button>
            </div>
            {browse.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-32 overflow-y-auto">
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
        </div>

        {/* Tùy chọn */}
        <div className="glass-card rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">Số dòng/chữ
            <select value={rows} onChange={e => setRows(Number(e.target.value))} className="px-2 py-1 border border-outline rounded-lg">
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">Cỡ ô
            <select value={boxSize} onChange={e => setBoxSize(Number(e.target.value))} className="px-2 py-1 border border-outline rounded-lg">
              {[48,60,72,90].map(n => <option key={n} value={n}>{n === 48 ? 'Nhỏ' : n === 60 ? 'Vừa' : n === 72 ? 'Lớn' : 'Rất lớn'}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={guide} onChange={e => setGuide(e.target.checked)} className="accent-tsubaki-red" /> Chữ mờ để tô (ô đầu dòng)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showInfo} onChange={e => setShowInfo(e.target.checked)} className="accent-tsubaki-red" /> Hiện âm &amp; nghĩa
          </label>
          <div className="ml-auto flex items-center gap-2">
            {sheet.length > 0 && <button onClick={() => setSheet([])} className="text-sm text-on-muted hover:text-error">Xóa hết</button>}
            <Button onClick={() => window.print()} disabled={sheet.length === 0}>
              <span className="material-symbols-outlined text-lg">print</span> In / Lưu PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Sheet luyện viết (in được) ── */}
      {sheet.length === 0 ? (
        <div className="print:hidden glass-card rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">draw</span>
          <p className="font-bold text-lg mb-1">Chưa chọn kanji nào</p>
          <p className="text-on-muted text-sm">Gõ kanji hoặc chọn từ thư viện ở trên.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 print:p-0 print:rounded-none shadow-sm print:shadow-none" id="kanji-sheet">
          <div className="hidden print:block text-center mb-4">
            <p className="font-bold text-lg">Luyện viết Kanji — Kizuna Nihongo</p>
          </div>
          <div className="space-y-5">
            {sheet.map((k, idx) => (
              <div key={idx} className="break-inside-avoid">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="print:hidden text-xs text-on-muted w-5">{idx + 1}.</span>
                  {showInfo && (
                    <div className="text-xs text-on-muted flex flex-wrap gap-x-3">
                      {(k.reading_on?.length > 0) && <span>On: <b className="text-charcoal">{k.reading_on.join('、')}</b></span>}
                      {(k.reading_kun?.length > 0) && <span>Kun: <b className="text-charcoal">{k.reading_kun.join('、')}</b></span>}
                      {k.meaning_vi && <span>Nghĩa: <b className="text-charcoal">{k.meaning_vi}</b></span>}
                    </div>
                  )}
                  <button onClick={() => removeAt(idx)} className="print:hidden ml-auto text-on-muted hover:text-error">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                {/* các dòng ô viết */}
                <div className="space-y-1">
                  {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex gap-0.5 flex-wrap">
                      {Array.from({ length: boxesPerRow }).map((_, c) => (
                        <WriteBox key={c} size={boxSize}
                          ch={r === 0 && c === 0 ? k.char : (guide && c === 0 ? k.char : '')}
                          faint={!(r === 0 && c === 0)} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@media print {
        @page { size: A4; margin: 12mm; }
        body { background: #fff; }
        nav, header, aside, .print\\:hidden { display: none !important; }
        main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
      }`}</style>
    </StudentLayout>
  );
}
