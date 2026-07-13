import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_DOT = {
  N5: 'bg-green-500',
  N4: 'bg-blue-500',
  N3: 'bg-yellow-500',
  N2: 'bg-orange-500',
  N1: 'bg-red-600',
};

const LEVEL_GRADIENT = {
  N5: 'from-green-500/10 to-emerald-400/10',
  N4: 'from-blue-500/10 to-sky-400/10',
  N3: 'from-yellow-500/10 to-amber-400/10',
  N2: 'from-orange-500/10 to-red-400/10',
  N1: 'from-red-600/15 to-rose-400/10',
};

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-surface-container" />
      <div className="p-5 space-y-3">
        <div className="h-3 bg-surface-container rounded-full w-1/4" />
        <div className="h-5 bg-surface-container rounded-full w-3/4" />
        <div className="h-3 bg-surface-container rounded-full w-full" />
        <div className="h-3 bg-surface-container rounded-full w-2/3" />
      </div>
    </div>
  );
}

const SORTS = [
  { value: 'newest',      label: 'Mới nhất',       icon: 'schedule' },
  { value: 'most_viewed', label: 'Xem nhiều nhất', icon: 'trending_up' },
];

// dd/mm/yyyy cho ngày đăng trên card
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Dùng cho student (mặc định) và cho trang admin "Xem như học viên" (truyền Layout/apiBase/linkBase/preview).
export default function ReadingList({
  Layout = StudentLayout,
  apiBase = '/reading',
  linkBase = '/reading',
  preview = false,
}) {
  const navigate = useNavigate();
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel]   = useState('');
  const [sort, setSort]     = useState('newest');
  const [page, setPage]     = useState(1);
  const LIMIT = 12;

  const fetchNews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT, sort });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      if (preview) params.set('published', '1');   // admin preview: chỉ xem bài đã đăng
      const r = await api.get(`${apiBase}?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, [page, level, sort]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchNews();
  };

  return (
    <Layout title="Luyện đọc">
      {/* Banner khi admin xem thử giao diện học viên */}
      {preview && (
        <div className="flex items-center gap-2 bg-sumire-purple/10 border border-sumire-purple/20 text-sumire-purple rounded-xl px-4 py-2.5 text-sm mb-6">
          <span className="material-symbols-outlined text-lg shrink-0">visibility</span>
          <span>Bạn đang xem giao diện học viên. Bấm vào một bài để xem chi tiết (không tương tác được với quiz, từ vựng, chat AI).</span>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="font-display text-display-mobile font-bold text-on-surface mb-2 tracking-tight">
          Luyện đọc
        </h1>
        <p className="text-on-surface-variant text-base leading-relaxed whitespace-nowrap">
          Đọc bài tiếng Nhật theo trình độ, bật furigana và bản dịch, tra từ, làm quiz và hỏi đáp cùng trợ lý AI.
        </p>
      </div>

      {/* ── Search + filter bar ──────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-muted text-xl pointer-events-none">
            search
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài đọc..."
            className="w-full pl-12 pr-4 py-3 border border-outline-variant rounded-2xl text-sm outline-none focus:border-tsubaki-red bg-white transition-colors"
          />
        </div>
        <select
          value={level}
          onChange={e => { setLevel(e.target.value); setPage(1); }}
          className="px-4 py-3 border border-outline-variant rounded-2xl text-sm outline-none focus:border-tsubaki-red bg-white text-charcoal-text font-medium sm:w-44 transition-colors"
        >
          <option value="">Tất cả cấp độ</option>
          {LEVELS.map(l => <option key={l} value={l}>{`JLPT ${l}`}</option>)}
        </select>

        {/* Sắp xếp: Mới nhất / Xem nhiều nhất */}
        <div className="flex gap-2">
          {SORTS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => { setSort(s.value); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-semibold border transition-colors ${
                sort === s.value
                  ? 'bg-tsubaki-red text-white border-tsubaki-red'
                  : 'bg-white border-outline-variant text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </form>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && <p className="text-center py-6 text-error text-sm">{error}</p>}

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">auto_stories</span>
          <p className="font-semibold text-on-surface mb-1">Chưa có bài đọc nào</p>
          <p className="text-on-muted text-sm">Thử bỏ bộ lọc hoặc nhập từ khóa khác</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`${linkBase}/${item.id}`)}
              className="text-left glass-card rounded-2xl overflow-hidden group cursor-pointer border-2 border-transparent hover:border-tsubaki-red hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative h-44 w-full overflow-hidden bg-surface-container shrink-0">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${LEVEL_GRADIENT[item.level] || 'from-tsubaki-red/10 to-sumire-purple/10'} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-6xl text-tsubaki-red/15">auto_stories</span>
                  </div>
                )}
                {item.level && (
                  <div className="absolute top-3 left-3 bg-tsubaki-red text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[item.level] || 'bg-white'}`} />
                    <span className="text-xs font-bold">{item.level}</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="font-display text-base font-bold text-on-surface mb-1 group-hover:text-tsubaki-red transition-colors line-clamp-2 leading-snug">
                  {item.title}
                </h3>
                {item.title_vi && (
                  <p className="text-sm text-tsubaki-red/80 font-medium mb-2 line-clamp-1">{item.title_vi}</p>
                )}
                {item.summary_vi && (
                  <p className="text-sm text-on-surface-variant leading-relaxed flex-grow line-clamp-3">
                    {item.summary_vi}
                  </p>
                )}

                {/* Meta: người đăng • ngày đăng • lượt xem */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-outline/30 text-xs text-on-muted">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <span className="material-symbols-outlined text-sm">person</span>
                    <span className="truncate">{item.author_name || 'Quản trị viên'}</span>
                  </span>
                  {item.published_at && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      {formatDate(item.published_at)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 shrink-0 ml-auto">
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    {item.view_count ?? 0}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {total > LIMIT && (
        <div className="flex justify-center items-center gap-2 mt-10">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            ← Trước
          </button>
          <span className="px-4 py-2.5 text-sm text-on-muted">
            Trang {page} / {Math.ceil(total / LIMIT)}
          </span>
          <button
            disabled={page * LIMIT >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            Tiếp →
          </button>
        </div>
      )}
    </Layout>
  );
}
