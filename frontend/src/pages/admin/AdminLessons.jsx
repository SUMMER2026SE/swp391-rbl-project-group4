import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const EMPTY = { course_id: '', title: '', title_ja: '', content: '', order_index: 0, is_published: false };

export default function AdminLessons() {
  const { t } = useLang();
  const [data, setData]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert]   = useState({ type: '', msg: '' });
  const [filterCourse, setFilterCourse] = useState('');
  const [page, setPage]     = useState(1);
  const LIMIT = 20;

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterCourse) params.set('course_id', filterCourse);
      const r = await api.get(`/admin/lessons?${params}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page, filterCourse]);
  useEffect(() => {
    api.get('/admin/courses?limit=100').then(r => setCourses(r.data.data || [])).catch(() => {});
  }, []);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => { setForm({ course_id: row.course_id||'', title: row.title||'', title_ja: row.title_ja||'', content: row.content||'', order_index: row.order_index||0, is_published: row.is_published||false }); setEditId(row.id); setModal(true); };

  const handleSave = async () => {
    if (!form.title || !form.course_id) return setAlert({ type: 'error', msg: 'Vui lòng điền đầy đủ thông tin.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/lessons/${editId}`, form);
      else        await api.post('/admin/lessons', form);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setModal(false); fetch();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/lessons/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetch(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const COLS = [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'order_index', label: 'Thứ tự' },
    { key: 'is_published', label: 'Trạng thái', render: v => <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${v ? 'bg-green-100 text-green-700' : 'bg-surface-low text-on-muted'}`}>{v ? t('admin.published') : t('admin.draft')}</span> },
  ];

  return (
    <AdminLayout title={t('admin.lessons')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.lessons')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2">
          <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
            <option value="">Tất cả khoá học</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> {t('admin.create')}</Button>
        </div>
      </div>

      <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete} />

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
          <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('admin.edit') : t('admin.create') + ' bài học'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Khoá học *</label>
            <select value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">-- Chọn khoá học --</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <Input label="Tiêu đề (JA)" value={form.title_ja} onChange={e => setForm({...form, title_ja: e.target.value})} />
          <Input label="Thứ tự" type="number" value={form.order_index} onChange={e => setForm({...form, order_index: Number(e.target.value)})} />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Nội dung</label>
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={5} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" placeholder="Nội dung HTML hoặc văn bản..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} className="w-4 h-4 accent-tsubaki-red" />
            <span className="text-sm font-medium">{t('admin.published')}</span>
          </label>
        </div>
      </Modal>
    </AdminLayout>
  );
}
