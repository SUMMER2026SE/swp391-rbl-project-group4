import { useCallback, useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

function KanjiSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl aspect-square animate-pulse flex flex-col justify-center items-center gap-2">
          <div className="h-10 w-10 bg-surface-low rounded" />
          <div className="h-3 w-14 bg-surface-low rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Kanji() {
  const [items, setItems]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [level, setLevel]       = useState('');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);
  const LIMIT = 30;

  const load = useCallback(async (p, l, s) => {
    setLoading(true);
    setSelected(null);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s) params.set('search', s);
      if (l) params.set('level', l);
      const r = await api.get(`/kanji?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, level, search); }, [page, level]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, level, search);
  };

  const changeLevel = (l) => { setLevel(l); setPage(1); };

  const fmtArr = (v) => Array.isArray(v) && v.length ? v.join('、') : null;

  const selectedIdx = selected ? items.findIndex(k => k.id === selected.id) : -1;

  return (
    <StudentLayout title="Kanji">
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Kanji</h1>
          {!loading && total > 0 && (
            <p className="text-sm text-on-muted mt-0.5">{total.toLocaleString()} kanji</p>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kanji, reading, nghĩa..."
            className="px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-52 transition-colors" />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        </form>
      </div>

      {/* Level filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => changeLevel('')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!level ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
          Tất cả
        </button>
        {LEVELS.map(l => (
          <button key={l} onClick={() => changeLevel(l)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${level === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <KanjiSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">font_download</span>
          <h3 className="font-display font-bold text-lg text-charcoal mb-1">
            {search || level ? 'Không tìm thấy kanji' : 'Chưa có kanji nào'}
          </h3>
          <p className="text-sm text-on-muted">
            {search ? `Không có kết quả cho "${search}".` : level ? `Chưa có kanji cấp ${level}.` : 'Nội dung đang được biên soạn.'}
          </p>
          {(search || level) && (
            <button onClick={() => { setSearch(''); changeLevel(''); load(1,'',''); }}
              className="mt-4 text-sm text-tsubaki-red font-semibold hover:underline">
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {items.map(k => (
              <div key={k.id} onClick={() => setSelected(k)}
                className="glass-card rounded-2xl aspect-square cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all flex flex-col justify-center items-center gap-1 select-none p-2">
                <p className="text-4xl font-bold text-tsubaki-red leading-none">{k.character}</p>
                {k.han_viet && (
                  <p className="text-[11px] font-semibold text-amber-600 leading-none">{k.han_viet}</p>
                )}
                <p className="text-xs text-on-muted text-center leading-tight line-clamp-1 px-1">{k.meaning_vi}</p>
                {k.level && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[k.level]}`}>{k.level}</span>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors">
                ← Trước
              </button>
              <span className="px-4 py-2 text-sm text-on-muted">{page} / {Math.ceil(total / LIMIT)}</span>
              <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors">
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Kanji detail popup ──────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />

            {/* Close */}
            <button onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Character display */}
            <div className="px-8 pt-8 pb-6 text-center">
              <p className="text-8xl font-bold text-tsubaki-red leading-none mb-2">{selected.character}</p>
              {selected.han_viet && (
                <p className="text-lg font-bold text-amber-600 mb-1">{selected.han_viet}</p>
              )}
              <p className="text-xl font-bold text-charcoal">{selected.meaning_vi}</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {selected.level && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[selected.level]}`}>
                    {selected.level}
                  </span>
                )}
                {selected.stroke_count && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-low text-on-muted">
                    {selected.stroke_count} nét
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-8 border-t border-outline/30" />

            {/* Readings */}
            <div className="px-8 py-6 space-y-4">
              {fmtArr(selected.reading_on) && (
                <div>
                  <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Âm On（音読み）</p>
                  <p className="text-lg font-bold text-charcoal font-mono">{fmtArr(selected.reading_on)}</p>
                </div>
              )}
              {fmtArr(selected.reading_kun) && (
                <div>
                  <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Âm Kun（訓読み）</p>
                  <p className="text-lg font-bold text-charcoal font-mono">{fmtArr(selected.reading_kun)}</p>
                </div>
              )}
              {!fmtArr(selected.reading_on) && !fmtArr(selected.reading_kun) && (
                <p className="text-sm text-on-muted italic text-center">Chưa có thông tin đọc.</p>
              )}
            </div>

            {/* Navigation */}
            <div className="px-8 pb-6 flex gap-2">
              <button
                onClick={() => selectedIdx > 0 && setSelected(items[selectedIdx - 1])}
                disabled={selectedIdx <= 0}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors">
                <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
              </button>
              <button
                onClick={() => selectedIdx < items.length - 1 && setSelected(items[selectedIdx + 1])}
                disabled={selectedIdx >= items.length - 1}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors">
                Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
