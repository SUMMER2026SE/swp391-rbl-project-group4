import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';
import { TOPICS, TOPIC_ICONS } from '../../lib/studyListTopics';

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];
const TYPE_ICON = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };
const ITEM_UNIT = { vocabulary: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LEVEL_BG = {
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

// Bản xem trước khi tạo mới — xem chi tiết đầy đủ (sửa thông tin, thêm/xóa
// mục, đổi ảnh...) đều làm trên trang bài đăng thật sau khi tạo xong.
function PostPreviewCard({ type, form }) {
  const post = { title: form.title || '(Chưa có tiêu đề)', level: form.level, topic: form.topic, item_count: 0, view_count: 0 };
  const headerIcon = post.topic ? (TOPIC_ICONS[post.topic] || TYPE_ICON[type]) : TYPE_ICON[type];
  return (
    <div className="rounded-2xl overflow-hidden glass-card border border-outline/30 w-56">
      <div className={`h-24 flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
        <span className="material-symbols-outlined text-4xl text-white/90">{headerIcon}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-charcoal text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{post.title}</h3>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
          {post.topic && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.topic}</span>}
          <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-on-muted">
          <span className="material-symbols-outlined text-sm">person</span>Kizuna Nihongo
        </div>
      </div>
    </div>
  );
}

export default function AdminStudyLists() {
  const navigate = useNavigate();
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ title: '', description: '', level: '', topic: '' });
  const [saving, setSaving] = useState(false);

  const [lockTarget, setLockTarget] = useState(null); // post đang chờ khóa (nhập ghi chú)
  const [lockNote, setLockNote]     = useState('');
  const [lockSaving, setLockSaving] = useState(false);

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

  const openCreate = () => {
    setForm({ title: '', description: '', level: '', topic: '' });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (type === 'vocabulary') {
      if (!form.topic) return setAlert({ type: 'error', msg: 'Vui lòng chọn chủ đề.' });
    } else if (!form.level) {
      return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    }
    setSaving(true);
    try {
      const r = await api.post('/study-lists', { list_type: type, title: form.title, description: form.description, level: form.level || null, topic: form.topic || null });
      setModal(false);
      navigate(`/study-lists/${type}/${r.data.id}`);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (post) => {
    const creatorName = post.creator?.name || post.creator?.email || 'giáo viên';
    if (!confirm(`Xóa bài đăng "${post.title}" của ${creatorName}?`)) return;
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
    <AdminLayout title="Bài đăng">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng</h1>
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
        <p className="text-sm text-on-muted">Tổng: <strong>{total}</strong> bài đăng (của giáo viên & Kizuna Nihongo)</p>
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
          <p className="text-sm">Bấm "Tạo bài đăng" để tự đăng, hoặc chờ giáo viên đăng bài</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {items.map(post => {
            const headerIcon = post.topic ? (TOPIC_ICONS[post.topic] || TYPE_ICON[type]) : TYPE_ICON[type];
            const creatorName = post.creator?.name || post.creator?.email || 'Không rõ';
            return (
              <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
                <div className={`w-12 h-12 rounded-lg shrink-0 flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
                  <span className="material-symbols-outlined text-white/90 text-xl">{headerIcon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-charcoal text-sm truncate flex items-center gap-1.5">
                    {post.title}
                    {post.is_locked && (
                      <span title={post.lock_note ? `Đã khóa: ${post.lock_note}` : 'Đã khóa'} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-error text-[10px] font-bold shrink-0">
                        <span className="material-symbols-outlined text-[12px]">lock</span>KHÓA
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-on-muted truncate">{[creatorName, post.topic, `${post.item_count} ${ITEM_UNIT[type]}`].filter(Boolean).join(' · ')}</p>
                </div>
                {post.level && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full shrink-0 ${LEVEL_BADGE[post.level]}`}>{post.level}</span>
                )}
                <span className="text-xs text-on-muted hidden sm:flex items-center gap-1 w-14 justify-end shrink-0" title="Lượt xem">
                  <span className="material-symbols-outlined text-[15px]">visibility</span>{post.view_count}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Link to={`/study-lists/${type}/${post.id}`} target="_blank" rel="noopener noreferrer" title="Xem như học viên"
                    className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                  </Link>
                  <Link to={`/study-lists/${type}/${post.id}`} title="Sửa"
                    className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </Link>
                  <button onClick={() => handleLockToggle(post)} title={post.is_locked ? 'Mở khóa' : 'Khóa (yêu cầu sửa)'}
                    className={`p-1.5 rounded-lg transition-colors ${post.is_locked ? 'text-error hover:bg-red-50' : 'text-on-muted hover:text-amber-600 hover:bg-amber-50'}`}>
                    <span className="material-symbols-outlined text-[18px]">{post.is_locked ? 'lock_open' : 'lock'}</span>
                  </button>
                  <button onClick={() => handleDelete(post)} title="Xóa"
                    className="p-1.5 text-on-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Tạo bài đăng" size="lg"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Tạo</Button></>}>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 space-y-4 min-w-0">
            <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
            <div className="flex flex-col gap-4">
              <div className={type === 'vocabulary' ? 'order-2' : 'order-1'}>
                <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{type === 'vocabulary' ? '' : ' *'}</label>
                <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
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
                <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                  <option value="">-- Không chọn --</option>
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <Input label="Mô tả" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <p className="text-xs text-on-muted">Sau khi tạo, bạn sẽ được chuyển tới trang bài đăng để thêm từ vựng, ảnh minh họa...</p>
          </div>
          <div className="shrink-0 sm:w-56 sm:pl-6 sm:border-l border-outline/30">
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-2">Xem trước</p>
            <PostPreviewCard type={type} form={form} />
          </div>
        </div>
      </Modal>

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
    </AdminLayout>
  );
}
