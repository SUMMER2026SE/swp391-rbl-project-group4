import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Business'];

const LEVEL_STYLE = {
  N5:       'bg-emerald-100 text-emerald-700',
  N4:       'bg-sky-100    text-sky-700',
  N3:       'bg-amber-100  text-amber-700',
  N2:       'bg-orange-100 text-orange-700',
  N1:       'bg-red-100    text-red-700',
  Business: 'bg-purple-100 text-purple-700',
};

const EMPTY = {
  title: '', title_ja: '',
  description: '', description_ja: '',
  level: '', thumbnail_url: '', is_published: false,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CourseCard({ course, onEdit, onDelete, onManage }) {
  const levelStyle = LEVEL_STYLE[course.level] || 'bg-gray-100 text-gray-600';

  return (
    <article className="group bg-white rounded-2xl border border-outline/30 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative h-40 bg-surface-low overflow-hidden shrink-0">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-outline/40">
            <span className="material-symbols-outlined text-5xl">menu_book</span>
          </div>
        )}

        {/* Level badge */}
        {course.level && (
          <span className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded-full shadow-sm ${levelStyle}`}>
            {course.level}
          </span>
        )}

        {/* Publish status */}
        <span className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full shadow-sm ${
          course.is_published ? 'bg-green-500 text-white' : 'bg-gray-500/80 text-white'
        }`}>
          {course.is_published
            ? <><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Xuất bản</>
            : 'Nháp'
          }
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="font-semibold text-charcoal text-base leading-snug line-clamp-2 mb-0.5">
          {course.title}
        </h3>
        {course.title_ja && (
          <p className="text-xs text-on-muted mb-1 line-clamp-1">{course.title_ja}</p>
        )}
        {course.description && (
          <p className="text-sm text-on-muted line-clamp-2 flex-1 mt-1">{course.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline/20">
          <span className="text-xs text-on-muted">
            {course.created_at ? new Date(course.created_at).toLocaleDateString('vi') : '—'}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onManage(course)}
              title="Quản lý nội dung"
              className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
            <button
              onClick={() => onEdit(course)}
              title="Chỉnh sửa thông tin"
              className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button
              onClick={() => onDelete(course)}
              title="Xóa"
              className="p-1.5 text-on-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CourseForm({ form, onChange }) {
  const validThumb = form.thumbnail_url && /^https?:\/\/.+/.test(form.thumbnail_url);

  return (
    <div className="space-y-4">
      {/* Thumbnail preview */}
      {validThumb && (
        <div className="relative h-36 rounded-xl overflow-hidden bg-surface-low">
          <img
            src={form.thumbnail_url}
            alt="preview"
            className="w-full h-full object-cover"
            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
          />
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
            Preview
          </span>
        </div>
      )}

      <Input
        label="Tiêu đề (Tiếng Việt) *"
        value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })}
        placeholder="Nhập tên khóa học..."
      />

      <Input
        label="Tiêu đề (Tiếng Nhật)"
        value={form.title_ja}
        onChange={e => onChange({ ...form, title_ja: e.target.value })}
        placeholder="コース名を入力..."
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Level */}
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
          <select
            value={form.level}
            onChange={e => onChange({ ...form, level: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
          >
            <option value="">-- Chọn cấp độ --</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Publish toggle */}
        <div className="flex flex-col justify-end">
          <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
          <button
            type="button"
            onClick={() => onChange({ ...form, is_published: !form.is_published })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              form.is_published
                ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                : 'bg-surface-low border-outline text-on-muted hover:bg-outline/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {form.is_published ? 'public' : 'draft'}
            </span>
            {form.is_published ? 'Xuất bản' : 'Bản nháp'}
          </button>
        </div>
      </div>

      {/* Description VI */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (Tiếng Việt)</label>
        <textarea
          value={form.description}
          onChange={e => onChange({ ...form, description: e.target.value })}
          rows={3}
          placeholder="Mô tả nội dung và mục tiêu khóa học..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none"
        />
      </div>

      {/* Description JA */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (Tiếng Nhật)</label>
        <textarea
          value={form.description_ja}
          onChange={e => onChange({ ...form, description_ja: e.target.value })}
          rows={2}
          placeholder="コースの説明..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none"
        />
      </div>

      <Input
        label="URL Thumbnail"
        value={form.thumbnail_url}
        onChange={e => onChange({ ...form, thumbnail_url: e.target.value })}
        placeholder="https://example.com/image.jpg"
      />
    </div>
  );
}

function DeleteModal({ course, onConfirm, onCancel, deleting }) {
  const [inputVal, setInputVal] = useState('');
  const canDelete = inputVal === course?.title;

  // Reset input khi mở modal mới
  useEffect(() => { setInputVal(''); }, [course?.id]);

  return (
    <Modal
      open={!!course}
      onClose={onCancel}
      title="Xóa khóa học"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button variant="danger" onClick={onConfirm} loading={deleting} disabled={!canDelete}>
            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
            Xóa vĩnh viễn
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">warning</span>
          <div className="text-sm text-red-800 space-y-1">
            <p className="font-semibold">Hành động này không thể hoàn tác!</p>
            <p>
              Khóa học <strong>"{course?.title}"</strong> cùng toàn bộ bài học và nội dung liên quan
              sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </p>
          </div>
        </div>

        {/* Confirm input */}
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">
            Nhập tên khóa học để xác nhận:
          </label>
          <Input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={course?.title}
          />
          <p className="text-xs text-on-muted mt-1.5">
            Nhập chính xác:{' '}
            <code className="bg-surface-low px-1.5 py-0.5 rounded text-charcoal font-mono">
              {course?.title}
            </code>
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LIMIT = 12;

export default function AdminCourses() {
  const navigate = useNavigate();
  const [data, setData]         = useState([]);
  const [total, setTotal]       = useState(0);
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
  const [filterLevel, setFilterLevel]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      const r = await api.get(`/admin/courses?${params}`);
      setData(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      showAlert('error', e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  // Debounce search — reset to page 1 when search changes
  useEffect(() => {
    const timer = setTimeout(fetchCourses, 300);
    return () => clearTimeout(timer);
  }, [fetchCourses]);

  // Client-side filter (level + status không cần round-trip lên server)
  const filtered = data.filter(c => {
    if (filterLevel  && c.level !== filterLevel) return false;
    if (filterStatus === 'published' && !c.is_published) return false;
    if (filterStatus === 'draft'     &&  c.is_published) return false;
    return true;
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => {
    setForm({
      title:         row.title         || '',
      title_ja:      row.title_ja      || '',
      description:   row.description   || '',
      description_ja:row.description_ja|| '',
      level:         row.level         || '',
      thumbnail_url: row.thumbnail_url || '',
      is_published:  row.is_published  || false,
    });
    setEditId(row.id);
    setModal(true);
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────
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
      // Nếu xóa hết trang hiện tại thì về trang trước
      if (filtered.length === 1 && page > 1) setPage(p => p - 1);
      else fetchCourses();
    } catch (e) {
      const status = e.response?.status;
      if (status === 409) {
        showAlert('error', 'Không thể xóa: khóa học đang có học viên đăng ký.');
      } else {
        showAlert('error', e.response?.data?.error || e.message);
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Quản lý Khóa học">
      {/* Alert */}
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">
          {alert.msg}
        </Alert>
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            Khóa học
            <span className="ml-2 text-lg font-normal text-on-muted">({total})</span>
          </h1>
          <p className="text-sm text-on-muted mt-0.5">
            Tạo, chỉnh sửa và quản lý toàn bộ khóa học trên nền tảng
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Tạo khóa học mới
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl pointer-events-none">
            search
          </span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên khóa học..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
          />
        </div>

        {/* Level filter */}
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-all min-w-[140px]"
        >
          <option value="">Tất cả cấp độ</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-all min-w-[160px]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">✓ Đã xuất bản</option>
          <option value="draft">○ Bản nháp</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">
            progress_activity
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">menu_book</span>
          <p className="text-lg font-semibold text-charcoal mb-1">
            {search || filterLevel || filterStatus ? 'Không tìm thấy khóa học' : 'Chưa có khóa học nào'}
          </p>
          <p className="text-sm mb-6">
            {search || filterLevel || filterStatus
              ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
              : 'Hãy tạo khóa học đầu tiên cho nền tảng'}
          </p>
          {!search && !filterLevel && !filterStatus && (
            <Button onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tạo khóa học mới
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onManage={(c) => navigate(`/admin/courses/${c.id}/edit`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Trước
          </button>
          <span className="px-4 py-2 text-sm text-on-muted">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Tiếp →
          </button>
        </div>
      )}

      {/* Create / Edit Modal (UC-54 & UC-55) */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>
              {editId ? 'Lưu thay đổi' : 'Tạo khóa học'}
            </Button>
          </>
        }
      >
        <CourseForm form={form} onChange={setForm} />
      </Modal>

      {/* Delete Confirmation Modal (UC-56) */}
      <DeleteModal
        course={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        deleting={deleting}
      />
    </AdminLayout>
  );
}
