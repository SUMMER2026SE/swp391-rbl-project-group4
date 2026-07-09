import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

function NumberBadge({ n }) {
  return (
    <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-charcoal/80 text-white text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

function ItemCard({ item, listType, index, type, postId }) {
  if (listType === 'vocabulary') {
    return (
      <div className="relative glass-card rounded-2xl p-5 pt-8 text-center">
        <NumberBadge n={index + 1} />
        <FuriganaText text={item.kanji || item.reading} textClassName="text-2xl font-bold text-tsubaki-red mb-1" />
        {item.kanji && <p className="text-sm text-on-muted">{item.reading}</p>}
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  if (listType === 'kanji') {
    return (
      <div className="relative glass-card rounded-2xl p-5 pt-8 text-center">
        <NumberBadge n={index + 1} />
        <p className="text-4xl font-bold text-tsubaki-red mb-1">{item.character}</p>
        <p className="text-xs text-on-muted">On: {(item.reading_on || []).join('、') || '—'}</p>
        <p className="text-xs text-on-muted">Kun: {(item.reading_kun || []).join('、') || '—'}</p>
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  // grammar — thẻ gọn, bấm vào mở trang chi tiết riêng (URL thật, back trình duyệt hoạt động đúng)
  return (
    <Link
      to={`/study-lists/${type}/${postId}/${item.id}`}
      className="relative glass-card rounded-2xl p-5 pt-8 block hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all"
    >
      <NumberBadge n={index + 1} />
      <p className="text-xl font-bold text-tsubaki-red">{item.title}</p>
      {item.title_ja && <p className="text-sm text-on-muted">{item.title_ja}</p>}
      <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
      <div className="flex items-center justify-between mt-3">
        {item.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
        <span className="flex items-center gap-1 text-xs text-tsubaki-red font-semibold ml-auto">
          Xem chi tiết <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </span>
      </div>
    </Link>
  );
}

export default function StudyListDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/study-lists/${id}`)
      .then(r => setPost(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <StudentLayout title="Chi tiết bài đăng">
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <button onClick={() => navigate(`/${type}`)} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4 transition-colors">
        <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại danh sách
      </button>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : !post ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted">Không tìm thấy bài đăng.</div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold mb-1">{post.title}</h1>
            {post.description && <p className="text-on-muted mb-2">{post.description}</p>}
            <div className="flex items-center gap-4 text-sm text-on-muted flex-wrap">
              {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[post.level] || 'bg-surface-low text-on-muted'}`}>{post.level}</span>}
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">person</span>{post.creator_name || '—'}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">bookmarks</span>{post.items.length} mục</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">visibility</span>{post.view_count} lượt xem</span>
            </div>
          </div>

          {post.items.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Bài đăng này chưa có mục nào.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {post.items.map((item, i) => (
                <ItemCard key={item.id} item={item} listType={post.list_type} index={i} type={type} postId={id} />
              ))}
            </div>
          )}
        </>
      )}
    </StudentLayout>
  );
}
