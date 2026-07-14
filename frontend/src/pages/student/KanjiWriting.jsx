import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import KanjiCanvas from '../../components/kanji/KanjiCanvas';
import api from '../../lib/api';
import { downloadWorksheetPDF } from '../../lib/kanjiWorksheet';
import WorksheetPreview from '../../components/kanji/WorksheetPreview';

const LEVELS = ['N5','N4','N3','N2','N1'];

// ─── Kết quả AI ──────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#ae2826';
const scoreBg    = (s) => s >= 80 ? '#f0fdf4' : s >= 50 ? '#fffbeb' : '#fdf2f2';

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KanjiWriting() {
  const [tab, setTab]     = useState('draw');   // 'draw' | 'sheet'
  const [list, setList]   = useState([]);
  const [idx, setIdx]     = useState(0);
  const [level, setLevel]           = useState('N5');
  const [browse, setBrowse]         = useState([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [search, setSearch]         = useState('');
  // draw options
  const [showGuide, setShowGuide] = useState(true);
  const [brush, setBrush]   = useState(14);
  const canvasApi = useRef(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [scoring, setScoring]   = useState(false);
  const [result, setResult]     = useState(null);
  const [scoreErr, setScoreErr] = useState('');
  // sheet options
  const [boxSize, setBoxSize]       = useState(68);
  const [guideCount, setGuideCount] = useState(3);
  const [downloading, setDownloading] = useState(false);

  const has = (c) => list.some(k => k.char === c);
  const addKanji = (k) => { if (!has(k.char)) setList(l => [...l, k]); };
  const removeAt = (i) => { setList(l => l.filter((_,j)=>j!==i)); setIdx(p => i<=p&&p>0?p-1:p); };

  useEffect(() => {
    setLoadingBrowse(true);
    api.get(`/kanji?level=${level}&limit=200`)
      .then(r => setBrowse(r.data?.data || []))
      .catch(() => setBrowse([]))
      .finally(() => setLoadingBrowse(false));
  }, [level]);

  const filteredBrowse = search.trim()
    ? browse.filter(k =>
        k.meaning_vi?.toLowerCase().includes(search.toLowerCase()) ||
        k.character.includes(search)
      )
    : browse;

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
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={level} onChange={e=>{ setLevel(e.target.value); setSearch(''); }}
                className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                {LEVELS.map(l=><option key={l}>{l}</option>)}
              </select>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Tìm theo nghĩa hoặc chữ kanji..."
                className="flex-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
            </div>
            {loadingBrowse ? (
              <p className="text-xs text-on-muted py-2 animate-pulse">Đang tải...</p>
            ) : filteredBrowse.length === 0 ? (
              <p className="text-xs text-on-muted py-2">Không tìm thấy kanji phù hợp.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {filteredBrowse.map(k=>(
                  <button key={k.id}
                    onClick={()=>addKanji({char:k.character,reading_on:k.reading_on,reading_kun:k.reading_kun,meaning_vi:k.meaning_vi,han_viet:k.han_viet||''})}
                    disabled={has(k.character)}
                    title={`${k.meaning_vi || ''}${k.reading_on?.length ? ' • ' + k.reading_on.join('、') : ''}`}
                    className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${has(k.character)?'border-emerald-300 bg-emerald-50 text-emerald-600':'border-outline hover:border-tsubaki-red hover:bg-tsubaki-red/5'}`}>
                    {k.character}
                  </button>
                ))}
              </div>
            )}
          </div>

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
                <Button
                  loading={downloading}
                  disabled={list.length === 0}
                  onClick={async () => {
                    setDownloading(true);
                    try { await downloadWorksheetPDF('ws-print', `luyen-viet-kanji-${list.map(k=>k.char).join('')}.pdf`); }
                    finally { setDownloading(false); }
                  }}>
                  <span className="material-symbols-outlined text-lg">download</span> Tải PDF
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
              <WorksheetPreview list={list} boxSize={boxSize} guideCount={guideCount} />
            )}
          </div>
        )}
      </div>

    </StudentLayout>
  );
}
