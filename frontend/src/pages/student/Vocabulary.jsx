import { useCallback, useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const TYPE_COLORS = {
  'DANH TỪ': 'bg-blue-100 text-blue-700',
  '名詞':    'bg-blue-100 text-blue-700',
  'ĐỘNG TỪ': 'bg-green-100 text-green-700',
  '動詞':    'bg-green-100 text-green-700',
  'TÍNH TỪ': 'bg-amber-100 text-amber-700',
  '形容詞':  'bg-amber-100 text-amber-700',
  'PHÓ TỪ':  'bg-purple-100 text-purple-700',
  '副詞':    'bg-purple-100 text-purple-700',
};

function VocabSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 min-h-[120px] animate-pulse flex flex-col justify-center items-center gap-2">
          <div className="h-8 w-16 bg-surface-low rounded" />
          <div className="h-4 w-12 bg-surface-low rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Vocabulary() {
  const { t } = useLang();
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState(null);
  const LIMIT = 20;

  const fetchVocab = useCallback(async (p = page, l = level, s = search) => {
    setLoading(true);
    setSelected(null);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s) params.set('search', s);
      if (l) params.set('level', l);
      const r = await api.get(`/vocabulary?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVocab(page, level, search); }, [page, level]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchVocab(1, level, search);
  };

  const handleLevelChange = (l) => {
    setLevel(l);
    setPage(1);
  };

  return (
    <StudentLayout title={t('vocab.title')}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('vocab.title')}</h1>
          {total > 0 && !loading && (
            <p className="text-sm text-on-muted mt-0.5">{total.toLocaleString()} từ vựng</p>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('vocab.search')}
            className="px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-48 transition-colors"
          />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        </form>
      </div>

      {/* Level filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleLevelChange('')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!level ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}
        >
          {t('vocab.all_levels')}
        </button>
        {LEVELS.map(l => (
          <button key={l} onClick={() => handleLevelChange(l)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${level === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <VocabSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">translate</span>
          <h3 className="font-display font-bold text-lg text-charcoal mb-1">
            {search || level ? 'Không tìm thấy từ vựng' : 'Chưa có từ vựng nào'}
          </h3>
          <p className="text-sm text-on-muted max-w-xs">
            {search
              ? `Không có kết quả cho "${search}". Thử từ khóa khác.`
              : level
              ? `Chưa có từ vựng cấp độ ${level}.`
              : 'Nội dung từ vựng đang được biên soạn, hãy quay lại sau.'}
          </p>
          {(search || level) && (
            <button
              onClick={() => { setSearch(''); setLevel(''); setPage(1); fetchVocab(1, '', ''); }}
              className="mt-4 text-sm text-tsubaki-red font-semibold hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(v => (
              <div
                key={v.id}
                onClick={() => setSelected(v)}
                className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all min-h-[120px] flex flex-col justify-center items-center text-center select-none"
              >
                <p className="text-3xl font-bold text-tsubaki-red mb-1">{v.kanji || v.reading}</p>
                {v.kanji && <p className="text-sm text-on-muted">{v.reading}</p>}
                {v.type && (
                  <span className={`mt-2 text-xs px-2 py-0.5 rounded-full font-bold ${TYPE_COLORS[v.type] || 'bg-surface-low text-on-muted'}`}>
                    {v.type}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors"
              >
                ← Trước
              </button>
              <span className="px-4 py-2 text-sm text-on-muted">
                {page} / {Math.ceil(total / LIMIT)}
              </span>
              <button
                disabled={page * LIMIT >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors"
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Vocab detail popup ──────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />

            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Main reading / kanji */}
            <div className="px-8 pt-8 pb-6 text-center">
              <p className="text-6xl font-bold text-tsubaki-red leading-none mb-2">
                {selected.kanji || selected.reading}
              </p>
              {selected.kanji && (
                <p className="text-lg text-on-muted mt-1">{selected.reading}</p>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {selected.level && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[selected.level] || 'bg-surface-low text-on-muted'}`}>
                    {selected.level}
                  </span>
                )}
                {selected.type && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${TYPE_COLORS[selected.type] || 'bg-surface-low text-on-muted'}`}>
                    {selected.type}
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-8 border-t border-outline/30" />

            {/* Details */}
            <div className="px-8 py-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa tiếng Việt</p>
                <p className="text-lg font-bold text-charcoal">{selected.meaning_vi}</p>
              </div>
              {selected.meaning_ja && (
                <div>
                  <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Giải thích tiếng Nhật</p>
                  <p className="text-sm text-charcoal">{selected.meaning_ja}</p>
                </div>
              )}
              {selected.example_sentence && (
                <div>
                  <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Câu ví dụ</p>
                  <p className="text-sm text-charcoal italic bg-surface-low rounded-xl px-4 py-3 leading-relaxed">
                    「{selected.example_sentence}」
                  </p>
                </div>
              )}
            </div>

            {/* Navigation between cards */}
            <div className="px-8 pb-6 flex gap-2">
              <button
                onClick={() => { const idx = items.findIndex(v => v.id === selected.id); if (idx > 0) setSelected(items[idx - 1]); }}
                disabled={items.findIndex(v => v.id === selected.id) === 0}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
              </button>
              <button
                onClick={() => { const idx = items.findIndex(v => v.id === selected.id); if (idx < items.length - 1) setSelected(items[idx + 1]); }}
                disabled={items.findIndex(v => v.id === selected.id) === items.length - 1}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
              >
                Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
