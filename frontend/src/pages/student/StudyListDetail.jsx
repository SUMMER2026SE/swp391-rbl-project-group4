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

function ItemCard({ item, listType }) {
  if (listType === 'vocabulary') {
    return (
      <div className="glass-card rounded-2xl p-5 text-center">
        <FuriganaText text={item.kanji || item.reading} textClassName="text-2xl font-bold text-tsubaki-red mb-1" />
        {item.kanji && <p className="text-sm text-on-muted">{item.reading}</p>}
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  if (listType === 'kanji') {
    return (
      <div className="glass-card rounded-2xl p-5 text-center">
        <p className="text-4xl font-bold text-tsubaki-red mb-1">{item.character}</p>
        <p className="text-xs text-on-muted">On: {(item.reading_on || []).join('、') || '—'}</p>
        <p className="text-xs text-on-muted">Kun: {(item.reading_kun || []).join('、') || '—'}</p>
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  // grammar
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-xl font-bold text-tsubaki-red">{item.title}</p>
      {item.title_ja && <p className="text-sm text-on-muted">{item.title_ja}</p>}
      <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
      {item.explanation && <p className="text-sm text-charcoal mt-2 whitespace-pre-wrap">{item.explanation}</p>}
      {item.example_sentence && (
        <div className="text-sm text-charcoal italic bg-surface-low rounded-xl px-4 py-3 mt-3">
          「<FuriganaText text={item.example_sentence} textClassName="text-sm text-charcoal italic" />」
        </div>
      )}
      {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
    </div>
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

      <button onClick={() => navigate(`/study-lists/${type}`)} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4 transition-colors">
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
            <div className="flex items-center gap-4 text-sm text-on-muted">
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">person</span>{post.creator_name || '—'}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">bookmarks</span>{post.items.length} mục</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">visibility</span>{post.view_count} lượt xem</span>
            </div>
          </div>

          {post.items.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Bài đăng này chưa có mục nào.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {post.items.map(item => <ItemCard key={item.id} item={item} listType={post.list_type} />)}
            </div>
          )}
        </>
      )}
    </StudentLayout>
  );
}
