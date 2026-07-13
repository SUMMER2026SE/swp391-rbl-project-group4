import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import GrammarItemDetailCard from '../../components/shared/GrammarItemDetailCard';
import api from '../../lib/api';

// Chi tiết 1 mẫu ngữ pháp trong Mục của khóa học (phía học sinh) — prev/next
// trong phạm vi Mục, thẻ dùng chung với Study List. Data lấy từ GET /lessons/:id
// (đã kèm grammar_points + kiểm tra paywall ở backend).
export default function LessonGrammarItemDetail() {
  const { lessonId, itemId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/lessons/${lessonId}`)
      .then(r => setLesson(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const items = lesson?.grammar_points || [];
  const index = items.findIndex(i => i.id === itemId);
  const item = index >= 0 ? items[index] : null;

  const goTo = (i) => {
    if (i >= 0 && i < items.length) navigate(`/lessons/${lessonId}/grammar/${items[i].id}`);
  };

  return (
    <StudentLayout title={lesson?.title || 'Chi tiết ngữ pháp'}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <button
        onClick={() => navigate(`/lessons/${lessonId}`)}
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
    </StudentLayout>
  );
}
