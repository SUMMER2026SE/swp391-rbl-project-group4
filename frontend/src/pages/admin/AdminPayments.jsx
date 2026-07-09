import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const STATUS_STYLE = {
  paid:      'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  expired:   'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-500',
  failed:    'bg-red-100 text-red-600',
};

const STATUS_LABEL = {
  paid:      'Đã thanh toán',
  pending:   'Chờ thanh toán',
  expired:   'Hết hạn',
  cancelled: 'Đã huỷ',
  failed:    'Thất bại',
};

export default function AdminPayments() {
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState('');
  const [type,    setType]    = useState('subscription'); // 'subscription' | 'course'
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState('');
  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page, limit: LIMIT, type, ...(status ? { status } : {}) });
    api.get(`/admin/payments?${q}`)
      .then(r => { setOrders(r.data.orders || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, status, type]);

  useEffect(() => { load(); }, [load]);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMsg('');
    try {
      const r = await api.post('/admin/payments/reconcile');
      setReconcileMsg(`Đã kiểm tra ${r.data.checked} giao dịch, khớp ${r.data.matched} đơn.`);
      if (r.data.matched > 0) load();
    } catch (err) {
      setReconcileMsg('Lỗi: ' + err.message);
    } finally {
      setReconciling(false);
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout title="Quản lý thanh toán">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-display text-2xl font-bold">Lịch sử thanh toán</h1>
          <div className="flex items-center gap-3">
            {reconcileMsg && <span className={`text-sm ${reconcileMsg.startsWith('Lỗi') ? 'text-red-500' : 'text-emerald-600'}`}>{reconcileMsg}</span>}
            <button onClick={handleReconcile} disabled={reconciling}
              className="flex items-center gap-2 px-4 py-2 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
              {reconciling
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-lg">sync</span>
              }
              Đồng bộ SePay
            </button>
          </div>
        </div>

        {/* Loại giao dịch: premium subscription / mua khóa học */}
        <div className="flex gap-2">
          {[['subscription', 'Premium'], ['course', 'Khóa học']].map(([t, label]) => (
            <button key={t} onClick={() => { setType(t); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${type === t ? 'bg-sumire-purple text-white border-sumire-purple' : 'border-outline hover:bg-surface-low'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['', 'paid', 'pending', 'expired', 'cancelled'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${status === s ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline hover:bg-surface-low'}`}>
              {s === '' ? 'Tất cả' : STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-outline/20 text-left text-xs text-on-muted">
                    <th className="px-4 py-3 font-semibold">Mã đơn</th>
                    <th className="px-4 py-3 font-semibold">Mã CK</th>
                    <th className="px-4 py-3 font-semibold">{type === 'course' ? 'Khóa học' : 'Gói'}</th>
                    {type === 'course' && <th className="px-4 py-3 font-semibold">Học viên</th>}
                    <th className="px-4 py-3 font-semibold text-right">Số tiền</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold">Ngày thanh toán</th>
                    <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0
                    ? <tr><td colSpan={type === 'course' ? 8 : 7} className="text-center text-on-muted py-10">Không có dữ liệu.</td></tr>
                    : orders.map(o => (
                      <tr key={o.id} className="border-b border-outline/10 hover:bg-surface-low/50">
                        <td className="px-4 py-3 font-mono text-xs">{o.order_code}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-amber-700">{o.payment_code}</td>
                        <td className="px-4 py-3">{type === 'course' ? (o.course?.title || '—') : (o.plan?.name || '—')}</td>
                        {type === 'course' && (
                          <td className="px-4 py-3">{o.student?.full_name || o.student?.email || '—'}</td>
                        )}
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {Number(o.amount).toLocaleString('vi-VN')}₫
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[o.status] || 'bg-gray-100'}`}>
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-muted tabular-nums">
                          {o.paid_at ? new Date(o.paid_at).toLocaleString('vi-VN') : '—'}
                        </td>
                        <td className="px-4 py-3 text-on-muted tabular-nums">
                          {new Date(o.created_at).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

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
