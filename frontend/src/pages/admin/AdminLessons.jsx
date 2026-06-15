import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

export default function AdminLessons() {
  const { t } = useLang();
  const navigate = useNavigate();

  const [data, setData]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [alert, setAlert]       = useState({ type: '', msg: '' });
  const [filterCourse, setFilterCourse] = useState('');
  const [page, setPage]         = useState(1);
  const LIMIT = 20;

  // ── Load ────────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterCourse) params.set('course_id', filterCourse);
      const r = await api.get(`/admin/lessons?${params}`);
      setData(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, filterCourse]);

  useEffect(() => {
    api.get('/admin/courses?limit=100')
      .then(r => setCourses(r.data.data || []))
      .catch(() => {});
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const openEdit   = (row) => {
    setForm({
      course_id:   row.course_id   || '',
      title:       row.title       || '',
      title_ja:    row.title_ja    || '',
      order_index: row.order_index || 0,
      is_published: row.is_published || false,
    });
    setEditId(row.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.course_id) return setAlert({ type: 'error', msg: 'Vui lòng điền đầy đủ thông tin.' });
    setSaving(true);
    try {
      await api.put(`/admin/lessons/${editId}`, form);
      setAlert({ type: 'success', msg: 'Đã lưu.' });
      setModal(false);
      fetchData();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try {
      await api.delete(`/admin/lessons/${row.id}`);
      setAlert({ type: 'success', msg: 'Đã xóa.' });
      fetchData();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // Mở Course Builder — nơi soạn các phần (từ vựng, kanji, ngữ pháp, reading, quiz) của bài học.
  const handleGoToCourse = (row) => {
    if (row.course_id) navigate(`/admin/courses/${row.course_id}/edit`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title={t('admin.lessons')}>
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">
          {t('admin.lessons')}
          <span className="text-on-muted text-lg font-normal ml-2">({total})</span>
        </h1>
        <div className="flex gap-2">
          <select
            value={filterCourse}
            onChange={e => { setFilterCourse(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red bg-white"
          >
            <option value="">Tất cả khoá học</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <Button variant="secondary" onClick={() => navigate('/admin/courses')}>
            <span className="material-symbols-outlined text-lg">add</span>
            Tạo trong khóa học
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-outline/20 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_auto] gap-4 px-5 py-3 bg-surface-stone border-b border-outline/10 text-xs font-bold text-on-muted uppercase tracking-wider">
          <span>Tiêu đề</span>
          <span>Khóa học</span>
          <span>Trạng thái</span>
          <span className="text-right pr-1">Thao tác</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-muted">
            <span className="material-symbols-outlined text-5xl mb-2 opacity-20">menu_book</span>
            <p className="text-sm">Không có bài học nào</p>
          </div>
        ) : (
          data.map((row) => {
            const courseTitle = row.courses?.title || '—';
            const courseLevel = row.courses?.level;

            return (
              <div
                key={row.id}
                className="grid grid-cols-[2fr_1.5fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-outline/10 last:border-0 hover:bg-surface-stone/50 transition-colors items-center group"
              >
                {/* Title */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-xl shrink-0 text-tsubaki-red">menu_book</span>
                  <div
                    className="min-w-0 cursor-pointer group/title"
                    onClick={() => handleGoToCourse(row)}
                    title="Mở Course Builder"
                  >
                    <p className="font-medium text-sm truncate text-on-surface group-hover/title:text-tsubaki-red transition-colors">
                      {row.title}
                    </p>
                    {row.title_ja && (
                      <p className="text-xs text-on-muted truncate">{row.title_ja}</p>
                    )}
                  </div>
                </div>

                {/* Course */}
                <div
                  className="min-w-0 cursor-pointer group/course"
                  onClick={() => handleGoToCourse(row)}
                  title="Mở Course Builder"
                >
                  <p className="text-sm text-on-surface truncate transition-colors group-hover/course:text-tsubaki-red group-hover/course:underline">
                    {courseTitle}
                  </p>
                  {courseLevel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container text-on-muted font-semibold">
                      {courseLevel}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    row.is_published
                      ? 'bg-green-100 text-green-700'
                      : 'bg-surface-low text-on-muted'
                  }`}>
                    {row.is_published ? t('admin.published') : t('admin.draft')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleGoToCourse(row)}
                    title="Soạn nội dung trong Course Builder"
                    className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  </button>
                  <button
                    onClick={() => openEdit(row)}
                    title="Chỉnh sửa thông tin"
                    className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    title="Xóa"
                    className="p-1.5 text-on-muted hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-5">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red/40 transition-colors"
          >
            ← Trước
          </button>
          <span className="px-4 py-2 text-sm text-on-muted">
            {page} / {Math.ceil(total / LIMIT)}
          </span>
          <button
            disabled={page * LIMIT >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red/40 transition-colors"
          >
            Tiếp →
          </button>
        </div>
      )}

      {/* Edit metadata modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? t('admin.edit') : `${t('admin.create')} bài học`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('admin.cancel')}</Button>
            <Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Khoá học *</label>
            <select
              value={form.course_id}
              onChange={e => setForm({ ...form, course_id: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"
            >
              <option value="">-- Chọn khoá học --</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input label="Tiêu đề (JA)" value={form.title_ja} onChange={e => setForm({ ...form, title_ja: e.target.value })} />
          <Input label="Thứ tự" type="number" value={form.order_index} onChange={e => setForm({ ...form, order_index: Number(e.target.value) })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={e => setForm({ ...form, is_published: e.target.checked })}
              className="w-4 h-4 accent-tsubaki-red"
            />
            <span className="text-sm font-medium">{t('admin.published')}</span>
          </label>
          {editId && (
            <p className="text-xs text-on-muted bg-surface-stone/60 rounded-lg p-3">
              <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
              Soạn từ vựng, kanji, ngữ pháp, reading và quiz của bài học trong Course Builder.
            </p>
          )}
        </div>
      </Modal>
    </AdminLayout>
  );
}
