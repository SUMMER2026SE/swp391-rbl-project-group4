import { useCallback, useEffect, useState } from 'react';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import api from '../../lib/api';

const TYPE_TO_IMPORT = { vocabulary: 'vocab', kanji: 'kanji', grammar: 'grammar' };

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SEARCH_ENDPOINT = { vocabulary: '/vocabulary', kanji: '/kanji', grammar: '/grammar-points' };
const ITEM_LABEL = (type, item) => type === 'kanji' ? item.character : type === 'grammar' ? item.title : (item.kanji || item.reading);
const ITEM_SUB   = (type, item) => type === 'grammar' ? item.meaning_vi : item.meaning_vi;

function ItemPickerModal({ open, onClose, post, listType, onChanged }) {
  const [detail, setDetail]     = useState(null);
  const [search, setSearch]     = useState('');
  const [results, setResults]   = useState([]);
  const [alert, setAlert]       = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!post) return;
    const r = await api.get(`/study-lists/${post.id}`);
    setDetail(r.data);
  }, [post]);

  useEffect(() => { if (open) { loadDetail(); setSearch(''); setResults([]); setAlert(''); } }, [open, loadDetail]);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    const r = await api.get(`${SEARCH_ENDPOINT[listType]}?search=${encodeURIComponent(search)}&limit=10`);
    setResults(r.data.data || []);
  };

  const addItem = async (item_id) => {
    try {
      await api.post(`/study-lists/${post.id}/items`, { item_id });
      await loadDetail();
      onChanged();
    } catch (e) { setAlert(e.message); }
  };

  const removeItem = async (item_id) => {
    try {
      await api.delete(`/study-lists/${post.id}/items/${item_id}`);
      await loadDetail();
      onChanged();
    } catch (e) { setAlert(e.message); }
  };

  const currentIds = new Set((detail?.items || []).map(i => i.id));

  return (
    <>
    <Modal open={open} onClose={onClose} title={`Quản lý mục — ${post?.title || ''}`} size="lg">
      <div className="space-y-4">
        {alert && <Alert type="error" onClose={() => setAlert('')}>{alert}</Alert>}

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span>
            Nhập file / JSON
          </Button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm để thêm vào danh sách..."
            className="flex-1 px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
          <Button type="submit" size="sm">Tìm</Button>
        </form>

        {results.length > 0 && (
          <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-40 overflow-y-auto">
            {results.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><strong>{ITEM_LABEL(listType, item)}</strong> — {ITEM_SUB(listType, item)}</span>
                {currentIds.has(item.id) ? (
                  <span className="text-xs text-on-muted">Đã thêm</span>
                ) : (
                  <button onClick={() => addItem(item.id)} className="text-tsubaki-red text-xs font-semibold hover:underline">+ Thêm</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-on-muted mb-2">Đang có {detail?.items?.length || 0} mục:</p>
          {!detail?.items?.length ? (
            <p className="text-sm text-on-muted">Chưa có mục nào — tìm và thêm ở trên.</p>
          ) : (
            <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-56 overflow-y-auto">
              {detail.items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span><strong>{ITEM_LABEL(listType, item)}</strong> — {ITEM_SUB(listType, item)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-on-muted hover:text-error">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>

    <ImportFileModal
      open={importOpen}
      onClose={() => setImportOpen(false)}
      type={TYPE_TO_IMPORT[listType]}
      studyListId={post?.id}
      onImported={async (msg) => {
        await loadDetail();
        onChanged();
        setImportOpen(false);
        setAlert('');
      }}
    />
    </>
  );
}

export default function TeacherStudyLists() {
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ title: '', description: '', level: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pickerPost, setPickerPost] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/study-lists?type=${type}&mine=true&limit=100`);
      setItems(r.data.data || []);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ title: '', description: '', level: '' }); setEditId(null); setModal(true); };
  const openEdit = (post) => { setForm({ title: post.title, description: post.description || '', level: post.level || '' }); setEditId(post.id); setModal(true); };

  const handleSave = async () => {
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (!form.level) return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/study-lists/${editId}`, { title: form.title, description: form.description, level: form.level });
        setModal(false);
        await load();
      } else {
        const r = await api.post('/study-lists', { list_type: type, title: form.title, description: form.description, level: form.level });
        setModal(false);
        await load();
        setPickerPost(r.data);
      }
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (post) => {
    if (!confirm(`Xóa bài đăng "${post.title}"?`)) return;
    try { await api.delete(`/study-lists/${post.id}`); load(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  return (
    <TeacherLayout title="Bài đăng danh sách">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng danh sách</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {TYPES.map(([key, icon, label]) => (
            <button key={key} onClick={() => setType(key)}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${type === key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Tạo bài đăng</Button>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">library_books</span>
          <p className="text-on-muted">Bạn chưa tạo bài đăng nào cho mục này.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-low border-b border-outline/40">
                <tr>{['Tiêu đề', 'Cấp độ', 'Số mục', 'Lượt xem', ''].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((post, i) => (
                  <tr key={post.id} className={`border-t border-outline/40 ${i % 2 === 1 ? 'bg-surface-low/30' : ''}`}>
                    <td className="px-4 py-2.5 font-medium">{post.title}</td>
                    <td className="px-4 py-2.5">{post.level || '—'}</td>
                    <td className="px-4 py-2.5">{post.item_count}</td>
                    <td className="px-4 py-2.5">{post.view_count}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEdit(post)} title="Sửa"
                          className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button onClick={() => setPickerPost(post)} title="Quản lý mục"
                          className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                          <span className="material-symbols-outlined text-lg">list</span>
                        </button>
                        <button onClick={() => handleDelete(post)} title="Xóa"
                          className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Sửa bài đăng' : 'Tạo bài đăng'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>{editId ? 'Lưu' : 'Tạo'}</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ *</label>
            <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">-- Chọn cấp độ --</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <Input label="Mô tả" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>

      <ItemPickerModal open={!!pickerPost} onClose={() => { setPickerPost(null); load(); }} post={pickerPost} listType={type} onChanged={load} />
    </TeacherLayout>
  );
}
