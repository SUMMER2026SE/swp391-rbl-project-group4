import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const EMPTY  = { title: '', title_ja: '', meaning_vi: '', explanation: '', example_sentence: '', level: '' };
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function AdminGrammarPoints() {
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      const r = await api.get(`/grammar-points?${params}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, [page, level]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => {
    setForm({
      title: row.title || '', title_ja: row.title_ja || '', meaning_vi: row.meaning_vi || '',
      explanation: row.explanation || '', example_sentence: row.example_sentence || '', level: row.level || '',
    });
    setEditId(row.id); setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.meaning_vi.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề và nghĩa là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/grammar-points/${editId}`, form);
      else        await api.post('/admin/grammar-points', form);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setModal(false); fetchData();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm('Xóa mẫu ngữ pháp này?')) return;
    try { await api.delete(`/admin/grammar-points/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetchData(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const COLS = [
    { key: 'title',      label: 'Mẫu ngữ pháp', render: v => <span className="font-bold text-tsubaki-red">{v}</span> },
    { key: 'meaning_vi',  label: 'Nghĩa' },
    { key: 'level',       label: 'Level' },
    { key: 'example_sentence', label: 'Ví dụ', render: v => v ? <span className="text-xs italic">{v}</span> : '—' },
  ];

  return (
    <AdminLayout title="Ngữ pháp (từ điển)">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-2xl font-bold">Ngữ pháp (từ điển) <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2 flex-wrap">
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none">
            <option value="">Tất cả level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetchData(); }} className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-36" />
            <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl"><span className="material-symbols-outlined text-lg">search</span></button>
          </form>
          <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Thêm</Button>
        </div>
      </div>

      <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete} />

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total / LIMIT)}</span>
          <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Sửa mẫu ngữ pháp' : 'Thêm mẫu ngữ pháp'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mẫu ngữ pháp *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="～ば" />
            <Input label="Dạng tiếng Nhật" value={form.title_ja} onChange={e => setForm({ ...form, title_ja: e.target.value })} />
          </div>
          <Input label="Nghĩa (VI) *" value={form.meaning_vi} onChange={e => setForm({ ...form, meaning_vi: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Giải thích</label>
            <textarea value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })}
              className="w-full h-24 px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y" />
          </div>
          <Input label="Câu ví dụ" value={form.example_sentence} onChange={e => setForm({ ...form, example_sentence: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Level</label>
            <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">--</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
