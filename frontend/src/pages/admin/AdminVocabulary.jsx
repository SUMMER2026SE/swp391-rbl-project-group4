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

const EMPTY  = { kanji: '', reading: '', meaning_vi: '', meaning_ja: '', level: '', type: '', topic: '', example_sentence: '' };
const LEVELS = ['N5','N4','N3','N2','N1'];
const TYPES  = ['DANH TỪ','ĐỘNG TỪ','TÍNH TỪ','PHÓ TỪ','LIÊN TỪ'];
const TOPICS = [
  'Chào hỏi','Gia đình','Đồ ăn & thức uống','Thời gian & ngày tháng',
  'Màu sắc','Cơ thể','Động vật','Trường học','Địa điểm',
  'Thời tiết & thiên nhiên','Giao thông','Hành động','Tính từ mô tả',
];

export default function AdminVocabulary() {
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
      const r = await api.get(`/vocabulary?${params}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page, level]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => {
    setForm({ kanji: row.kanji||'', reading: row.reading||'', meaning_vi: row.meaning_vi||'',
      meaning_ja: row.meaning_ja||'', level: row.level||'', type: row.type||'', topic: row.topic||'', example_sentence: row.example_sentence||'' });
    setEditId(row.id); setModal(true);
  };

  const handleSave = async () => {
    if (!form.reading || !form.meaning_vi) return setAlert({ type: 'error', msg: 'Reading và nghĩa là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/vocabulary/${editId}`, form);
      else        await api.post('/admin/vocabulary', form);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setModal(false); fetch();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/vocabulary/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetch(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const openImport = () => setImportModal(true);

  const COLS = [
    { key: 'kanji',      label: 'Kanji',  render: v => <span className="text-lg font-bold text-tsubaki-red">{v || '—'}</span> },
    { key: 'reading',    label: 'Reading' },
    { key: 'meaning_vi', label: 'Nghĩa' },
    { key: 'level',      label: 'Level' },
    { key: 'type',       label: 'Loại' },
    { key: 'topic',      label: 'Chủ đề', render: v => v ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{v}</span> : '—' },
  ];

  return (
    <AdminLayout title={t('admin.vocabulary')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-2xl font-bold">{t('admin.vocabulary')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2 flex-wrap">
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none">
            <option value="">Tất cả level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetch(); }} className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-36" />
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
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('admin.edit') : t('admin.create') + ' từ vựng'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kanji" value={form.kanji} onChange={e => setForm({...form, kanji: e.target.value})} placeholder="漢字" />
            <Input label="Reading *" value={form.reading} onChange={e => setForm({...form, reading: e.target.value})} placeholder="かなよみ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nghĩa (VI) *" value={form.meaning_vi} onChange={e => setForm({...form, meaning_vi: e.target.value})} />
            <Input label="Nghĩa (JA)" value={form.meaning_ja} onChange={e => setForm({...form, meaning_ja: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Level</label>
              <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">--</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Loại từ</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">--</option>
                {TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề</label>
            <select value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">-- Không có --</option>
              {TOPICS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </div>
          <Input label="Ví dụ" value={form.example_sentence} onChange={e => setForm({...form, example_sentence: e.target.value})} placeholder="Câu ví dụ..." />
        </div>
      </Modal>

      <ImportFileModal
        open={importModal}
        onClose={() => setImportModal(false)}
        type="vocab"
        previewUrl="/admin/vocabulary/import-file"
        importUrl="/admin/vocabulary/import"
        onImported={(msg) => { setAlert({ type: 'success', msg }); fetch(); }}
      />
    </AdminLayout>
  );
}
