import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const EMPTY = { title: '', title_ja: '', description: '', description_ja: '', level: '', thumbnail_url: '', is_published: false };
const LEVELS = ['N5','N4','N3','N2','N1','Business'];

export default function AdminCourses() {
  const { t } = useLang();
  const [data, setData]   = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: '', msg: '' });
  const [page, setPage]   = useState(1);
  const LIMIT = 20;

  const fetch = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/courses?page=${page}&limit=${LIMIT}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => { setForm({ title: row.title||'', title_ja: row.title_ja||'', description: row.description||'', description_ja: row.description_ja||'', level: row.level||'', thumbnail_url: row.thumbnail_url||'', is_published: row.is_published||false }); setEditId(row.id); setModal(true); };

  const handleSave = async () => {
    if (!form.title) return setAlert({ type: 'error', msg: 'Tiêu đề không được để trống.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/courses/${editId}`, form);
      else        await api.post('/admin/courses', form);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setModal(false); fetch();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/courses/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetch(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const COLS = [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'level', label: 'Cấp độ' },
    { key: 'is_published', label: 'Trạng thái', render: v => <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${v ? 'bg-green-100 text-green-700' : 'bg-surface-low text-on-muted'}`}>{v ? t('admin.published') : t('admin.draft')}</span> },
    { key: 'created_at', label: 'Ngày tạo', render: v => v ? new Date(v).toLocaleDateString('vi') : '—' },
  ];

  return (
    <AdminLayout title={t('admin.courses')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.courses')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> {t('admin.create')}</Button>
      </div>

      <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete} />

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
          <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('admin.edit') : t('admin.create') + ' khoá học'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề (VI) *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <Input label="Tiêu đề (JA)" value={form.title_ja} onChange={e => setForm({...form, title_ja: e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ</label>
              <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">-- Chọn --</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-3">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} className="w-4 h-4 accent-tsubaki-red" />
                <span className="text-sm font-medium">{t('admin.published')}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (VI)</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
          </div>
          <Input label="Thumbnail URL" value={form.thumbnail_url} onChange={e => setForm({...form, thumbnail_url: e.target.value})} placeholder="https://..." />
        </div>
      </Modal>
    </AdminLayout>
  );
}
