import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { adminListTeacherApplications, adminReviewTeacherApplication } from '../../lib/api';

const STATUS_STYLE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const DOC_LABEL = { cv: 'CV', degree: 'Bằng cấp', certificate: 'Chứng chỉ', other: 'Khác' };

export default function AdminTeacherApplications() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [status, setStatus]   = useState('pending');
  const [selected, setSelected] = useState(null);
  const [note, setNote]       = useState('');
  const [processing, setProcessing] = useState('');

  const load = async (s = status) => {
    setLoading(true);
    try {
      const rows = await adminListTeacherApplications(s);
      setItems(rows || []);
    } catch { setAlert({ type: 'error', msg: 'Không thể tải danh sách đơn.' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const applyStatus = (s) => { setStatus(s); load(s); };
  const openReview = (item) => { setSelected(item); setNote(''); };

  const handleAction = async (action) => {
    if (!selected) return;
    setProcessing(action);
    try {
      const r = await adminReviewTeacherApplication(selected.id, { action, note });
      setAlert({ type: 'success', msg: r.message || 'Đã xử lý.' });
      setSelected(null); load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setProcessing(''); }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <AdminLayout title="Đơn giáo viên">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Đơn đăng ký giáo viên</h1>
          {pendingCount > 0 && status === 'pending' && (
            <p className="text-sm text-amber-600 mt-0.5">{pendingCount} đơn đang chờ</p>
          )}
        </div>
      </div>

      {alert.msg && <div className="mb-4"><Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert></div>}

      {/* Status filter */}
      <div className="flex rounded-xl border border-outline overflow-hidden text-sm mb-4 w-fit">
        {[['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối'], ['all', 'Tất cả']].map(([v, l]) => (
          <button key={v} onClick={() => applyStatus(v)}
            className={`px-4 py-2 transition-colors ${status === v ? 'bg-tsubaki-red text-white' : 'bg-white text-on-muted hover:bg-surface-low'}`}>{l}</button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low border-b border-outline/40">
              <tr>{['Ứng viên', 'Bằng cấp', 'AI', 'Trạng thái', 'Ngày gửi', ''].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-outline/40 animate-pulse">
                  {[160, 120, 60, 80, 90, 70].map((w, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-surface-low rounded" style={{ width: w }} /></td>)}
                </tr>
              )) : items.map((item, i) => (
                <tr key={item.id} className={`border-t border-outline/40 hover:bg-surface-low/50 transition-colors ${i % 2 === 1 ? 'bg-surface-low/30' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-xs">{item.applicant?.full_name || '—'}</p>
                    <p className="text-on-muted text-xs">{item.applicant?.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[160px] truncate" title={item.highest_qualification}>{item.highest_qualification || '—'}</td>
                  <td className="px-4 py-2.5">
                    {item.ai_confidence != null && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.ai_verdict === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.ai_confidence}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[item.status] || 'bg-surface-low text-on-muted'}`}>{STATUS_LABEL[item.status] || item.status}</span>
                    {item.decided_by && <span className="ml-1 text-[10px] text-on-muted">({item.decided_by === 'ai' ? 'AI' : 'Admin'})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-on-muted">{new Date(item.created_at).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => openReview(item)}
                      className="px-3 py-1.5 bg-tsubaki-red text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-all">
                      Xem xét
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-on-muted">Không có đơn nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Xem xét đơn giáo viên" size="lg"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button>
            {selected?.status === 'approved' ? (
              <button onClick={() => handleAction('revoke')} disabled={!!processing}
                className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {processing === 'revoke' ? 'Đang thu hồi...' : 'Thu hồi quyền'}
              </button>
            ) : selected?.status === 'pending' ? (
              <>
                <button onClick={() => handleAction('reject')} disabled={!!processing}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                  {processing === 'reject' ? 'Đang từ chối...' : 'Từ chối'}
                </button>
                <button onClick={() => handleAction('approve')} disabled={!!processing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                  {processing === 'approve' ? 'Đang duyệt...' : 'Duyệt & cấp quyền'}
                </button>
              </>
            ) : (
              <button onClick={() => handleAction('approve')} disabled={!!processing}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {processing === 'approve' ? 'Đang duyệt...' : 'Duyệt lại & cấp quyền'}
              </button>
            )}
          </div>
        }>
        {selected && (
          <div className="space-y-4">
            {/* Applicant */}
            <div className="p-4 bg-surface-low rounded-xl">
              <p className="font-bold text-charcoal">{selected.applicant?.full_name || '—'}</p>
              <p className="text-xs text-on-muted mb-3">{selected.applicant?.email}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-on-muted">Bằng cấp: </span><strong>{selected.highest_qualification || '—'}</strong></div>
                <div><span className="text-on-muted">Chuyên môn: </span><strong>{selected.specialization || '—'}</strong></div>
                <div><span className="text-on-muted">Kinh nghiệm: </span><strong>{selected.years_experience ?? '—'} năm</strong></div>
                <div><span className="text-on-muted">SĐT: </span><strong>{selected.phone || '—'}</strong></div>
                {selected.education && <div className="col-span-2"><span className="text-on-muted">Học vấn: </span>{selected.education}</div>}
                {selected.bio && <div className="col-span-2"><span className="text-on-muted">Giới thiệu: </span>{selected.bio}</div>}
              </div>
            </div>

            {/* AI review */}
            <div className="p-4 rounded-xl border border-sumire-purple/20 bg-sumire-purple/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-sumire-purple text-lg">auto_awesome</span>
                <p className="font-semibold text-sm">Đánh giá của AI</p>
                {selected.ai_confidence != null && (
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${selected.ai_verdict === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selected.ai_verdict === 'approve' ? 'Đề xuất duyệt' : 'Cần xem xét'} · {selected.ai_confidence}%
                  </span>
                )}
              </div>
              {selected.ai_summary && <p className="text-sm text-charcoal mb-2">{selected.ai_summary}</p>}
              {selected.ai_flags?.missing?.length > 0 && (
                <div className="text-xs mb-1"><span className="font-semibold text-amber-700">Thiếu: </span>{selected.ai_flags.missing.join('; ')}</div>
              )}
              {selected.ai_flags?.anomalies?.length > 0 && (
                <div className="text-xs"><span className="font-semibold text-red-600">Bất thường: </span>{selected.ai_flags.anomalies.join('; ')}</div>
              )}
            </div>

            {/* Documents */}
            <div>
              <p className="text-sm font-semibold text-on-muted mb-2">Tài liệu ({selected.documents?.length || 0})</p>
              <div className="space-y-1.5">
                {(selected.documents || []).map((d, i) => (
                  <a key={i} href={d.url || '#'} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 p-2 rounded-xl border text-sm transition-colors ${d.url ? 'border-outline/60 hover:bg-surface-low' : 'border-outline/30 opacity-50 pointer-events-none'}`}>
                    <span className="material-symbols-outlined text-on-muted text-lg">description</span>
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted font-semibold">{DOC_LABEL[d.type] || d.type}</span>
                    <span className="material-symbols-outlined text-on-muted text-base">open_in_new</span>
                  </a>
                ))}
              </div>
            </div>

            {selected.admin_note && (
              <p className="text-xs text-on-muted">Ghi chú trước đó: {selected.admin_note}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Ghi chú (tuỳ chọn)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Lý do từ chối / thu hồi hoặc ghi chú..."
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
