import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/layout/AdminLayout';
import TeacherLayout from '../components/layout/TeacherLayout';
import StudentLayout from '../components/layout/StudentLayout';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import api from '../lib/api';

const TYPE_META = {
  announcement: { icon: 'campaign',   label: 'Thông báo',    color: 'bg-sky-100 text-sky-700',           bar: 'bg-sky-400' },
  material:     { icon: 'link',       label: 'Tài liệu',     color: 'bg-violet-100 text-violet-700',     bar: 'bg-violet-400' },
  homework:     { icon: 'assignment', label: 'Bài tập',      color: 'bg-amber-100 text-amber-700',       bar: 'bg-amber-400' },
  quiz:         { icon: 'quiz',       label: 'Bài kiểm tra', color: 'bg-tsubaki-red/10 text-tsubaki-red', bar: 'bg-tsubaki-red' },
};
const isImg = (url) => url && /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url);
const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s/60)} phút trước`;
  if (s < 86400) return `${Math.floor(s/3600)} giờ trước`;
  if (s < 2592000) return `${Math.floor(s/86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
};
const fmtDue = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

// Nhóm bài theo NGÀY (mỗi ngày 1 hàng), ngày mới nhất lên trên; trong ngày: ghim trước rồi mới nhất trước
function groupByDay(posts) {
  const groups = {};
  for (const p of posts) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (groups[key] ||= []).push(p);
  }
  return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => {
    const arr = groups[key].slice().sort((a, b) =>
      (b.is_pinned - a.is_pinned) || (new Date(b.created_at) - new Date(a.created_at)));
    return { key, label: dayLabel(key), posts: arr };
  });
}
function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - date) / 86400000);
  const base = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  if (diff === 0) return `Hôm nay · ${base}`;
  if (diff === 1) return `Hôm qua · ${base}`;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── Bình luận (cột phải trong modal chi tiết) ───────────────────────────────
function Comments({ postId, onCountChange }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get(`/classes/board/${postId}/comments`); setList(r.data || []); } catch { setList([]); }
  }, [postId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/classes/board/${postId}/comments`, { body: text });
      setList(l => [...(l || []), r.data]); setText(''); onCountChange?.(1);
    } catch {} finally { setBusy(false); }
  };
  const del = async (id) => {
    try { await api.delete(`/classes/board/comments/${id}`); setList(l => l.filter(c => c.id !== id)); onCountChange?.(-1); } catch {}
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {list === null ? (
          <p className="text-sm text-on-muted text-center py-4">Đang tải...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-on-muted text-center py-4">Chưa có bình luận nào.</p>
        ) : list.map(c => (
          <div key={c.id} className="flex items-start gap-2 group">
            <div className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-[11px] font-bold shrink-0">
              {(c.author?.full_name?.[0] || '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px]"><span className="font-semibold">{c.author?.full_name || 'Ẩn'}</span>
                <span className="text-on-muted ml-2">{timeAgo(c.created_at)}</span></p>
              <p className="text-sm text-charcoal whitespace-pre-wrap break-words">{c.body}</p>
            </div>
            <button onClick={() => del(c.id)} title="Xóa"
              className="opacity-0 group-hover:opacity-100 text-on-muted hover:text-error p-1">
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-outline/20 p-3 flex gap-2 shrink-0">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Thêm bình luận..." className="flex-1 px-3 py-2 text-sm border border-outline rounded-full outline-none focus:border-tsubaki-red" />
        <button onClick={add} disabled={busy || !text.trim()} className="text-tsubaki-red disabled:opacity-40">
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  );
}

// ── Thẻ tóm tắt trên tường ──────────────────────────────────────────────────
function PostCard({ post, role, onOpen, onEdit, onDelete }) {
  const [menu, setMenu] = useState(false);
  const meta = TYPE_META[post.type] || TYPE_META.announcement;
  return (
    <div onClick={() => onOpen(post)}
      className="mb-4 break-inside-avoid bg-white rounded-2xl shadow-sm border border-outline/20 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      <div className={`h-1.5 ${meta.bar}`} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-xs font-bold shrink-0">
            {(post.author?.full_name?.[0] || '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{post.author?.full_name || 'Giáo viên'}</p>
            <p className="text-[10px] text-on-muted">{timeAgo(post.created_at)}</p>
          </div>
          {post.is_pinned && <span className="material-symbols-outlined text-amber-500 text-[16px]">push_pin</span>}
          {role === 'teacher' && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setMenu(m => !m)} className="text-on-muted hover:text-charcoal p-0.5">
                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
              </button>
              {menu && (
                <div className="absolute right-0 top-6 z-10 bg-white border border-outline/30 rounded-xl shadow-lg py-1 w-28 text-sm" onMouseLeave={() => setMenu(false)}>
                  <button onClick={() => { setMenu(false); onEdit(post); }} className="w-full text-left px-3 py-1.5 hover:bg-surface-low flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">edit</span>Sửa
                  </button>
                  <button onClick={() => { setMenu(false); onDelete(post); }} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-error flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">delete</span>Xóa
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${meta.color}`}>
          <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>{meta.label}
        </span>

        {post.title && <h3 className="font-bold text-[15px] leading-snug">{post.title}</h3>}
        {post.body && <p className="text-sm text-charcoal whitespace-pre-wrap break-words mt-1 line-clamp-4">{post.body}</p>}
        {isImg(post.file_url) && (
          <img src={post.file_url} alt="" className="w-full rounded-xl border border-outline/20 mt-2" />
        )}
        {post.file_url && !isImg(post.file_url) && (
          <span className="inline-flex items-center gap-1 text-sm text-sumire-purple mt-2"><span className="material-symbols-outlined text-base">attach_file</span>{post.file_name || 'Tệp'}</span>
        )}
        {post.link_url && (
          <span className="flex items-center gap-1.5 text-sm text-sumire-purple mt-2 break-all bg-surface-low/60 rounded-lg px-2 py-1.5"><span className="material-symbols-outlined text-base shrink-0">open_in_new</span><span className="truncate">{post.link_url}</span></span>
        )}
        {post.due_at && <p className="text-[11px] text-amber-600 mt-2">⏰ Hạn: {fmtDue(post.due_at)}</p>}
        {post.type === 'quiz' && <p className="text-[11px] text-tsubaki-red font-medium mt-2">Bấm để mở bài kiểm tra →</p>}

        <div className="flex items-center gap-1 mt-3 text-xs text-on-muted">
          <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
          {post.comment_count > 0 ? `${post.comment_count} bình luận` : 'Bình luận'}
        </div>
      </div>
    </div>
  );
}

