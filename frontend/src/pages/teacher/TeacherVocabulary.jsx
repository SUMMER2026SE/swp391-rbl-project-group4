import { useCallback, useEffect, useRef, useState } from 'react';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const TYPES  = ['DANH TỪ','ĐỘNG TỪ','TÍNH TỪ','PHÓ TỪ','LIÊN TỪ'];
const EMPTY  = { kanji:'', reading:'', meaning_vi:'', meaning_ja:'', level:'', type:'', example_sentence:'' };

const STATUS_STYLE = {
  draft:    'bg-surface-low text-on-muted',
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL = { draft:'Nháp', pending:'Chờ duyệt', approved:'Đã duyệt', rejected:'Bị từ chối' };

const TYPE_COLORS = {
  'DANH TỪ':'bg-blue-100 text-blue-700','ĐỘNG TỪ':'bg-green-100 text-green-700',
  'TÍNH TỪ':'bg-amber-100 text-amber-700','PHÓ TỪ':'bg-purple-100 text-purple-700',
  'LIÊN TỪ':'bg-rose-100 text-rose-700',
};

const LEVEL_COLORS = {
  N5:'bg-emerald-100 text-emerald-700', N4:'bg-sky-100 text-sky-700',
  N3:'bg-violet-100 text-violet-700',   N2:'bg-orange-100 text-orange-700',
  N1:'bg-red-100 text-red-700',
};

// ── System tab ────────────────────────────────────────────────────────────────
function SystemTab() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 30;

  const load = useCallback(async (p, l, s) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s) params.set('search', s);
      if (l) params.set('level', l);
      const r = await api.get(`/vocabulary?${params}`);
      setItems(r.data.data || []); setTotal(r.data.total || 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, level, search); }, [page, level]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setLevel(''); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!level ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>Tất cả</button>
          {LEVELS.map(l => (
            <button key={l} onClick={() => { setLevel(l); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${level === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); setPage(1); load(1, level, search); }} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm..."
            className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-44" />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl"><span className="material-symbols-outlined text-lg">search</span></button>
        </form>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low border-b border-outline/40">
              <tr>{['Kanji','Reading','Nghĩa VI','Nghĩa JA','Level','Loại','Ví dụ'].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i} className="border-t border-outline/40 animate-pulse">
                  {[40,60,80,60,40,56,100].map((w,j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-surface-low rounded" style={{width:w}}/></td>)}
                </tr>
              )) : items.map((v,i) => (
                <tr key={v.id} className={`border-t border-outline/40 hover:bg-tsubaki-red/5 transition-colors ${i%2===1?'bg-surface-low/30':''}`}>
                  <td className="px-4 py-2.5 text-xl font-bold text-tsubaki-red">{v.kanji||'—'}</td>
                  <td className="px-4 py-2.5 font-medium">{v.reading}</td>
                  <td className="px-4 py-2.5">{v.meaning_vi}</td>
                  <td className="px-4 py-2.5 text-xs text-on-muted">{v.meaning_ja||'—'}</td>
                  <td className="px-4 py-2.5">{v.level ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[v.level]}`}>{v.level}</span> : '—'}</td>
                  <td className="px-4 py-2.5">{v.type ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[v.type]||'bg-surface-low text-on-muted'}`}>{v.type}</span> : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-on-muted italic max-w-[180px] truncate">{v.example_sentence||'—'}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-on-muted">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
          <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}
    </div>
  );
}

// ── My tab ────────────────────────────────────────────────────────────────────
function MyTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type:'', msg:'' });
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [submitting, setSubmitting] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/teacher/my-vocab'); setItems(r.data.data || []); }
    catch (e) { setAlert({ type:'error', msg:e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (row) => {
    setForm({ kanji:row.kanji||'', reading:row.reading||'', meaning_vi:row.meaning_vi||'',
      meaning_ja:row.meaning_ja||'', level:row.level||'', type:row.type||'', example_sentence:row.example_sentence||'' });
    setEditId(row.id); setModal(true);
  };

  const handleSave = async () => {
    if (!form.reading||!form.meaning_vi) return setAlert({ type:'error', msg:'Reading và nghĩa là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/teacher/my-vocab/${editId}`, form);
      else        await api.post('/teacher/my-vocab', form);
      setAlert({ type:'success', msg:'Đã lưu.' }); setModal(false); load();
    } catch(e) { setAlert({ type:'error', msg:e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa từ vựng này?')) return;
    try { await api.delete(`/teacher/my-vocab/${id}`); load(); }
    catch(e) { setAlert({ type:'error', msg:e.message }); }
  };

  const handleSubmit = async (id) => {
    setSubmitting(id);
    try {
      await api.post(`/teacher/my-vocab/${id}/submit`);
      setAlert({ type:'success', msg:'Đã gửi yêu cầu duyệt lên Admin.' }); load();
    } catch(e) { setAlert({ type:'error', msg:e.message }); }
    finally { setSubmitting(null); }
  };

  return (
    <div>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({type:'',msg:''})} className="mb-4">{alert.msg}</Alert>}

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Thêm từ vựng</Button>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">translate</span>
          <p className="text-on-muted">Bạn chưa tạo từ vựng nào.</p>
          <button onClick={openCreate} className="mt-3 text-sm text-tsubaki-red font-semibold hover:underline">Tạo ngay</button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-low border-b border-outline/40">
                <tr>{['Kanji','Reading','Nghĩa VI','Level','Loại','Trạng thái',''].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((v,i) => (
                  <tr key={v.id} className={`border-t border-outline/40 hover:bg-surface-low/50 transition-colors ${i%2===1?'bg-surface-low/30':''}`}>
                    <td className="px-4 py-2.5 text-xl font-bold text-tsubaki-red">{v.kanji||'—'}</td>
                    <td className="px-4 py-2.5 font-medium">{v.reading}</td>
                    <td className="px-4 py-2.5">{v.meaning_vi}</td>
                    <td className="px-4 py-2.5">{v.level ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[v.level]}`}>{v.level}</span> : '—'}</td>
                    <td className="px-4 py-2.5">{v.type ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[v.type]||'bg-surface-low text-on-muted'}`}>{v.type}</span> : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
                      {v.status === 'rejected' && v.admin_note && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-[160px]" title={v.admin_note}>💬 {v.admin_note}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 justify-end">
                        {(v.status === 'draft' || v.status === 'rejected') && (
                          <>
                            <button onClick={() => openEdit(v)} title="Sửa"
                              className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => handleSubmit(v.id)} disabled={submitting===v.id} title="Gửi duyệt"
                              className="p-1.5 rounded-lg text-on-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40">
                              <span className="material-symbols-outlined text-lg">send</span>
                            </button>
                          </>
                        )}
                        {v.status !== 'approved' && (
                          <button onClick={() => handleDelete(v.id)} title="Xóa"
                            className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Sửa từ vựng' : 'Thêm từ vựng'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kanji" value={form.kanji} onChange={e => setForm({...form,kanji:e.target.value})} placeholder="漢字"/>
            <Input label="Reading *" value={form.reading} onChange={e => setForm({...form,reading:e.target.value})} placeholder="かなよみ"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nghĩa (VI) *" value={form.meaning_vi} onChange={e => setForm({...form,meaning_vi:e.target.value})}/>
            <Input label="Nghĩa (JA)" value={form.meaning_ja} onChange={e => setForm({...form,meaning_ja:e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Level</label>
              <select value={form.level} onChange={e => setForm({...form,level:e.target.value})}
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">--</option>{LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Loại từ</label>
              <select value={form.type} onChange={e => setForm({...form,type:e.target.value})}
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">--</option>{TYPES.map(tp=><option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>
          </div>
          <Input label="Ví dụ" value={form.example_sentence} onChange={e => setForm({...form,example_sentence:e.target.value})} placeholder="Câu ví dụ..."/>
        </div>
      </Modal>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherVocabulary() {
  const [tab, setTab] = useState('system');
  return (
    <TeacherLayout title="Từ vựng">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Từ vựng</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {[['system','dataset','Hệ thống'],['mine','person','Của tôi']].map(([key,icon,label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${tab===key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'system' ? <SystemTab /> : <MyTab />}
    </TeacherLayout>
  );
}
