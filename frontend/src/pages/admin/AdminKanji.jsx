import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const EMPTY  = { character: '', reading_on: '', reading_kun: '', meaning_vi: '', stroke_count: '', level: '', han_viet: '' };
const LEVELS = ['N5','N4','N3','N2','N1'];

export default function AdminKanji() {
  const { t } = useLang();

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

  const [importModal, setImportModal] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      const r = await api.get(`/kanji?${params}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page, level]);

  const toArr = (s) => typeof s === 'string' ? s.split(',').map(x => x.trim()).filter(Boolean) : (s || []);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => {
    setForm({ character: row.character||'', reading_on: (row.reading_on||[]).join(', '),
      reading_kun: (row.reading_kun||[]).join(', '), meaning_vi: row.meaning_vi||'',
      stroke_count: row.stroke_count||'', level: row.level||'', han_viet: row.han_viet||'' });
    setEditId(row.id); setModal(true);
  };

  const handleSave = async () => {
    if (!form.character || !form.meaning_vi) return setAlert({ type: 'error', msg: 'Kanji và nghĩa là bắt buộc.' });
    const payload = { ...form, reading_on: toArr(form.reading_on), reading_kun: toArr(form.reading_kun), stroke_count: form.stroke_count ? Number(form.stroke_count) : null };
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/kanji/${editId}`, payload);
      else        await api.post('/admin/kanji', payload);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setModal(false); fetch();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/kanji/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetch(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const openImport = () => setImportModal(true);

  const fmtArr = (v) => Array.isArray(v) ? v.join(', ') : (v || '—');

  const COLS = [
    { key: 'character',    label: 'Kanji', render: v => <span className="text-2xl font-bold text-tsubaki-red">{v}</span> },
    { key: 'han_viet',     label: 'Hán Việt', render: v => v ? <span className="font-semibold text-amber-600">{v}</span> : '—' },
    { key: 'meaning_vi',   label: 'Nghĩa' },
    { key: 'stroke_count', label: 'Nét' },
    { key: 'level',        label: 'Level' },
  ];

  return (
    <AdminLayout title={t('admin.kanji')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-2xl font-bold">{t('admin.kanji')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2 flex-wrap">
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none">
            <option value="">Tất cả level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetch(); }} className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm..." className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-32" />
            <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl"><span className="material-symbols-outlined text-lg">search</span></button>
          </form>
          <Button variant="secondary" onClick={openImport}>
            <span className="material-symbols-outlined text-lg">upload_file</span> Nhập file
          </Button>
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

      {/* ── Edit / Create modal ─────────────────────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('admin.edit') : t('admin.create') + ' kanji'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kanji *" value={form.character} onChange={e => setForm({...form, character: e.target.value})} placeholder="漢" />
            <Input label="Số nét" type="number" value={form.stroke_count} onChange={e => setForm({...form, stroke_count: e.target.value})} />
          </div>
          <Input label="On-yomi (phân cách bởi dấu phẩy)" value={form.reading_on} onChange={e => setForm({...form, reading_on: e.target.value})} placeholder="カン, ハン" />
          <Input label="Kun-yomi (phân cách bởi dấu phẩy)" value={form.reading_kun} onChange={e => setForm({...form, reading_kun: e.target.value})} placeholder="おとこ" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nghĩa (VI) *" value={form.meaning_vi} onChange={e => setForm({...form, meaning_vi: e.target.value})} />
            <Input label="Hán Việt" value={form.han_viet} onChange={e => setForm({...form, han_viet: e.target.value})} placeholder="vd: Sơn, Nhật..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Level</label>
            <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">--</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <ImportFileModal
        open={importModal}
        onClose={() => setImportModal(false)}
        type="kanji"
        previewUrl="/admin/kanji/import-file"
        importUrl="/admin/kanji/import"
        onImported={(msg) => { setAlert({ type: 'success', msg }); fetch(); }}
      />
    </AdminLayout>
  );
}
