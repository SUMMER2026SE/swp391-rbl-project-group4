import { useCallback, useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';
import { renderMarkdown } from '../../lib/renderPreview';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  N4: 'bg-sky-100 text-sky-700 border-sky-200',
  N3: 'bg-violet-100 text-violet-700 border-violet-200',
  N2: 'bg-orange-100 text-orange-700 border-orange-200',
  N1: 'bg-red-100 text-red-700 border-red-200',
};

function GrammarSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-outline/20 animate-pulse">
          <div className="h-4 w-16 bg-surface-low rounded mb-3" />
          <div className="h-5 w-3/4 bg-surface-low rounded mb-2" />
          <div className="h-4 w-1/2 bg-surface-low rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Grammar() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState(null);
  const LIMIT = 18;

  const fetchGrammar = useCallback(async (p = 1, l = '', s = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s) params.set('search', s);
      if (l) params.set('level', l);
      const r = await api.get(`/grammar?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGrammar(page, level, search); }, [page, level]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchGrammar(1, level, search);
  };

  const handleLevelChange = (l) => {
    setLevel(l);
    setPage(1);
  };

  return (
    <StudentLayout title="Ngữ pháp">
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Ngữ pháp</h1>
          {total > 0 && !loading && (
            <p className="text-sm text-on-muted mt-0.5">{total} bài ngữ pháp</p>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm bài ngữ pháp..."
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
          Tất cả
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
        <GrammarSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">spellcheck</span>
          <h3 className="font-display font-bold text-lg text-charcoal mb-1">
            {search || level ? 'Không tìm thấy bài ngữ pháp' : 'Chưa có bài ngữ pháp nào'}
          </h3>
          <p className="text-sm text-on-muted max-w-xs">
            {search
              ? `Không có kết quả cho "${search}".`
              : level
              ? `Chưa có bài ngữ pháp cấp độ ${level}.`
              : 'Nội dung đang được biên soạn, hãy quay lại sau.'}
          </p>
          {(search || level) && (
            <button
              onClick={() => { setSearch(''); setLevel(''); setPage(1); fetchGrammar(1, '', ''); }}
              className="mt-4 text-sm text-tsubaki-red font-semibold hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => {
              const courseLevel = item.courses?.level;
              const levelColor  = LEVEL_COLORS[courseLevel] || 'bg-surface-low text-on-muted border-transparent';
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="glass-card rounded-2xl p-5 text-left hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all"
                >
                  {courseLevel && (
                    <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold border mb-3 ${levelColor}`}>
                      {courseLevel}
                    </span>
                  )}
                  <h3 className="font-bold text-on-surface mb-1 line-clamp-2">{item.title}</h3>
                  {item.title_ja && (
                    <p className="text-sm text-on-muted">{item.title_ja}</p>
                  )}
                  {item.courses?.title && (
                    <p className="text-xs text-on-muted/70 mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">menu_book</span>
                      {item.courses.title}
                    </p>
                  )}
                </button>
              );
            })}
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

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple shrink-0" />

            {/* Header */}
            <div className="px-8 pt-6 pb-4 border-b border-outline/20 shrink-0">
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>

              {selected.courses?.level && (
                <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold border mb-3 ${LEVEL_COLORS[selected.courses.level] || 'bg-surface-low text-on-muted border-transparent'}`}>
                  {selected.courses.level}
                </span>
              )}
              <h2 className="font-display text-xl font-bold text-on-surface">{selected.title}</h2>
              {selected.title_ja && <p className="text-sm text-on-muted mt-1">{selected.title_ja}</p>}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {selected.content ? (
                <div
                  className="prose prose-sm max-w-none text-on-surface leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: `<p class="mb-3">${renderMarkdown(selected.content)}</p>` }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-on-muted">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-20">description</span>
                  <p className="text-sm">Bài này chưa có nội dung.</p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="px-8 pb-6 pt-3 border-t border-outline/10 flex gap-2 shrink-0">
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
