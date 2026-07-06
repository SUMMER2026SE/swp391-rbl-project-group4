import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const STATUS_STYLE = {
  active:       'bg-emerald-100 text-emerald-700',
  grace_period: 'bg-amber-100 text-amber-700',
  expired:      'bg-gray-100 text-gray-500',
  cancelled:    'bg-gray-100 text-gray-500',
  pending:      'bg-blue-100 text-blue-600',
};

const STATUS_LABEL = {
  active:       'Đang hoạt động',
  grace_period: 'Ân hạn',
  expired:      'Hết hạn',
  cancelled:    'Đã huỷ',
  pending:      'Đang chờ',
};

export default function AdminSubscriptions() {
  const [subs,    setSubs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState('');
  const [loading, setLoading] = useState(true);
  const [grantForm, setGrantForm] = useState({ userId: '', days: 30, show: false });
  const [grantMsg, setGrantMsg]   = useState('');
  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page, limit: LIMIT, ...(status ? { status } : {}) });
    api.get(`/admin/subscriptions?${q}`)
      .then(r => { setSubs(r.data.subscriptions || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const handleGrant = async (e) => {
    e.preventDefault();
    setGrantMsg('');
    try {
      await api.post('/admin/subscriptions/grant', { user_id: grantForm.userId, duration_days: grantForm.days });
      setGrantMsg('Đã cấp Premium thành công!');
      setGrantForm(f => ({ ...f, userId: '' }));
      load();
    } catch (err) {
      setGrantMsg('Lỗi: ' + err.message);
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout title="Quản lý đăng ký">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Quản lý đăng ký</h1>
          <button onClick={() => setGrantForm(f => ({ ...f, show: !f.show }))}
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-white rounded-xl text-sm font-semibold hover:bg-amber-500 transition-colors">
            <span className="material-symbols-outlined text-lg">workspace_premium</span>
            Cấp Premium
          </button>
        </div>

        {/* Grant form */}
        {grantForm.show && (
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Cấp Premium thủ công</h3>
            <form onSubmit={handleGrant} className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-xs text-on-muted mb-1.5">User ID</label>
                <input type="text" placeholder="UUID của user..."
                  value={grantForm.userId}
                  onChange={e => setGrantForm(f => ({ ...f, userId: e.target.value }))}
                  className="px-3 py-2 border border-outline rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  required />
              </div>
              <div>
                <label className="block text-xs text-on-muted mb-1.5">Số ngày</label>
                <input type="number" min="1" max="365"
                  value={grantForm.days}
                  onChange={e => setGrantForm(f => ({ ...f, days: parseInt(e.target.value, 10) }))}
                  className="px-3 py-2 border border-outline rounded-xl text-sm w-24 focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <button type="submit" className="px-5 py-2 bg-amber-400 text-white rounded-xl text-sm font-semibold hover:bg-amber-500 transition-colors">
                Cấp
              </button>
            </form>
            {grantMsg && <p className={`mt-3 text-sm ${grantMsg.startsWith('Lỗi') ? 'text-red-500' : 'text-emerald-600'}`}>{grantMsg}</p>}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['', 'active', 'expired', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${status === s ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline hover:bg-surface-low'}`}>
              {s === '' ? 'Tất cả' : STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-outline/20 text-left text-xs text-on-muted">
                    <th className="px-4 py-3 font-semibold">User ID</th>
                    <th className="px-4 py-3 font-semibold">Gói</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold">Nguồn</th>
                    <th className="px-4 py-3 font-semibold">Hết hạn</th>
                    <th className="px-4 py-3 font-semibold">Tạo lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.length === 0
                    ? <tr><td colSpan={6} className="text-center text-on-muted py-10">Không có dữ liệu.</td></tr>
                    : subs.map(s => (
                      <tr key={s.id} className="border-b border-outline/10 hover:bg-surface-low/50">
                        <td className="px-4 py-3 font-mono text-xs text-on-muted">{s.user_id?.slice(0, 12)}…</td>
                        <td className="px-4 py-3 font-semibold">{s.plan?.name || s.tier}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[s.status] || 'bg-gray-100'}`}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-muted">{s.source}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-4 py-3 text-on-muted tabular-nums">
                          {new Date(s.created_at).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-outline text-sm disabled:opacity-40 hover:bg-surface-low transition-colors">← Trước</button>
            <span className="px-4 py-1.5 text-sm text-on-muted">{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="px-3 py-1.5 rounded-lg border border-outline text-sm disabled:opacity-40 hover:bg-surface-low transition-colors">Tiếp →</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