// ── Modal chi tiết bài đăng (ảnh/nội dung trái · bình luận phải) ─────────────
function DetailModal({ post, role, onClose, onTakeQuiz, onCountChange }) {
  if (!post) return null;
  const meta = TYPE_META[post.type] || TYPE_META.announcement;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow text-on-muted hover:text-charcoal">
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Trái: nội dung */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-sm font-bold">
              {(post.author?.full_name?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{post.author?.full_name || 'Giáo viên'}</p>
              <p className="text-[11px] text-on-muted">{timeAgo(post.created_at)}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mb-2 ${meta.color}`}>
            <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>{meta.label}
          </span>
          {post.title && <h2 className="font-display font-bold text-xl mb-2">{post.title}</h2>}
          {post.body && <p className="text-[15px] text-charcoal whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>}
          {isImg(post.file_url) && (
            <a href={post.file_url} target="_blank" rel="noreferrer" className="block mt-3">
              <img src={post.file_url} alt={post.file_name || ''} className="w-full rounded-xl border border-outline/20" />
            </a>
          )}
          {post.file_url && !isImg(post.file_url) && (
            <a href={post.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-sumire-purple hover:underline mt-3">
              <span className="material-symbols-outlined text-base">attach_file</span>{post.file_name || 'Tệp đính kèm'}</a>
          )}
          {post.link_url && (
            <a href={post.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-sumire-purple hover:underline mt-3 break-all bg-surface-low/60 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-base shrink-0">open_in_new</span>{post.link_url}</a>
          )}
          {post.due_at && <p className="text-sm text-amber-600 mt-3">⏰ Hạn: {fmtDue(post.due_at)}</p>}
          {post.type === 'quiz' && post.assignment_id && (
            <Button onClick={() => onTakeQuiz(post)} className="mt-4">
              <span className="material-symbols-outlined text-base">{role === 'teacher' ? 'visibility' : 'play_arrow'}</span>
              {role === 'teacher' ? 'Xem / Quản lý đề' : 'Làm bài'}
            </Button>
          )}
        </div>

        {/* Phải: bình luận */}
        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-outline/20 flex flex-col h-64 md:h-auto">
          <div className="px-4 py-3 border-b border-outline/20 font-semibold text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">forum</span> Bình luận
          </div>
          <div className="flex-1 min-h-0">
            <Comments postId={post.id} onCountChange={onCountChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal đăng / sửa bài ────────────────────────────────────────────────────
function PostModal({ open, onClose, classId, editing, onSaved }) {
  const isEdit = !!editing;
  const [type, setType]   = useState('announcement');
  const [form, setForm]   = useState({ title:'', body:'', link_url:'', due_at:'', is_pinned:false });
  const [file, setFile]   = useState(null);
  const [exams, setExams] = useState([]);
  const [examMode, setExamMode] = useState('existing');
  const [examId, setExamId]     = useState('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    setError(''); setFile(null); setExamMode('existing'); setExamId(''); setNewExamTitle('');
    if (isEdit) {
      setType(editing.type);
      setForm({ title: editing.title||'', body: editing.body||'', link_url: editing.link_url||'',
                due_at: editing.due_at ? editing.due_at.slice(0,16) : '', is_pinned: !!editing.is_pinned });
    } else {
      setType('announcement'); setForm({ title:'', body:'', link_url:'', due_at:'', is_pinned:false });
      api.get('/classes/teacher/exams').then(r => setExams(r.data || [])).catch(() => {});
    }
  }, [open, isEdit, editing]);

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/classes/board/${editing.id}`, {
          title: form.title, body: form.body, link_url: form.link_url, due_at: form.due_at || null, is_pinned: form.is_pinned,
        });
      } else {
        const payload = { type, title: form.title, body: form.body, is_pinned: form.is_pinned };
        if (type === 'material') payload.link_url = form.link_url;
        if (type === 'homework' || type === 'quiz') payload.due_at = form.due_at || null;
        if (type === 'quiz') {
          if (examMode === 'existing') { if (!examId) throw new Error('Chọn một đề thi.'); payload.exam_id = examId; }
          else { if (!newExamTitle.trim()) throw new Error('Nhập tên đề mới.'); payload.new_exam_title = newExamTitle.trim(); }
        }
        if (file) {
          const fd = new FormData(); fd.append('file', file);
          const up = await api.post(`/classes/${classId}/board/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          payload.file_url = up.data.file_url; payload.file_name = up.data.file_name;
        }
        await api.post(`/classes/${classId}/board`, payload);
      }
      onSaved(); onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const TABS = [['announcement','Thông báo'],['material','Tài liệu'],['homework','Bài tập'],['quiz','Bài kiểm tra']];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Sửa bài đăng' : 'Đăng bài lên lớp'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button loading={saving} onClick={submit}>{isEdit ? 'Lưu' : 'Đăng'}</Button></>}>
      <div className="space-y-4">
        {!isEdit && (
          <div className="flex flex-wrap gap-2">
            {TABS.map(([v, l]) => (
              <button key={v} onClick={() => setType(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${type===v ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red' : 'border-outline text-on-muted'}`}>
                <span className="material-symbols-outlined text-base align-middle mr-1">{TYPE_META[v].icon}</span>{l}
              </button>
            ))}
          </div>
        )}
        {error && <Alert type="error">{error}</Alert>}

        <Input label="Tiêu đề" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Tiêu đề bài đăng" />
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nội dung</label>
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={3}
            className="w-full px-4 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" placeholder="Nội dung / mô tả..." />
        </div>
        {type === 'material' && (
          <Input label="Đường link" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
        )}
        {!isEdit && ['announcement','material','homework'].includes(type) && (
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tệp / ảnh đính kèm (tùy chọn)</label>
            <input type="file" onChange={e => setFile(e.target.files[0] || null)} className="text-sm" />
          </div>
        )}
        {(type === 'homework' || type === 'quiz') && (
          <Input label="Hạn nộp / hạn làm" type="datetime-local" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} />
        )}
        {!isEdit && type === 'quiz' && (
          <div className="space-y-3 p-3 rounded-xl bg-surface-low/50 border border-outline/30">
            <div className="flex gap-2">
              {[['existing','Đề có sẵn'],['new','Tạo đề mới']].map(([v,l]) => (
                <button key={v} onClick={() => setExamMode(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${examMode===v ? 'border-tsubaki-red text-tsubaki-red' : 'border-outline text-on-muted'}`}>{l}</button>
              ))}
            </div>
            {examMode === 'existing' ? (
              <select value={examId} onChange={e => setExamId(e.target.value)}
                className="w-full px-3 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">— Chọn đề thi —</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </select>
            ) : (
              <>
                <Input label="Tên đề mới" value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} placeholder="VD: Kiểm tra 15 phút bài 1" />
                <p className="text-[11px] text-on-muted">Sau khi đăng, vào trang <strong>Đề thi</strong> để thêm câu hỏi.</p>
              </>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} className="accent-tsubaki-red" />
          <span className="text-sm">Ghim lên đầu</span>
        </label>
      </div>
    </Modal>
  );
}

// ── Trang bảng lớp ──────────────────────────────────────────────────────────
export default function ClassBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isTeacher } = useAuth();
  const Layout = isAdmin() ? AdminLayout : isTeacher() ? TeacherLayout : StudentLayout;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/classes/${id}/board`); setData(r.data); }
    catch (e) { setError(e.response?.data?.error || 'Không thể tải lớp.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (post) => {
    if (!confirm('Xóa bài đăng này?')) return;
    try { await api.delete(`/classes/board/${post.id}`); setData(d => ({ ...d, posts: d.posts.filter(p => p.id !== post.id) })); } catch {}
  };
  const openCreate = () => { setEditing(null); setModal(true); };
  const openEdit = (post) => { setEditing(post); setModal(true); };
  const takeQuiz = (post) => navigate(`/exams/${post.assignment_id}`);
  // cập nhật số bình luận trong state khi thêm/xóa ở modal chi tiết
  const bumpComment = (postId, delta) => setData(d => d ? ({ ...d, posts: d.posts.map(p => p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count||0)+delta) } : p) }) : d);

  const isTeacherRole = data?.role === 'teacher';
  const groups = data ? groupByDay(data.posts) : [];

  return (
    <Layout title="Lớp học">
      <div className="min-h-[calc(100vh-9rem)] -m-6 md:-m-8 p-6 md:p-8 relative"
        style={{ backgroundColor: '#f7f6fb', backgroundImage: 'radial-gradient(#d9d4e8 1px, transparent 1px)', backgroundSize: '22px 22px' }}>

        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-3">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại
        </button>

        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
        ) : data && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl md:text-3xl font-bold">{data.class?.name}</h1>
              {data.class?.description && <p className="text-sm text-on-muted mt-1">{data.class.description}</p>}
            </div>

            {data.posts.length === 0 ? (
              <div className="bg-white/80 rounded-2xl p-16 text-center max-w-md mx-auto mt-10">
                <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">dashboard</span>
                <p className="font-bold text-lg mb-1">Bảng lớp trống</p>
                <p className="text-on-muted text-sm">{isTeacherRole ? 'Bấm “Đăng bài” để tạo nội dung đầu tiên.' : 'Chưa có bài đăng nào.'}</p>
              </div>
            ) : (
              // Mỗi NGÀY là một hàng có tiêu đề ngày; trong hàng là tường thẻ masonry
              <div className="space-y-8">
                {groups.map(g => (
                  <section key={g.key}>
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-sm font-bold text-charcoal bg-white/80 border border-outline/30 rounded-full px-4 py-1.5 shadow-sm">
                        {g.label}
                      </h2>
                      <span className="text-xs text-on-muted">{g.posts.length} bài</span>
                      <div className="flex-1 h-px bg-outline/30" />
                    </div>
                    <div className="[column-gap:1rem] columns-1 sm:columns-2 lg:columns-3 xl:columns-4">
                      {g.posts.map(p => (
                        <PostCard key={p.id} post={p} role={data.role} onOpen={setDetail} onEdit={openEdit} onDelete={handleDelete} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {isTeacherRole && (
          <button onClick={openCreate}
            className="fixed bottom-8 right-8 z-30 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-tsubaki-red text-white font-bold shadow-xl hover:scale-105 active:scale-95 transition-transform">
            <span className="material-symbols-outlined">add</span> Đăng bài
          </button>
        )}
      </div>

      <DetailModal post={detail} role={data?.role} onClose={() => setDetail(null)} onTakeQuiz={takeQuiz}
        onCountChange={d => detail && bumpComment(detail.id, d)} />
      <PostModal open={modal} onClose={() => setModal(false)} classId={id} editing={editing} onSaved={load} />
    </Layout>
  );
}
