import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Alert from '../../components/ui/Alert';
import GrammarItemDetailCard from '../../components/shared/GrammarItemDetailCard';
import api from '../../lib/api';

// Chi tiết 1 mẫu ngữ pháp trong Mục — bản xem trước cho admin/teacher,
// prev/next trong phạm vi Mục (thẻ dùng chung với Study List).
export default function AdminLessonGrammarItem() {
  const { lessonId, itemId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]   = useState(null);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`${apiBase}/lessons/${lessonId}`),
      api.get(`${apiBase}/grammar-points?lesson_id=${lessonId}`),
    ])
      .then(([lessonRes, grammarRes]) => {
        setLesson(lessonRes.data);
        setItems(grammarRes.data.data || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const index = items.findIndex(i => i.id === itemId);
  const item = index >= 0 ? items[index] : null;

  const goTo = (i) => {
    if (i >= 0 && i < items.length) navigate(`${apiBase}/lessons/${lessonId}/grammar/${items[i].id}`);
  };

  return (
    <Layout title={lesson?.title || 'Chi tiết ngữ pháp'}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <button
        onClick={() => navigate(`${apiBase}/lessons/${lessonId}/grammar`)}
        className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại "{lesson?.title || 'bài học'}"
      </button>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : !item ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted">Không tìm thấy mục này.</div>
      ) : (
        <GrammarItemDetailCard item={item} index={index} total={items.length}
          onPrev={() => goTo(index - 1)} onNext={() => goTo(index + 1)} />
      )}
    </Layout>
  );
}
