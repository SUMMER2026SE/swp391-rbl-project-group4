import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { TOPICS, TOPIC_ICONS } from '../../lib/studyListTopics';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';

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

// Nhóm danh sách bài đăng theo chủ đề (giữ thứ tự chủ đề cố định), bài chưa gắn
// chủ đề nào rơi vào nhóm "Khác" ở cuối.
function groupByTopic(posts) {
  const groups = TOPICS
    .map(t => ({ key: t, label: t, icon: TOPIC_ICONS[t], items: posts.filter(p => p.topic === t) }))
    .filter(g => g.items.length > 0);
  const rest = posts.filter(p => !p.topic || !TOPICS.includes(p.topic));
  if (rest.length > 0) groups.push({ key: '__other', label: '', icon: '', items: rest });
  return groups;
}

function PostCard({ post, type, onClick }) {
  const headerIcon = post.topic ? (TOPIC_ICONS[post.topic] || TYPE_ICON[type]) : TYPE_ICON[type];
  const isFree = post.creator_type === 'admin';
  return (
    <div
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden glass-card hover:shadow-lg hover:-translate-y-0.5 border border-transparent hover:border-tsubaki-red/30 transition-all cursor-pointer"
    >
      <div className={`h-24 relative flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
        <span className="material-symbols-outlined text-4xl text-white/90">{headerIcon}</span>
        <span className={`absolute top-2 right-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm ${isFree ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-amber-900'}`}>
          {!isFree && <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>lock</span>}
          {isFree ? 'Miễn phí' : 'Premium'}
        </span>
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

function PremiumGateModal({ post, onClose }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
        <span className="material-symbols-outlined text-5xl text-amber-400">lock</span>
        <h2 className="font-display text-xl font-bold mt-2 mb-1">Nội dung Premium</h2>
        <p className="text-on-muted text-sm mb-5">
          Bài đăng <strong>"{post?.title}"</strong> được tạo bởi giáo viên và chỉ dành cho thành viên Premium.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-outline rounded-xl text-sm font-semibold text-on-muted hover:bg-surface-low transition-colors"
          >
            Để sau
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="flex-1 px-4 py-2 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Nâng cấp Premium
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupSection({ label, icon, items, type, onCardClick }) {
  return (
    <div className="mb-5 last:mb-0">
      {label && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-slate-100 text-slate-700">
            {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
            {label}
          </span>
          <span className="text-sm text-on-muted">{items.length} bài đăng</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(post => (
          <PostCard key={post.id} post={post} type={type} onClick={() => onCardClick(post)} />
        ))}
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

function SortToggle({ sort, setSort }) {
  return (
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
  );
}

function AccessTypeToggle({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[['', 'Tất cả'], ['free', 'Miễn phí'], ['premium', 'Có phí']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${value === key ? 'bg-charcoal text-white' : 'bg-white border border-outline text-on-muted hover:border-charcoal'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Toàn bộ khu vực "Bài đăng" — nhúng thẳng vào trang Từ vựng/Kanji/Ngữ pháp.
// Từ vựng: chủ đề là bộ lọc chính, liệt kê thành khung bên trái cho dễ chọn
// (giống trang tham khảo) — vì cùng 1 chủ đề thường có từ ở nhiều cấp độ khác
// nhau, việc lọc theo cấp độ chuyển vào bên trong từng bài khi xem từng từ.
// Kanji/Ngữ pháp: chưa có nội dung theo chủ đề nên vẫn giữ cấp độ làm bộ lọc
// chính (dải nút phía trên), chủ đề nhóm phụ bên trong, như trước.
export default function StudyListPreview({ type }) {
  const navigate = useNavigate();
  const { isAdmin, isTeacher } = useAuth();
  const { data: subData } = useSubscription();
  const isTopicPrimary = type === 'vocabulary';
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [level, setLevel]       = useState('');
  const [topic, setTopic]       = useState('');
  const [sort, setSort]         = useState('newest');
  const [accessType, setAccessType] = useState('');
  const [gatedPost, setGatedPost]   = useState(null);

  const isPremium = subData?.subscription?.plan?.tier === 'premium';
  // Giáo viên/admin luôn xem được; học viên cần premium mới xem bài của giáo viên.
  const canViewTeacherPost = isAdmin() || isTeacher() || isPremium;

  const handleCardClick = (post) => {
    if (post.creator_type === 'teacher' && !canViewTeacherPost) {
      setGatedPost(post);
      return;
    }
    navigate(`/study-lists/${type}/${post.id}`);
  };

  const fetchPosts = useCallback(async (l, tp, s, se, at) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type, sort: s, page: 1, limit: 100 });
      if (l)  params.set('level', l);
      if (tp) params.set('topic', tp);
      if (se) params.set('search', se);
      if (at) params.set('access_type', at);
      const r = await api.get(`/study-lists?${params}`);
      setPosts(r.data.data || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchPosts(level, topic, sort, search, accessType); }, [level, topic, sort, type, accessType]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPosts(level, topic, sort, search, accessType);
  };

  const activeFilter = isTopicPrimary ? topic : level;

  const groupedByLevel = LEVELS
    .map(l => ({ level: l, items: posts.filter(p => p.level === l) }))
    .filter(g => g.items.length > 0);

  const content = loading ? (
    <Skeleton />
  ) : posts.length === 0 ? (
    <div className="glass-card rounded-2xl p-8 text-center text-on-muted text-sm">
      {search || activeFilter ? 'Không tìm thấy bài đăng.' : 'Chưa có bài đăng nào cho mục này.'}
    </div>
  ) : isTopicPrimary ? (
    // Từ vựng: cả khi chọn 1 chủ đề lẫn "Tất cả" đều hiện 1 lưới phẳng, chảy
    // trái sang phải trên xuống dưới — không chia thành từng khối theo chủ đề.
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {posts.map(post => <PostCard key={post.id} post={post} type={type} onClick={() => handleCardClick(post)} />)}
    </div>
  ) : activeFilter ? (
    // Kanji/Ngữ pháp: cấp độ là bộ lọc chính — đã chọn 1 cấp độ, nhóm theo chủ đề bên trong.
    <div>
      {groupByTopic(posts).map(g => <GroupSection key={g.key} label={g.label} icon={g.icon} items={g.items} type={type} onCardClick={handleCardClick} />)}
    </div>
  ) : (
    <div className="space-y-8">
      {groupedByLevel.map(lg => (
        <div key={lg.level}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${LEVEL_BADGE[lg.level]}`}>{lg.level}</span>
            <span className="text-sm text-on-muted">{lg.items.length} bài đăng</span>
          </div>
          {groupByTopic(lg.items).map(g => <GroupSection key={g.key} label={g.label} icon={g.icon} items={g.items} type={type} onCardClick={handleCardClick} />)}
        </div>
      ))}
    </div>
  );

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

      {isTopicPrimary ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Khung chủ đề bên trái — chọn 1 lần, dễ nhìn hơn dải nút cuộn ngang */}
          <aside className="lg:w-64 shrink-0">
            <div className="glass-card rounded-2xl p-3 lg:sticky lg:top-4">
              <p className="px-3 py-2 text-xs font-semibold text-on-muted uppercase tracking-wide">Chủ đề</p>
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                <button
                  onClick={() => setTopic('')}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${!topic ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'text-on-muted hover:bg-surface-low'}`}
                >
                  <span className="material-symbols-outlined text-lg">apps</span> Tất cả
                </button>
                {TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${topic === t ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'text-on-muted hover:bg-surface-low'}`}
                  >
                    <span className="material-symbols-outlined text-lg">{TOPIC_ICONS[t]}</span> {t}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap justify-end items-center gap-3 mb-4">
              <AccessTypeToggle value={accessType} onChange={setAccessType} />
              <SortToggle sort={sort} setSort={setSort} />
            </div>
            {content}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <div className="flex flex-wrap items-center gap-3">
                <AccessTypeToggle value={accessType} onChange={setAccessType} />
                <SortToggle sort={sort} setSort={setSort} />
              </div>
            </div>
          </div>
          {content}
        </>
      )}
    </div>

    {gatedPost && <PremiumGateModal post={gatedPost} onClose={() => setGatedPost(null)} />}
  );
}
