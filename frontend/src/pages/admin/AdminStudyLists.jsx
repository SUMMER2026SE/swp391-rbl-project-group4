import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import StudyListPreviewModal from '../../components/shared/StudyListPreviewModal';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { TOPICS } from '../../lib/studyListTopics';
import {
  PostPreviewCard, ItemPickerContent,
  ITEM_UNIT, LEVELS, LEVEL_BG, LEVEL_BADGE,
} from '../../components/shared/StudyListPostEditor';

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];

// Admin xem/kiểm duyệt bài đăng của giáo viên (xem trước, khóa yêu cầu sửa,
// xóa) — KHÔNG tự sửa nội dung thay giáo viên. Muốn yêu cầu sửa thì khóa bài
// kèm ghi chú, giáo viên tự vào sửa (giữ quyền tác giả của họ).
// Riêng bài do CHÍNH admin đăng thì admin có toàn quyền CRUD (tạo/sửa/xóa),
// giống hệt luồng giáo viên — xem loadOwnedPost ở studyListController.js.
export default function AdminStudyLists() {
  const { user } = useAuth();
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [lockTarget, setLockTarget] = useState(null); // post đang chờ khóa (nhập ghi chú)
  const [lockNote, setLockNote]     = useState('');
  const [lockSaving, setLockSaving] = useState(false);

  const [previewId, setPreviewId] = useState(null); // post đang xem trước (modal chỉ đọc)

  // Tạo/sửa bài đăng của chính admin
  const [postModal, setPostModal] = useState(false);
  const [postTab, setPostTab]     = useState('info');
  const [postForm, setPostForm]   = useState({ title: '', description: '', level: '', topic: '' });
  const [postId, setPostId]       = useState(null);   // null = đang tạo mới
  const [postBase, setPostBase]   = useState(null);   // dữ liệu post hiện có, dùng cho preview
  const [postSaving, setPostSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/study-lists?type=${type}&limit=100`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (post) => {
    const teacherName = post.creator?.name || post.creator?.email || 'giáo viên';
    if (!confirm(`Xóa bài đăng "${post.title}" của ${teacherName}?`)) return;
    try { await api.delete(`/study-lists/${post.id}`); load(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  // Mở khóa: không cần ghi chú, thực hiện ngay. Khóa: mở modal nhập lý do.
  const handleLockToggle = (post) => {
    if (post.is_locked) return doLock(post, false, '');
    setLockNote('');
    setLockTarget(post);
  };

  const doLock = async (post, locked, note) => {
    setLockSaving(true);
    try {
      await api.put(`/admin/study-lists/${post.id}/lock`, { locked, note });
      setLockTarget(null);
      load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLockSaving(false); }
  };

  const openCreate = () => {
    setPostForm({ title: '', description: '', level: '', topic: '' });
    setPostId(null); setPostBase(null); setPostTab('info');
    setPostModal(true);
  };

  const openEdit = (post) => {
    setPostForm({ title: post.title, description: post.description || '', level: post.level || '', topic: post.topic || '' });
    setPostId(post.id); setPostBase(post); setPostTab('info');
    setPostModal(true);
  };

  const handleSavePost = async () => {
    if (!postForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (type === 'vocabulary') {
      if (!postForm.topic) return setAlert({ type: 'error', msg: 'Vui lòng chọn chủ đề.' });
    } else if (!postForm.level) {
      return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    }
    const wasCreate = !postId;
    setPostSaving(true);
    try {
      const payload = { title: postForm.title, description: postForm.description, level: postForm.level || null, topic: postForm.topic || null };
      if (wasCreate) {
        const r = await api.post('/study-lists', { list_type: type, ...payload });
        setPostId(r.data.id);
        setPostBase(r.data);
        setPostTab('items');
      } else {
        await api.put(`/study-lists/${postId}`, payload);
        setPostModal(false);
      }
      await load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setPostSaving(false); }
  };

  return (
    <AdminLayout title="Bài đăng của giáo viên">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng của giáo viên</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {TYPES.map(([key, icon, label]) => (
            <button key={key} onClick={() => setType(key)}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${type === key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-on-muted">Tổng: <strong>{total}</strong> bài đăng</p>
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Tạo bài đăng</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">library_books</span>
          <p className="text-lg font-semibold text-charcoal mb-1">Chưa có bài đăng nào</p>
          <p className="text-sm">Chờ giáo viên đăng bài</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-outline/40">
          {items.map(post => (
            <div
              key={post.id}
              onClick={() => setPreviewId(post.id)}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none transition-colors hover:bg-surface-low/50"
            >
              {/* Level color bar */}
              <div className={`w-1 h-11 rounded-full shrink-0 ${LEVEL_BG[post.level] || 'bg-gradient-to-b from-slate-300 to-slate-400'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate flex items-center gap-1.5">
                  {post.title}
                  {post.is_locked && (
                    <span title={post.lock_note ? `Đã khóa: ${post.lock_note}` : 'Đã khóa'} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-error text-[10px] font-bold shrink-0">
                      <span className="material-symbols-outlined text-[12px]">lock</span>KHÓA
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
                  {post.topic && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{post.topic}</span>}
                  <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
                  <span className="flex items-center gap-0.5 text-xs text-on-muted">
                    <span className="material-symbols-outlined text-[14px]">visibility</span>{post.view_count}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-on-muted">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {post.creator?.name || post.creator?.email || '—'}
                  </span>
                </div>
              </div>

              {/* Actions — stopPropagation to not trigger row preview twice */}
              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => setPreviewId(post.id)} title="Xem trước (chỉ đọc)"
                  className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </button>
                {post.created_by === user?.id && (
                  <button onClick={() => openEdit(post)} title="Sửa bài đăng của bạn"
                    className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                )}
                <button onClick={() => handleLockToggle(post)} title={post.is_locked ? 'Mở khóa' : 'Khóa (yêu cầu sửa)'}
                  className={`p-1.5 rounded-lg transition-colors ${post.is_locked ? 'text-error hover:bg-red-50' : 'text-on-muted hover:text-amber-600 hover:bg-amber-50'}`}>
                  <span className="material-symbols-outlined text-lg">{post.is_locked ? 'lock_open' : 'lock'}</span>
                </button>
                <button onClick={() => handleDelete(post)} title="Xóa"
                  className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!lockTarget} onClose={() => setLockTarget(null)} title="Khóa bài đăng"
        footer={<><Button variant="secondary" onClick={() => setLockTarget(null)}>Huỷ</Button><Button loading={lockSaving} onClick={() => doLock(lockTarget, true, lockNote)}>Khóa bài đăng</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-on-muted">
            Bài đăng <strong className="text-charcoal">"{lockTarget?.title}"</strong> sẽ bị ẩn khỏi học viên.
            Giáo viên vẫn xem và sửa được bình thường để khắc phục theo ghi chú dưới đây.
          </p>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Ghi chú cho giáo viên (lý do cần sửa)</label>
            <textarea value={lockNote} onChange={e => setLockNote(e.target.value)} rows={3}
              placeholder="vd: Một số từ vựng thiếu nghĩa tiếng Việt, vui lòng bổ sung."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
          </div>
        </div>
      </Modal>

      <StudyListPreviewModal open={!!previewId} onClose={() => setPreviewId(null)} postId={previewId} />

      <Modal open={postModal} onClose={() => setPostModal(false)} title={postId ? 'Sửa bài đăng' : 'Tạo bài đăng'} size="xl"
        footer={
          postTab === 'items'
            ? <Button variant="secondary" onClick={() => setPostModal(false)}>Đóng</Button>
            : <><Button variant="secondary" onClick={() => setPostModal(false)}>Huỷ</Button><Button loading={postSaving} onClick={handleSavePost}>{postId ? 'Lưu' : 'Tạo'}</Button></>
        }>

        {postId && (
          <div className="flex border-b border-outline/40 mb-5">
            {[['info', 'Thông tin'], ['items', 'Quản lý mục']].map(([tab, label]) => (
              <button key={tab} onClick={() => setPostTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${postTab === tab ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {postTab === 'info' && (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-4 min-w-0">
              <Input label="Tiêu đề *" value={postForm.title} onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
              <div className="flex flex-col gap-4">
                <div className={type === 'vocabulary' ? 'order-2' : 'order-1'}>
                  <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{type === 'vocabulary' ? '' : ' *'}</label>
                  <select value={postForm.level} onChange={e => setPostForm({ ...postForm, level: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                    <option value="">-- Chọn cấp độ --</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {type === 'vocabulary' && (
                    <p className="text-xs text-on-muted mt-1">Không bắt buộc — 1 chủ đề thường có từ ở nhiều cấp độ, cấp độ sẽ lọc bên trong khi xem từng từ.</p>
                  )}
                </div>
                <div className={type === 'vocabulary' ? 'order-1' : 'order-2'}>
                  <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{type === 'vocabulary' ? ' *' : ''}</label>
                  <select value={postForm.topic} onChange={e => setPostForm({ ...postForm, topic: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                    <option value="">-- Không chọn --</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <Input label="Mô tả" value={postForm.description} onChange={e => setPostForm({ ...postForm, description: e.target.value })} />
            </div>
            <div className="shrink-0 sm:w-80 sm:pl-6 sm:border-l border-outline/30 flex flex-col">
              <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-4">Xem trước</p>
              <div className="flex justify-center">
                <PostPreviewCard type={type} form={postForm} base={postBase} />
              </div>
              <p className="text-xs text-on-muted/60 text-center mt-3">Cập nhật theo thời gian thực</p>
            </div>
          </div>
        )}

        {postTab === 'items' && postId && (
          <ItemPickerContent post={{ id: postId }} listType={type} onChanged={load} />
        )}
      </Modal>
    </AdminLayout>
  );
}
