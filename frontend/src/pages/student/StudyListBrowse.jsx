import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const TYPE_LABEL = { vocabulary: 'Từ vựng', kanji: 'Kanji', grammar: 'Ngữ pháp' };
const TYPE_ICON  = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 h-32 animate-pulse" />
      ))}
    </div>
  );
}

export default function StudyListBrowse() {
  const { type } = useParams();
  const navigate = useNavigate();
  const label = TYPE_LABEL[type] || type;

  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState('newest');
  const [page, setPage]       = useState(1);
  const LIMIT = 12;

  const fetchPosts = useCallback(async (p, s, se) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type, sort: s, page: p, limit: LIMIT });
      if (se) params.set('search', se);
      const r = await api.get(`/study-lists?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchPosts(page, sort, search); }, [page, sort, type]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPosts(1, sort, search);
  };

  return (
    <StudentLayout title={`Bài đăng ${label}`}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-tsubaki-red">{TYPE_ICON[type]}</span>
            Bài đăng {label}
          </h1>
          {total > 0 && !loading && <p className="text-sm text-on-muted mt-0.5">{total.toLocaleString()} bài đăng</p>}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề..."
            className="px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-56"
          />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        </form>
      </div>

      <div className="flex gap-2 mb-6">
        {[['newest', 'Mới nhất'], ['popular', 'Nhiều lượt xem nhất']].map(([key, l]) => (
          <button
            key={key}
            onClick={() => { setSort(key); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${sort === key ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">{TYPE_ICON[type]}</span>
          <h3 className="font-display font-bold text-lg text-charcoal mb-1">
            {search ? 'Không tìm thấy bài đăng' : 'Chưa có bài đăng nào'}
          </h3>
          <p className="text-sm text-on-muted max-w-xs">
            {search ? `Không có kết quả cho "${search}".` : 'Giáo viên chưa đăng danh sách nào cho mục này.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(post => (
              <div
                key={post.id}
                onClick={() => navigate(`/study-lists/${type}/${post.id}`)}
                className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all"
              >
                <h3 className="font-display font-bold text-charcoal mb-1 line-clamp-2">{post.title}</h3>
                {post.description && <p className="text-sm text-on-muted line-clamp-2 mb-3">{post.description}</p>}
                <div className="flex items-center justify-between text-xs text-on-muted mt-2">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">person</span>
                    {post.creator_name || '—'}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">bookmarks</span>{post.item_count}</span>
                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">visibility</span>{post.view_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
    </StudentLayout>
  );
}
