import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const STATUS_STYLE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL = { pending:'Chờ duyệt', approved:'Đã duyệt', rejected:'Bị từ chối' };

const LEVEL_COLORS = {
  N5:'bg-emerald-100 text-emerald-700', N4:'bg-sky-100 text-sky-700',
  N3:'bg-violet-100 text-violet-700',   N2:'bg-orange-100 text-orange-700',
  N1:'bg-red-100 text-red-700',
};

const joinArr = (v) => Array.isArray(v) ? v.join('、') : (v || '—');

export default function AdminSubmissions() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type:'', msg:'' });
  const [filter, setFilter]   = useState({ type:'', status:'pending' });
  const [selected, setSelected] = useState(null);
  const [note, setNote]       = useState('');
  const [processing, setProcessing] = useState('');

  const load = async (f = filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.type)   params.set('type', f.type);
      if (f.status) params.set('status', f.status);
      const r = await api.get(`/admin/submissions?${params}`);
      setItems(r.data || []);
    } catch(e) { setAlert({ type:'error', msg:'Không thể tải danh sách.' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const applyFilter = (patch) => {
    const f = { ...filter, ...patch };
    setFilter(f); load(f);
  };

  const openReview = (item) => { setSelected(item); setNote(''); };

  const handleAction = async (action) => {
    if (!selected) return;
    setProcessing(action);
    try {
      const endpoint = selected._kind === 'vocab'
        ? `/admin/submissions/vocab/${selected.id}/review`
        : `/admin/submissions/kanji/${selected.id}/review`;
      await api.post(endpoint, { action, note });
      setAlert({ type:'success', msg: action === 'approve' ? 'Đã duyệt và thêm vào hệ thống.' : 'Đã từ chối.' });
      setSelected(null); load();
    } catch(e) { setAlert({ type:'error', msg:e.message }); }
    finally { setProcessing(''); }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <AdminLayout title="Yêu cầu duyệt">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Yêu cầu duyệt</h1>
          {pendingCount > 0 && filter.status === 'pending' && (
            <p className="text-sm text-amber-600 mt-0.5">{pendingCount} yêu cầu đang chờ</p>
          )}
        </div>
      </div>

      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({type:'',msg:''})} className="mb-4">{alert.msg}</Alert>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm">
          {[['','Tất cả loại'],['vocab','Từ vựng'],['kanji','Kanji']].map(([v,l]) => (
            <button key={v} onClick={() => applyFilter({type:v})}
              className={`px-4 py-2 transition-colors ${filter.type===v ? 'bg-tsubaki-red text-white' : 'bg-white text-on-muted hover:bg-surface-low'}`}>{l}</button>
          ))}
        </div>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm">
          {[['pending','Chờ duyệt'],['approved','Đã duyệt'],['rejected','Từ chối'],['all','Tất cả']].map(([v,l]) => (
            <button key={v} onClick={() => applyFilter({status:v})}
              className={`px-4 py-2 transition-colors ${filter.status===v ? 'bg-tsubaki-red text-white' : 'bg-white text-on-muted hover:bg-surface-low'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low border-b border-outline/40">
              <tr>{['Loại','Nội dung','Giáo viên','Level','Trạng thái','Ghi chú Admin',''].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:6}).map((_,i) => (
                <tr key={i} className="border-t border-outline/40 animate-pulse">
                  {[60,140,100,50,80,100,80].map((w,j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-surface-low rounded" style={{width:w}}/></td>)}
                </tr>
              )) : items.map((item,i) => (
                <tr key={`${item._kind}-${item.id}`} className={`border-t border-outline/40 hover:bg-surface-low/50 transition-colors ${i%2===1?'bg-surface-low/30':''}`}>
                  <td className="px-4 py-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item._kind==='vocab' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {item._kind === 'vocab' ? 'Từ vựng' : 'Kanji'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {item._kind === 'vocab' ? (
                      <div>
                        <span className="text-xl font-bold text-tsubaki-red mr-2">{item.kanji||item.reading}</span>
                        <span className="text-xs text-on-muted">{item.reading} — {item.meaning_vi}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-2xl font-bold text-tsubaki-red mr-2">{item.character}</span>
                        <span className="text-xs text-on-muted">{item.meaning_vi}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-xs">{item.teacher?.full_name || '—'}</p>
                    <p className="text-on-muted text-xs">{item.teacher?.email}</p>
                  </td>
                  <td className="px-4 py-2.5">{item.level ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level]||'bg-surface-low text-on-muted'}`}>{item.level}</span> : '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[item.status]||'bg-surface-low text-on-muted'}`}>{STATUS_LABEL[item.status]||item.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-on-muted max-w-[140px] truncate">{item.admin_note||'—'}</td>
                  <td className="px-4 py-2.5">
                    {item.status === 'pending' && (
                      <button onClick={() => openReview(item)}
                        className="px-3 py-1.5 bg-tsubaki-red text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-all">
                        Xem xét
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-on-muted">Không có yêu cầu nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Xem xét yêu cầu"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button>
            <button onClick={() => handleAction('reject')} disabled={!!processing}
              className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
              {processing==='reject' ? 'Đang từ chối...' : 'Từ chối'}
            </button>
            <button onClick={() => handleAction('approve')} disabled={!!processing}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
              {processing==='approve' ? 'Đang duyệt...' : 'Duyệt'}
            </button>
          </div>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-low rounded-xl">
              {selected._kind === 'vocab' ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-tsubaki-red">{selected.kanji||selected.reading}</span>
                    <span className="text-xl text-on-muted">{selected.reading}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div><span className="text-on-muted">Nghĩa VI: </span><strong>{selected.meaning_vi}</strong></div>
                    <div><span className="text-on-muted">Nghĩa JA: </span><strong>{selected.meaning_ja||'—'}</strong></div>
                    <div><span className="text-on-muted">Level: </span>{selected.level ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[selected.level]}`}>{selected.level}</span> : '—'}</div>
                    <div><span className="text-on-muted">Loại: </span><strong>{selected.type||'—'}</strong></div>
                    {selected.example_sentence && <div className="col-span-2"><span className="text-on-muted">Ví dụ: </span><em>{selected.example_sentence}</em></div>}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-5xl font-bold text-tsubaki-red">{selected.character}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div><span className="text-on-muted">Nghĩa VI: </span><strong>{selected.meaning_vi}</strong></div>
                    <div><span className="text-on-muted">Level: </span>{selected.level ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[selected.level]}`}>{selected.level}</span> : '—'}</div>
                    <div><span className="text-on-muted">On-yomi: </span><strong>{joinArr(selected.reading_on)}</strong></div>
                    <div><span className="text-on-muted">Kun-yomi: </span><strong>{joinArr(selected.reading_kun)}</strong></div>
                    <div><span className="text-on-muted">Số nét: </span><strong>{selected.stroke_count ?? '—'}</strong></div>
                  </div>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-outline/40 text-xs text-on-muted">
                Giáo viên: <strong>{selected.teacher?.full_name || selected.teacher?.email}</strong>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Ghi chú cho giáo viên (tuỳ chọn)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Lý do từ chối hoặc ghi chú bổ sung..."
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none"/>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
