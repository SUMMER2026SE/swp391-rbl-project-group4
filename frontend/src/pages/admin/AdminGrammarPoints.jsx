import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';

const EMPTY  = { title: '', title_ja: '', meaning_vi: '', explanation: '', example_sentence: '', level: '' };
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

export default function AdminGrammarPoints() {
  const confirm = useConfirm();
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [importModal, setImportModal] = useState(false);

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
    if (!await confirm('Xóa mẫu ngữ pháp này?')) return;
    try { await api.delete(`/admin/grammar-points/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetchData(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

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
          <Link to="/grammar" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">
              <span className="material-symbols-outlined text-lg">visibility</span> Xem như học viên
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => setImportModal(true)}>
            <span className="material-symbols-outlined text-lg">upload_file</span> Nhập file
          </Button>
          <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Thêm</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">spellcheck</span>
          <p className="text-lg font-semibold text-charcoal mb-1">{search ? 'Không tìm thấy mẫu ngữ pháp' : 'Chưa có mẫu ngữ pháp nào'}</p>
          <p className="text-sm">Bấm "Thêm" để thêm mẫu đầu tiên</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {data.map(row => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-surface-low shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-outline/40">spellcheck</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate">
                  <span className="text-tsubaki-red font-bold">{row.title}</span>
                </p>
                <p className="text-xs text-on-muted truncate">{row.meaning_vi}{row.example_sentence ? ` · ${row.example_sentence}` : ''}</p>
              </div>
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
      <ImportFileModal
        open={importModal}
        onClose={() => setImportModal(false)}
        type="grammar"
        previewUrl="/admin/grammar-points/import-file"
        importUrl="/admin/grammar-points/import"
        onImported={(msg) => { setAlert({ type: 'success', msg }); fetchData(); }}
      />
    </AdminLayout>
  );
}
