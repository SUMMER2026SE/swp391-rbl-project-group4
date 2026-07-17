import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import VocabWordViewer from './VocabWordViewer';
import { TOPIC_ICONS } from '../../lib/studyListTopics';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

// Xem trước 1 bài đăng chỉ-đọc ngay trong trang quản lý (Admin/Teacher) — không
// điều hướng sang route khác nên không đổi layout, không mở tab, không có cảm
// giác "nhảy sang tài khoản học viên". Dùng cho nút "mắt" ở danh sách bài đăng.
export default function StudyListPreviewModal({ open, onClose, postId }) {
  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open || !postId) return;
    setLoading(true);
    setError('');
    setPost(null);
    api.get(`/study-lists/${postId}`)
      .then(r => setPost(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, postId]);

  return (
    <Modal open={open} onClose={onClose} title="Xem trước bài đăng" size="xl">
      {loading ? (
        <div className="text-center text-on-muted py-12 animate-pulse">Đang tải...</div>
      ) : error ? (
        <div className="text-center text-error py-12">{error}</div>
      ) : !post ? (
        <div className="text-center text-on-muted py-12">Không tìm thấy bài đăng.</div>
      ) : (
        <div>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold mb-1">{post.title}</h1>
            {post.description && <p className="text-on-muted mb-2">{post.description}</p>}
            <div className="flex items-center gap-4 text-sm text-on-muted flex-wrap">
              {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[post.level] || 'bg-surface-low text-on-muted'}`}>{post.level}</span>}
              {post.topic && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.topic}</span>}
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">person</span>{post.creator_name || '—'}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">bookmarks</span>{post.items.length} mục</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">visibility</span>{post.view_count} lượt xem</span>
            </div>
          </div>

          {post.items.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Bài đăng này chưa có mục nào.</div>
          ) : post.list_type === 'vocabulary' ? (
            <VocabWordViewer items={post.items} icon={(post.topic && TOPIC_ICONS[post.topic]) || 'translate'} />
          ) : post.list_type === 'kanji' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {post.items.map(item => (
                <div key={item.id} className="glass-card rounded-2xl p-5 text-center">
                  <p className="text-4xl font-bold text-tsubaki-red mb-1">{item.character}</p>
                  <p className="text-xs text-on-muted">On: {(item.reading_on || []).join('、') || '—'}</p>
                  <p className="text-xs text-on-muted">Kun: {(item.reading_kun || []).join('、') || '—'}</p>
                  {item.han_viet && <p className="text-xs text-amber-600 font-medium mt-0.5">Hán Việt: {item.han_viet}</p>}
                  <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
                  {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-outline">
              {post.items.map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 h-6 rounded-full bg-charcoal/80 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="flex-1 font-bold text-tsubaki-red min-w-0 truncate">
                    {item.title}
                    {item.meaning_vi && <span className="font-normal text-on-muted"> — {item.meaning_vi}</span>}
                  </p>
                  {item.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
