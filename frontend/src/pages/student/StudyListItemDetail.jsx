import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import GrammarItemDetailCard from '../../components/shared/GrammarItemDetailCard';
import api from '../../lib/api';

// Trang chi tiết 1 mẫu ngữ pháp trong bài đăng — URL riêng, nút Back trình
// duyệt hoạt động đúng (không phải popup/modal).
export default function StudyListItemDetail() {
  const { type, id, itemId } = useParams();
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

  const items = post?.items || [];
  const index = items.findIndex(i => i.id === itemId);
  const item = index >= 0 ? items[index] : null;

  const goTo = (i) => {
    if (i >= 0 && i < items.length) navigate(`/study-lists/${type}/${id}/${items[i].id}`);
  };

  return (
    <StudentLayout title={post?.title || 'Chi tiết ngữ pháp'}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <button
        onClick={() => navigate(`/study-lists/${type}/${id}`)}
        className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại "{post?.title || 'bài đăng'}"
      </button>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : !item ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted">Không tìm thấy mục này.</div>
      ) : (
        <div className="flex justify-center">
          <GrammarItemDetailCard item={item} index={index} total={items.length}
            onPrev={() => goTo(index - 1)} onNext={() => goTo(index + 1)} />
        </div>
      )}
    </StudentLayout>
  );
}
