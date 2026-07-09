import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

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
        <div className="glass-card rounded-3xl overflow-hidden max-w-2xl">
          <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />

          <div className="px-8 pt-8 pb-2">
            <div className="flex items-center gap-2 mb-3">
              {item.level && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>
                  {item.level}
                </span>
              )}
              <span className="text-xs text-on-muted">Mục {index + 1}/{items.length}</span>
            </div>
            <h1 className="text-3xl font-bold text-tsubaki-red leading-tight">{item.title}</h1>
            {item.title_ja && <p className="text-on-muted mt-1">{item.title_ja}</p>}

            <div className="mt-6">
              <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa</p>
              <p className="text-lg font-bold text-charcoal">{item.meaning_vi}</p>
            </div>

            {item.explanation && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Cấu trúc / Cách dùng</p>
                <p className="text-charcoal whitespace-pre-wrap leading-relaxed">{item.explanation}</p>
              </div>
            )}

            {item.example_sentence && (
              <div className="mt-6 mb-2">
                <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Ví dụ</p>
                <div className="text-charcoal italic bg-surface-low rounded-xl px-4 py-3">
                  「<FuriganaText text={item.example_sentence} textClassName="italic" />」
                </div>
              </div>
            )}
          </div>

          <div className="px-8 pb-8 pt-6 flex gap-2 border-t border-outline/30 mt-4">
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
            </button>
            <button
              onClick={() => goTo(index + 1)}
              disabled={index === items.length - 1}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
            >
              Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
