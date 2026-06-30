import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import CourseManageCard from '../../components/admin/CourseManageCard';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Business'];
const DIFFICULTY = ['N5', 'N4', 'N3', 'N2', 'N1', 'mixed'];
const LIMIT = 12;

const SORTS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'title',  label: 'Tên A-Z' },
];

const TABS = [
  { value: '',          label: 'Tất cả',   dot: '' },
  { value: 'published', label: 'Xuất bản', dot: 'bg-green-500' },
  { value: 'draft',     label: 'Nháp',     dot: 'bg-amber-500' },
];

const EMPTY = {
  title: '', title_ja: '',
  description: '', description_ja: '',
  level: '', thumbnail_url: '', is_published: false,
  difficulty_level: '', reference_curriculum: '',
};

// ── Course form (create / edit) ───────────────────────────────────────────────
function CourseForm({ form, onChange }) {
  const validThumb = form.thumbnail_url && /^https?:\/\/.+/.test(form.thumbnail_url);

  return (
    <div className="space-y-4">
      {validThumb && (
        <div className="relative h-36 rounded-xl overflow-hidden bg-surface-low">
          <img src={form.thumbnail_url} alt="preview" className="w-full h-full object-cover"
            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }} />
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">Preview</span>
        </div>
      )}

      <Input label="Tiêu đề (Tiếng Việt) *" value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })} placeholder="Nhập tên khóa học..." />
      <Input label="Tiêu đề (Tiếng Nhật)" value={form.title_ja}
        onChange={e => onChange({ ...form, title_ja: e.target.value })} placeholder="コース名を入力..." />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
          <select value={form.level} onChange={e => onChange({ ...form, level: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all">
            <option value="">-- Chọn cấp độ --</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
          <button type="button" onClick={() => onChange({ ...form, is_published: !form.is_published })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              form.is_published ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' : 'bg-surface-low border-outline text-on-muted hover:bg-outline/20'}`}>
            <span className="material-symbols-outlined text-[18px]">{form.is_published ? 'public' : 'draft'}</span>
            {form.is_published ? 'Xuất bản' : 'Bản nháp'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Độ khó (badge)</label>
          <select value={form.difficulty_level} onChange={e => onChange({ ...form, difficulty_level: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all">
            <option value="">-- Chọn độ khó --</option>
            {DIFFICULTY.map(d => <option key={d} value={d}>{d === 'mixed' ? 'Tổng hợp' : d}</option>)}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="block text-sm font-medium text-on-muted mb-1">Học phí</label>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-300 bg-green-50 text-green-700 text-sm font-medium">
            <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
            Miễn phí (khóa của Admin)
          </div>
        </div>
      </div>

      <Input label="Giáo trình tham chiếu" value={form.reference_curriculum}
        onChange={e => onChange({ ...form, reference_curriculum: e.target.value })} placeholder="VD: Minna no Nihongo Shokyu 1" />

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (Tiếng Việt)</label>
        <textarea value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} rows={3}
          placeholder="Mô tả nội dung và mục tiêu khóa học..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (Tiếng Nhật)</label>
        <textarea value={form.description_ja} onChange={e => onChange({ ...form, description_ja: e.target.value })} rows={2}
          placeholder="コースの説明..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none" />
      </div>

      <Input label="URL Thumbnail (hoặc tải ảnh bìa trực tiếp trên thẻ)" value={form.thumbnail_url}
        onChange={e => onChange({ ...form, thumbnail_url: e.target.value })} placeholder="https://example.com/image.jpg" />
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteModal({ course, onConfirm, onCancel, deleting }) {
  const [inputVal, setInputVal] = useState('');
  const canDelete = inputVal === course?.title;
  useEffect(() => { setInputVal(''); }, [course?.id]);

  return (
    <Modal open={!!course} onClose={onCancel} title="Xóa khóa học"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button variant="danger" onClick={onConfirm} loading={deleting} disabled={!canDelete}>
            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
            Xóa vĩnh viễn
          </Button>
        </>
      }>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">warning</span>
          <div className="text-sm text-red-800 space-y-1">
            <p className="font-semibold">Hành động này không thể hoàn tác!</p>
            <p>Khóa học <strong>"{course?.title}"</strong> cùng toàn bộ bài học và nội dung liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống.</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nhập tên khóa học để xác nhận:</label>
          <Input value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder={course?.title} />
          <p className="text-xs text-on-muted mt-1.5">Nhập chính xác: <code className="bg-surface-low px-1.5 py-0.5 rounded text-charcoal font-mono">{course?.title}</code></p>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminCourses() {
  const navigate = useNavigate();
  const [data, setData]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [counts, setCounts]     = useState({ all: 0, published: 0, draft: 0 });
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert]       = useState({ type: '', msg: '' });
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [tab, setTab]           = useState('');
  const [sort, setSort]         = useState('newest');

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT, sort });
      if (search)      params.set('search', search);
      if (filterLevel) params.set('level', filterLevel);
      if (tab)         params.set('status', tab);
      const r = await api.get(`/admin/courses?${params}`);
      setData(r.data.data || []);
      setTotal(r.data.total || 0);
      if (r.data.counts) setCounts(r.data.counts);
    } catch (e) {
      showAlert('error', e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterLevel, tab, sort]);

  useEffect(() => {
    const t = setTimeout(fetchCourses, 300);
    return () => clearTimeout(t);
  }, [fetchCourses]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (row) => {
    setForm({
      title: row.title || '', title_ja: row.title_ja || '',
      description: row.description || '', description_ja: row.description_ja || '',
      level: row.level || '', thumbnail_url: row.thumbnail_url || '', is_published: row.is_published || false,
      difficulty_level: row.difficulty_level || '', reference_curriculum: row.reference_curriculum || '',
    });
    setEditId(row.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return showAlert('error', 'Tiêu đề không được để trống.');
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/courses/${editId}`, form);
      else        await api.post('/admin/courses', form);
      showAlert('success', editId ? 'Cập nhật khóa học thành công.' : 'Tạo khóa học thành công.');
      setModal(false);
      fetchCourses();
    } catch (e) {
      showAlert('error', e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/courses/${deleteTarget.id}`);
      showAlert('success', `Đã xóa khóa học "${deleteTarget.title}".`);
      setDeleteTarget(null);
      if (data.length === 1 && page > 1) setPage(p => p - 1);
      else fetchCourses();
    } catch (e) {
      const status = e.response?.status;
      showAlert('error', status === 409 ? 'Không thể xóa: khóa học đang có học viên đăng ký.' : (e.response?.data?.error || e.message));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Bật/tắt xuất bản nhanh từ thẻ.
  const togglePublish = async (course) => {
    try {
      await api.put(`/admin/courses/${course.id}`, { is_published: !course.is_published });
      setData(d => d.map(c => c.id === course.id ? { ...c, is_published: !course.is_published } : c));
      const delta = course.is_published ? -1 : 1;
      setCounts(c => ({ ...c, published: c.published + delta, draft: c.draft - delta }));
      if (tab) fetchCourses(); // đang lọc theo tab → item có thể rời danh sách
    } catch (e) {
      showAlert('error', e.message);
    }
  };

  const uploadCover = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const r = await api.post('/admin/courses/upload-cover', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.url;
  };

  const handleCoverUploaded = async (course, url) => {
    try {
      await api.put(`/admin/courses/${course.id}`, { thumbnail_url: url });
      setData(d => d.map(c => c.id === course.id ? { ...c, thumbnail_url: url } : c));
      showAlert('success', 'Đã cập nhật ảnh bìa.');
    } catch (e) {
      showAlert('error', e.message);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilter = search || filterLevel || tab;

  return (
    <AdminLayout title="Quản lý Khóa học">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Khóa học <span className="ml-2 text-lg font-normal text-on-muted">({counts.all})</span></h1>
          <p className="text-sm text-on-muted mt-0.5">Tạo, chỉnh sửa và quản lý toàn bộ khóa học trên nền tảng</p>
        </div>
        <Button onClick={openCreate} className="shrink-0"><span className="material-symbols-outlined text-[18px]">add</span>Tạo khóa học mới</Button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-outline/30 mb-5 overflow-x-auto">
        {TABS.map(t => {
          const n = t.value === 'published' ? counts.published : t.value === 'draft' ? counts.draft : counts.all;
          const active = tab === t.value;
          return (
            <button key={t.value} onClick={() => { setTab(t.value); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${active ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
              {t.dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
              {t.label}
              <span className={`text-xs ${active ? 'text-tsubaki-red' : 'text-on-muted/70'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl pointer-events-none">search</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo tên khóa học..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all" />
        </div>
        <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-all min-w-[150px]">
          <option value="">Tất cả cấp độ</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-all min-w-[140px]">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span></div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">menu_book</span>
          <p className="text-lg font-semibold text-charcoal mb-1">{hasFilter ? 'Không tìm thấy khóa học' : 'Chưa có khóa học nào'}</p>
          <p className="text-sm mb-6">{hasFilter ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : 'Hãy tạo khóa học đầu tiên cho nền tảng'}</p>
          {!hasFilter && <Button onClick={openCreate}><span className="material-symbols-outlined text-[18px]">add</span>Tạo khóa học mới</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map(course => (
            <CourseManageCard key={course.id} course={course}
              onManage={(c) => navigate(`/admin/courses/${c.id}/edit`)}
              onEdit={openEdit}
              onTogglePublish={togglePublish}
              onDelete={setDeleteTarget}
              uploadCover={uploadCover}
              onCoverUploaded={(url) => handleCoverUploaded(course, url)}
              onError={(m) => showAlert('error', m)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Tiếp →</button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>{editId ? 'Lưu thay đổi' : 'Tạo khóa học'}</Button></>}>
        <CourseForm form={form} onChange={setForm} />
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteModal course={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />
    </AdminLayout>
  );
}
