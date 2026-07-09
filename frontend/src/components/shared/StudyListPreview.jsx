import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

const TYPE_ICON  = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };
const ITEM_UNIT  = { vocabulary: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LEVEL_BG = {
  N5: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  N4: 'bg-gradient-to-br from-sky-400 to-sky-600',
  N3: 'bg-gradient-to-br from-violet-400 to-violet-600',
  N2: 'bg-gradient-to-br from-orange-400 to-orange-600',
  N1: 'bg-gradient-to-br from-red-400 to-red-600',
};
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

function PostCard({ post, type, onClick }) {
  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden glass-card hover:shadow-lg hover:-translate-y-0.5 border border-transparent hover:border-tsubaki-red/30 transition-all cursor-pointer"
    >
      <div className={`h-24 flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
        <span className="material-symbols-outlined text-4xl text-white/90">{TYPE_ICON[type]}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-charcoal text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{post.title}</h3>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
          <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-on-muted">
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-sm">person</span>
            {post.creator_name || '—'}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm">visibility</span>{post.view_count}
          </span>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl h-52 animate-pulse" />
      ))}
    </div>
  );
}

// Toàn bộ khu vực "Bài đăng" (nhóm theo cấp độ N5-N1) — nhúng thẳng vào trang
// Từ vựng/Kanji/Ngữ pháp, không cần chuyển trang riêng mới xem được.
export default function StudyListPreview({ type }) {
  const navigate = useNavigate();
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [sort, setSort]       = useState('newest');

  const fetchPosts = useCallback(async (l, s, se) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type, sort: s, page: 1, limit: 100 });
      if (l)  params.set('level', l);
      if (se) params.set('search', se);
      const r = await api.get(`/study-lists?${params}`);
      setPosts(r.data.data || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchPosts(level, sort, search); }, [level, sort, type]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPosts(level, sort, search);
  };

  const grouped = LEVELS
    .map(l => ({ level: l, items: posts.filter(p => p.level === l) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-tsubaki-red text-xl">library_books</span>
          Bài đăng
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm bài đăng theo tiêu đề..."
            className="px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-56"
          />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl hover:opacity-90 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLevel('')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!level ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}
          >
            Tất cả
          </button>
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${level === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[['newest', 'Mới nhất'], ['popular', 'Nhiều lượt xem nhất']].map(([key, l]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${sort === key ? 'bg-charcoal text-white' : 'bg-white border border-outline text-on-muted hover:border-charcoal'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : posts.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted text-sm">
          {search || level ? 'Không tìm thấy bài đăng.' : 'Chưa có bài đăng nào cho mục này.'}
        </div>
      ) : level ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} type={type} onClick={() => navigate(`/study-lists/${type}/${post.id}`)} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(g => (
            <div key={g.level}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${LEVEL_BADGE[g.level]}`}>{g.level}</span>
                <span className="text-sm text-on-muted">{g.items.length} bài đăng</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {g.items.map(post => (
                  <PostCard key={post.id} post={post} type={type} onClick={() => navigate(`/study-lists/${type}/${post.id}`)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
