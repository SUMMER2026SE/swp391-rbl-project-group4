import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import CourseManageCard from '../../components/admin/CourseManageCard';
import { formatVnd } from '../../lib/format';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Business'];
const DIFFICULTY = ['N5', 'N4', 'N3', 'N2', 'N1', 'mixed'];

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
  title: '', title_ja: '', description: '', description_ja: '',
  level: '', difficulty_level: '', thumbnail_url: '', is_published: false,
  price: '', reference_curriculum: '',
};

// ── Form ─────────────────────────────────────────────────────────────────────
function CourseForm({ form, onChange, editing }) {
  const validThumb = form.thumbnail_url && /^https?:\/\/.+/.test(form.thumbnail_url);
  const priceNum = Number(form.price);
  const showPayout = Number.isFinite(priceNum) && priceNum > 0;

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
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Độ khó (badge)</label>
          <select value={form.difficulty_level} onChange={e => onChange({ ...form, difficulty_level: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all">
            <option value="">-- Chọn độ khó --</option>
            {DIFFICULTY.map(d => <option key={d} value={d}>{d === 'mixed' ? 'Tổng hợp' : d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Input
          label={editing ? 'Giá khóa học (₫) — để trống nếu không đổi' : 'Giá khóa học (₫) *'}
          type="number" min="0" value={form.price}
          onChange={e => onChange({ ...form, price: e.target.value })} placeholder="VD: 299000" />
        <div className="mt-1.5 flex items-start gap-2 text-xs text-on-muted bg-sumire-purple/5 border border-sumire-purple/15 rounded-lg px-3 py-2">
          <span className="material-symbols-outlined text-[16px] text-sumire-purple shrink-0">info</span>
          <span>
            Kizuna Nihongo giữ lại <strong>10% hoa hồng</strong>, bạn nhận <strong>90%</strong>.
            {showPayout && <> Với giá này, bạn nhận <strong>{formatVnd(priceNum * 0.9)}</strong>/lượt mua.</>}
          </span>
        </div>
      </div>

      <Input label="URL Thumbnail (hoặc tải ảnh bìa trực tiếp trên thẻ)" value={form.thumbnail_url}
        onChange={e => onChange({ ...form, thumbnail_url: e.target.value })} placeholder="https://example.com/image.jpg" />
      <Input label="Giáo trình tham chiếu" value={form.reference_curriculum}
        onChange={e => onChange({ ...form, reference_curriculum: e.target.value })} placeholder="VD: Minna no Nihongo Shokyu 1" />

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (Tiếng Việt)</label>
        <textarea value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} rows={3}
          placeholder="Mô tả nội dung và mục tiêu khóa học..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
        <button type="button" onClick={() => onChange({ ...form, is_published: !form.is_published })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            form.is_published ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' : 'bg-surface-low border-outline text-on-muted hover:bg-outline/20'}`}>
          <span className="material-symbols-outlined text-[18px]">{form.is_published ? 'public' : 'draft'}</span>
          {form.is_published ? 'Xuất bản (học viên thấy được)' : 'Bản nháp'}
        </button>
        <p className="text-xs text-on-muted mt-1">Nhớ thêm bài học trước khi xuất bản để học viên có nội dung học.</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TeacherCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [search, setSearch]   = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [tab, setTab]         = useState('');
  const [sort, setSort]       = useState('newest');

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/teacher/courses');
      setCourses(r.data || []);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // Lọc + sắp xếp client-side (danh sách của giáo viên thường ít).
  const counts = useMemo(() => {
    const all = courses.length;
    const published = courses.filter(c => c.is_published).length;
    return { all, published, draft: all - published };
  }, [courses]);

  const visible = useMemo(() => {
    let list = courses;
    if (tab === 'published') list = list.filter(c => c.is_published);
    if (tab === 'draft')     list = list.filter(c => !c.is_published);
    if (filterLevel)         list = list.filter(c => c.level === filterLevel);
    if (search.trim())       list = list.filter(c => (c.title || '').toLowerCase().includes(search.trim().toLowerCase()));
    const arr = [...list];
    if (sort === 'title')       arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sort === 'oldest') arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else                        arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return arr;
  }, [courses, tab, filterLevel, search, sort]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (row) => {
    setForm({
      title: row.title || '', title_ja: row.title_ja || '',
      description: row.description || '', description_ja: row.description_ja || '',
      level: row.level || '', difficulty_level: '', thumbnail_url: row.thumbnail_url || '',
      is_published: row.is_published || false, price: '', reference_curriculum: '',
    });
    setEditId(row.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return showAlert('error', 'Tiêu đề không được để trống.');
    const priceNum = Number(form.price);
    const priceProvided = form.price !== '' && form.price !== null;
    if (!editId && (!Number.isFinite(priceNum) || priceNum <= 0))
      return showAlert('error', 'Khóa học có phí: giá phải lớn hơn 0.');
    if (editId && priceProvided && (!Number.isFinite(priceNum) || priceNum <= 0))
      return showAlert('error', 'Giá phải lớn hơn 0.');

    const payload = {
      title: form.title, title_ja: form.title_ja,
      description: form.description, description_ja: form.description_ja,
      level: form.level, thumbnail_url: form.thumbnail_url,
      is_published: form.is_published,
    };
    if (priceProvided) payload.price = priceNum;
    if (form.difficulty_level) payload.difficulty_level = form.difficulty_level;
    if (form.reference_curriculum) payload.reference_curriculum = form.reference_curriculum;

    setSaving(true);
    try {
      if (editId) await api.put(`/teacher/courses/${editId}`, payload);
      else        await api.post('/teacher/courses', payload);
      showAlert('success', editId ? 'Đã cập nhật khóa học.' : 'Đã tạo khóa học.');
      setModal(false);
      fetchCourses();
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/teacher/courses/${deleteTarget.id}`);
      showAlert('success', `Đã xóa khóa học "${deleteTarget.title}".`);
      setDeleteTarget(null);
      fetchCourses();
    } catch (e) {
      showAlert('error', e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async (course) => {
    try {
      await api.put(`/teacher/courses/${course.id}`, { is_published: !course.is_published });
      setCourses(cs => cs.map(c => c.id === course.id ? { ...c, is_published: !course.is_published } : c));
    } catch (e) {
      showAlert('error', e.message);
    }
  };

  const uploadCover = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const r = await api.post('/teacher/courses/upload-cover', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.url;
  };

  const handleCoverUploaded = async (course, url) => {
    try {
      await api.put(`/teacher/courses/${course.id}`, { thumbnail_url: url });
      setCourses(cs => cs.map(c => c.id === course.id ? { ...c, thumbnail_url: url } : c));
      showAlert('success', 'Đã cập nhật ảnh bìa.');
    } catch (e) {
      showAlert('error', e.message);
    }
  };

  const hasFilter = search || filterLevel || tab;

  return (
    <TeacherLayout title="Khóa học của tôi">
      {alert.msg && <div className="mb-4"><Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert></div>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Khóa học của tôi <span className="ml-1 text-lg font-normal text-on-muted">({counts.all})</span></h1>
          <p className="text-sm text-on-muted mt-0.5">Tạo và quản lý khóa học có phí của bạn. Hoa hồng nền tảng: 10%.</p>
        </div>
        <Button onClick={openCreate} className="shrink-0"><span className="material-symbols-outlined text-[18px]">add</span>Tạo khóa học mới</Button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-outline/30 mb-5 overflow-x-auto">
        {TABS.map(t => {
          const n = t.value === 'published' ? counts.published : t.value === 'draft' ? counts.draft : counts.all;
          const active = tab === t.value;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên khóa học..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all" />
        </div>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
          className="px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-all min-w-[150px]">
          <option value="">Tất cả cấp độ</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-all min-w-[140px]">
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">menu_book</span>
          <p className="text-lg font-semibold text-charcoal mb-1">{hasFilter ? 'Không tìm thấy khóa học' : 'Chưa có khóa học nào'}</p>
          <p className="text-sm mb-6">{hasFilter ? 'Thử thay đổi bộ lọc hoặc từ khóa' : 'Tạo khóa học có phí đầu tiên của bạn'}</p>
          {!hasFilter && <Button onClick={openCreate}><span className="material-symbols-outlined text-[18px]">add</span>Tạo khóa học mới</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map(course => (
            <CourseManageCard key={course.id} course={course}
              onManage={(c) => navigate(`/teacher/courses/${c.id}/edit`)}
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

      {/* Create / Edit */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>{editId ? 'Lưu thay đổi' : 'Tạo khóa học'}</Button></>}>
        <CourseForm form={form} onChange={setForm} editing={!!editId} />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xóa khóa học"
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Hủy</Button><Button variant="danger" loading={deleting} onClick={handleDelete}>Xóa vĩnh viễn</Button></>}>
        <p className="text-sm text-on-surface-variant">
          Bạn chắc chắn muốn xóa khóa học <strong>"{deleteTarget?.title}"</strong>? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </TeacherLayout>
  );
}
