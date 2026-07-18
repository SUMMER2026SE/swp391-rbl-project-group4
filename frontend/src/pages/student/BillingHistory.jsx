import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { ReceiptButton } from '../../components/receipt/Receipt';

export default function BillingHistory() {
  const { user } = useAuth();
  const buyer = { name: user?.user_metadata?.full_name || user?.email, email: user?.email };
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
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
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="font-display text-2xl font-bold">Lịch sử thanh toán VIP</h1>
          <Link to="/my-purchases"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-tsubaki-red hover:underline">
            <span className="material-symbols-outlined text-base">menu_book</span>Khóa học đã mua
          </Link>
        </div>

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
                  <tr className="border-b border-outline/20 text-left text-xs text-on-muted uppercase tracking-wide">
                    <th className="px-5 py-4 font-semibold">Mã đơn</th>
                    <th className="px-5 py-4 font-semibold">Gói</th>
                    <th className="px-5 py-4 font-semibold text-right">Số tiền</th>
                    <th className="px-5 py-4 font-semibold">Ngày thanh toán</th>
                    <th className="px-5 py-4 font-semibold text-right">Biên lai</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="border-b border-outline/10 hover:bg-surface-low/50">
                      <td className="px-5 py-4 font-mono text-xs text-on-muted">{order.order_code}</td>
                      <td className="px-5 py-4 font-semibold">{order.plan?.name || '—'}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold text-emerald-600">
                        {Number(order.amount).toLocaleString('vi-VN')}₫
                      </td>
                      <td className="px-5 py-4 text-on-muted tabular-nums">
                        {order.paid_at
                          ? new Date(order.paid_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <ReceiptButton
                          variant="ghost" size="sm" label="Tải" className="!px-3 !py-1.5"
                          data={{
                            type: 'subscription', typeLabel: 'Gói',
                            buyerName: buyer.name, buyerEmail: buyer.email,
                            itemName: order.plan?.name || 'Premium',
                            amount: order.amount, currency: order.currency || 'VND',
                            orderCode: order.order_code, paymentCode: order.payment_code,
                            paidAt: order.paid_at,
                          }}
                          filename={`bien-lai-${order.order_code}.pdf`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
