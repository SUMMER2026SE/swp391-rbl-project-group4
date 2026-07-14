import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
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

// Bản xem trước bài đăng khi tạo mới — cập nhật theo thời gian thực khi giáo
// viên gõ form, dùng đúng giao diện thẻ bài đăng thật (StudyListPreview).
// Sau khi tạo xong, mọi thao tác khác (thêm/sửa/xóa mục, đổi ảnh, sửa thông
// tin...) đều làm trực tiếp trên trang bài đăng thật (bấm "Xem trang").
function PostPreviewCard({ type, form }) {
  const post = {
    title: form.title || '(Chưa có tiêu đề)',
    level: form.level,
    topic: form.topic,
    item_count: 0,
    view_count: 0,
    creator_name: 'Bạn',
  };
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
        <div className="flex items-center justify-between text-xs text-on-muted">
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-sm">person</span>{post.creator_name}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm">visibility</span>{post.view_count}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TeacherStudyLists() {
  const navigate = useNavigate();
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ title: '', description: '', level: '', topic: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/study-lists?type=${type}&mine=true&limit=100`);
      setItems(r.data.data || []);
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
      // Mọi thao tác tiếp theo (thêm mục, sửa thông tin, đổi ảnh...) làm ngay trên trang thật.
      navigate(`/study-lists/${type}/${r.data.id}`);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (post) => {
    if (!confirm(`Xóa bài đăng "${post.title}"?`)) return;
    try { await api.delete(`/study-lists/${post.id}`); load(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  return (
    <TeacherLayout title="Bài đăng danh sách">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng danh sách</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {TYPES.map(([key, icon, label]) => (
            <button key={key} onClick={() => setType(key)}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${type === key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Tạo bài đăng</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">library_books</span>
          <p className="text-lg font-semibold text-charcoal mb-1">Bạn chưa tạo bài đăng nào cho mục này</p>
          <p className="text-sm">Bấm "Tạo bài đăng" để bắt đầu</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {items.map(post => {
            const headerIcon = post.topic ? (TOPIC_ICONS[post.topic] || TYPE_ICON[type]) : TYPE_ICON[type];
            return (
              <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
                <div className={`w-12 h-12 rounded-lg shrink-0 flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
                  <span className="material-symbols-outlined text-white/90 text-xl">{headerIcon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-charcoal text-sm truncate flex items-center gap-1.5">
                    {post.title}
                    {post.is_locked && (
                      <span title={post.lock_note ? `Quản trị viên yêu cầu sửa: ${post.lock_note}` : 'Quản trị viên đã khóa bài đăng này'} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-error text-[10px] font-bold shrink-0">
                        <span className="material-symbols-outlined text-[12px]">lock</span>CẦN SỬA
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-on-muted truncate">{[post.topic, `${post.item_count} ${ITEM_UNIT[type]}`].filter(Boolean).join(' · ')}</p>
                  {post.is_locked && post.lock_note && (
                    <p className="text-xs text-error truncate mt-0.5">Lý do: {post.lock_note}</p>
                  )}
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
    </TeacherLayout>
  );
}
