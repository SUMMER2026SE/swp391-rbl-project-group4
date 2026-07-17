import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import StudyListPreviewModal from '../../components/shared/StudyListPreviewModal';
import api from '../../lib/api';

const TYPE_ICON  = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };
const ITEM_UNIT  = { vocabulary: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };
const LEVEL_BG   = {
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

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];

// Admin chỉ xem/kiểm duyệt bài đăng của giáo viên (xem trước, khóa yêu cầu sửa,
// xóa) — KHÔNG tự sửa nội dung thay giáo viên. Muốn yêu cầu sửa thì khóa bài
// kèm ghi chú, giáo viên tự vào sửa (giữ quyền tác giả của họ).
export default function AdminStudyLists() {
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [lockTarget, setLockTarget] = useState(null); // post đang chờ khóa (nhập ghi chú)
  const [lockNote, setLockNote]     = useState('');
  const [lockSaving, setLockSaving] = useState(false);

  const [previewId, setPreviewId] = useState(null); // post đang xem trước (modal chỉ đọc)

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

      <p className="text-sm text-on-muted mb-4">Tổng: <strong>{total}</strong> bài đăng</p>

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
    </AdminLayout>
  );
}
