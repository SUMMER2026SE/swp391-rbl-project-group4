import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const EMPTY  = { kanji: '', reading: '', meaning_vi: '', meaning_ja: '', level: '', type: '', topic: '', example_sentence: '', han_viet: '' };
const LEVELS = ['N5','N4','N3','N2','N1'];
const TYPES  = ['DANH TỪ','ĐỘNG TỪ','TÍNH TỪ','PHÓ TỪ','LIÊN TỪ'];
const TOPICS = [
  'Chào hỏi','Gia đình','Đồ ăn & thức uống','Thời gian & ngày tháng',
  'Màu sắc','Cơ thể','Động vật','Trường học','Địa điểm',
  'Thời tiết & thiên nhiên','Giao thông','Hành động','Tính từ mô tả',
];
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

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
      meaning_ja: row.meaning_ja||'', level: row.level||'', type: row.type||'', topic: row.topic||'', example_sentence: row.example_sentence||'', han_viet: row.han_viet||'' });
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

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">translate</span>
          <p className="text-lg font-semibold text-charcoal mb-1">{search ? 'Không tìm thấy từ vựng' : 'Chưa có từ vựng nào'}</p>
          <p className="text-sm">Bấm "{t('admin.create')}" để thêm từ đầu tiên</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {data.map(row => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-surface-low overflow-hidden shrink-0 flex items-center justify-center">
                {row.image_url
                  ? <img src={row.image_url} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  : <span className="material-symbols-outlined text-outline/40">image</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate">
                  <span className="text-tsubaki-red font-bold">{row.kanji || row.reading}</span>
                  {row.kanji && <span className="ml-2 text-on-muted font-normal text-xs">{row.reading}</span>}
                  {row.han_viet && <span className="ml-2 text-amber-600 font-normal text-xs">({row.han_viet})</span>}
                </p>
                <p className="text-xs text-on-muted truncate">{row.meaning_vi}</p>
              </div>
              {row.level && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full shrink-0 ${LEVEL_BADGE[row.level] || 'bg-gray-100 text-gray-600'}`}>{row.level}</span>
              )}
              {row.type && (
                <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold rounded-full shrink-0 bg-slate-100 text-slate-600">{row.type}</span>
              )}
              {row.topic && (
                <span className="hidden md:inline-block px-2 py-0.5 text-xs font-medium rounded-full shrink-0 bg-sumire-purple/10 text-sumire-purple">{row.topic}</span>
              )}
              <span className="hidden lg:flex items-center gap-1 text-xs text-on-muted w-28 shrink-0 truncate" title={row.creator_name ? `Tạo bởi ${row.creator_name}` : 'Hệ thống — mọi giáo viên đều sửa được'}>
                <span className="material-symbols-outlined text-[15px]">{row.creator_name ? 'person' : 'public'}</span>
                {row.creator_name || 'Hệ thống'}
              </span>
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
          {form.kanji && (
            <Input label="Hán Việt" value={form.han_viet} onChange={e => setForm({...form, han_viet: e.target.value})} placeholder="vd: an toàn" />
          )}
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
