import { useState, useEffect } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
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

export default function BillingHistory() {
  const [orders, setOrders] = useState([]);
  const [total,  setTotal]  = useState(0);
  const [page,   setPage]   = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/subscription/billing?page=${page}&limit=${LIMIT}`)
      .then(r => { setOrders(r.data.orders || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const pages = Math.ceil(total / LIMIT);

  return (
    <StudentLayout title="Lịch sử thanh toán">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="font-display text-2xl font-bold mb-6">Lịch sử thanh toán</h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-on-muted">
            <span className="material-symbols-outlined text-4xl mb-3 block opacity-40">receipt_long</span>
            Chưa có giao dịch nào.
          </div>
        ) : (
          <>
            <div className="glass-card rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline/20 text-left text-xs text-on-muted">
                    <th className="px-5 py-4 font-semibold">Mã đơn</th>
                    <th className="px-5 py-4 font-semibold">Gói</th>
                    <th className="px-5 py-4 font-semibold text-right">Số tiền</th>
                    <th className="px-5 py-4 font-semibold">Trạng thái</th>
                    <th className="px-5 py-4 font-semibold">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="border-b border-outline/10 hover:bg-surface-low/50">
                      <td className="px-5 py-4 font-mono text-xs">{order.order_code}</td>
                      <td className="px-5 py-4">{order.plan?.name || '—'}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold">
                        {Number(order.amount).toLocaleString('vi-VN')}₫
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[order.status] || 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-on-muted">
                        {new Date(order.created_at).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-outline text-sm disabled:opacity-40 hover:bg-surface-low transition-colors">
                  ← Trước
                </button>
                <span className="px-4 py-1.5 text-sm text-on-muted">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="px-3 py-1.5 rounded-lg border border-outline text-sm disabled:opacity-40 hover:bg-surface-low transition-colors">
                  Tiếp →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
}
