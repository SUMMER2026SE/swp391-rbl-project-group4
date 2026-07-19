import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import { useLang } from '../../contexts/LangContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';

const EMPTY  = { character: '', reading_on: '', reading_kun: '', meaning_vi: '', stroke_count: '', level: '', han_viet: '' };
const LEVELS = ['N5','N4','N3','N2','N1'];
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

export default function AdminKanji() {
  const { t } = useLang();
  const confirm = useConfirm();

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
    if (!await confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/kanji/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetch(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const openImport = () => setImportModal(true);

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

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">font_download</span>
          <p className="text-lg font-semibold text-charcoal mb-1">{search ? 'Không tìm thấy kanji' : 'Chưa có kanji nào'}</p>
          <p className="text-sm">Bấm "{t('admin.create')}" để thêm kanji đầu tiên</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {data.map(row => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-surface-low shrink-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-tsubaki-red">{row.character}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate">
                  {row.meaning_vi}
                  {row.han_viet && <span className="ml-2 text-amber-600 font-normal text-xs">({row.han_viet})</span>}
                </p>
                <p className="text-xs text-on-muted truncate">{[...(row.reading_on||[]), ...(row.reading_kun||[])].join('、') || '—'}</p>
              </div>
              {row.stroke_count != null && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-on-muted shrink-0" title="Số nét">
                  <span className="material-symbols-outlined text-[15px]">gesture</span>{row.stroke_count}
                </span>
              )}
              {row.level && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full shrink-0 ${LEVEL_BADGE[row.level] || 'bg-gray-100 text-gray-600'}`}>{row.level}</span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => openEdit(row)} title="Sửa"
                  className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onClick={() => handleDelete(row)} title="Xóa"
                  className="p-1.5 text-on-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
