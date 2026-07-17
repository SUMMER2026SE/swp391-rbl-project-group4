import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import TeacherLayout from '../../components/layout/TeacherLayout';
import AdminLayout from '../../components/layout/AdminLayout';
import Alert from '../../components/ui/Alert';
import GrammarItemDetailCard from '../../components/shared/GrammarItemDetailCard';
import { useAuth } from '../../contexts/AuthContext';
import { usePageContext } from '../../contexts/PageContext';
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
  const { user, isAdmin, isTeacher } = useAuth();
  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Dùng layout theo đúng vai trò người xem — teacher/admin xem không bị đổi
  // sang giao diện học viên.
  const Layout = isAdmin() ? AdminLayout : isTeacher() ? TeacherLayout : StudentLayout;

  useEffect(() => {
    setLoading(true);
    api.get(`/study-lists/${id}`)
      .then(r => setPost(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Chỉ chủ bài đăng mới sửa được nội dung — xem lý do ở StudyListDetail.jsx.
  const canEdit = !!user && !!post && user.id === post.created_by;
  const items = post?.items || [];
  const index = items.findIndex(i => i.id === itemId);
  const item = index >= 0 ? items[index] : null;

  const goTo = (i) => {
    if (i >= 0 && i < items.length) navigate(`/study-lists/${type}/${id}/${items[i].id}`);
  };

  // Cho trợ lý AI biết đang xem mục nào (nội dung đầy đủ để AI giải thích ngay)
  usePageContext({
    tab: type === 'grammar' ? 'Chi tiết ngữ pháp' : type === 'kanji' ? 'Chi tiết kanji' : 'Chi tiết từ vựng',
    title: item?.title,
    data: item ? {
      post: post?.title, level: item.level, viTri: `${index + 1}/${items.length}`,
      title: item.title, title_ja: item.title_ja,
      meaning_vi: item.meaning_vi,
      explanation: item.explanation,
      example_sentence: item.example_sentence,
    } : null,
  }, [item, post]);

  const saveGrammarItem = async (patch) => {
    await api.put(`/teacher/grammar-points/${itemId}`, patch);
    setPost(p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, ...patch } : it) }));
  };

  return (
    <Layout title={post?.title || 'Chi tiết ngữ pháp'}>
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
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Danh sách mẫu ngữ pháp bên trái — bấm để nhảy tới mục đó */}
          <aside className="lg:w-64 shrink-0">
            <div className="glass-card rounded-2xl p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto scrollbar-thin">
              <p className="px-2 py-1.5 text-xs font-semibold text-on-muted uppercase tracking-wide">Danh sách mẫu ({items.length})</p>
              <div className="space-y-0.5">
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    onClick={() => goTo(i)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${i === index ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'text-on-muted hover:bg-surface-low'}`}
                  >
                    <span className="shrink-0 w-5 text-[11px] text-on-muted/70">{i + 1}.</span>
                    <span className="flex-1 min-w-0 truncate">{it.title}</span>
                    {it.level && <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[it.level] || 'bg-surface-low text-on-muted'}`}>{it.level}</span>}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <GrammarItemDetailCard item={item} index={index} total={items.length}
              onPrev={() => goTo(index - 1)} onNext={() => goTo(index + 1)}
              editable={canEdit} onSave={saveGrammarItem} />
          </div>
        </div>
      )}
    </Layout>
  );
}
