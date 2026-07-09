import { useCallback, useEffect, useState } from 'react';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const EMPTY  = { title:'', title_ja:'', meaning_vi:'', explanation:'', example_sentence:'', level:'' };

const LEVEL_COLORS = {
  N5:'bg-emerald-100 text-emerald-700', N4:'bg-sky-100 text-sky-700',
  N3:'bg-violet-100 text-violet-700',   N2:'bg-orange-100 text-orange-700',
  N1:'bg-red-100 text-red-700',
};

export default function TeacherGrammar() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type:'', msg:'' });
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 30;

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async (p, l, s) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s) params.set('search', s);
      if (l) params.set('level', l);
      const r = await api.get(`/teacher/grammar-points?${params}`);
      setItems(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type:'error', msg:e.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, level, search); }, [page, level]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (row) => {
    setForm({
      title: row.title||'', title_ja: row.title_ja||'', meaning_vi: row.meaning_vi||'',
      explanation: row.explanation||'', example_sentence: row.example_sentence||'', level: row.level||'',
    });
    setEditId(row.id); setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.meaning_vi.trim()) return setAlert({ type:'error', msg:'Mẫu ngữ pháp và nghĩa là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/teacher/grammar-points/${editId}`, form);
      else        await api.post('/teacher/grammar-points', form);
      setAlert({ type:'success', msg:'Đã lưu — hiện ngay trong kho ngữ pháp chung.' });
      setModal(false); load(page, level, search);
    } catch(e) { setAlert({ type:'error', msg:e.message }); }
    finally { setSaving(false); }
  };

  return (
    <TeacherLayout title="Ngữ pháp">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({type:'',msg:''})} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Ngữ pháp</h1>
          <p className="text-sm text-on-muted mt-0.5">Thêm mẫu ngữ pháp mới sẽ vào kho chung ngay, không cần admin duyệt.</p>
        </div>
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Thêm mẫu ngữ pháp</Button>
      </div>

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
              <tr>{['Mẫu ngữ pháp','Nghĩa','Level','Ví dụ',''].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i} className="border-t border-outline/40 animate-pulse">
                  {[80,100,40,120,40].map((w,j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-surface-low rounded" style={{width:w}}/></td>)}
                </tr>
              )) : items.map((g,i) => (
                <tr key={g.id} className={`border-t border-outline/40 hover:bg-tsubaki-red/5 transition-colors ${i%2===1?'bg-surface-low/30':''}`}>
                  <td className="px-4 py-2.5 font-bold text-tsubaki-red">{g.title}</td>
                  <td className="px-4 py-2.5">{g.meaning_vi}</td>
                  <td className="px-4 py-2.5">{g.level ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[g.level]}`}>{g.level}</span> : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-on-muted italic max-w-[200px] truncate">{g.example_sentence || '—'}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => openEdit(g)} title="Sửa"
                      className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-on-muted">Không có dữ liệu</td></tr>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Sửa mẫu ngữ pháp' : 'Thêm mẫu ngữ pháp'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mẫu ngữ pháp *" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="～ば"/>
            <Input label="Dạng tiếng Nhật" value={form.title_ja} onChange={e => setForm({...form,title_ja:e.target.value})}/>
          </div>
          <Input label="Nghĩa (VI) *" value={form.meaning_vi} onChange={e => setForm({...form,meaning_vi:e.target.value})}/>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Giải thích</label>
            <textarea value={form.explanation} onChange={e => setForm({...form,explanation:e.target.value})}
              className="w-full h-24 px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y"/>
          </div>
          <Input label="Câu ví dụ" value={form.example_sentence} onChange={e => setForm({...form,example_sentence:e.target.value})}/>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Level</label>
            <select value={form.level} onChange={e => setForm({...form,level:e.target.value})}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">--</option>{LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </TeacherLayout>
  );
}
