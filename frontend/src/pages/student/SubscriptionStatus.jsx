import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../contexts/AuthContext';
import { ReceiptButton } from '../../components/receipt/Receipt';

const FEATURE_LABELS = {
  kanji_file_monthly:         'Luyện viết kanji',
  kanji_chars_per_file:       'Ký tự tối đa / file kanji',
  listening_practice_monthly: 'Luyện nghe',
  ai_chat_daily:              'Tin nhắn AI',
};

const PERIOD_LABELS = { monthly: '/ tháng', daily: '/ ngày', none: '' };

function QuotaBar({ used, limit, label, periodType }) {
  const pct = limit <= 0 ? 0 : Math.min(100, (used / limit) * 100);
  const isUnlimited = limit === -1;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-on-muted w-44 flex-shrink-0">{label}</span>
      {isUnlimited
        ? <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">all_inclusive</span> Không giới hạn
          </span>
        : <>
            <div className="flex-1 h-2 bg-surface-low rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold w-24 text-right tabular-nums">
              {used} / {limit} {PERIOD_LABELS[periodType] || ''}
            </span>
          </>
      }
    </div>
  );
}

// ── Checkout / QR modal ──────────────────────────────────────────────────────

function CheckoutModal({ plan, buyer, onClose, onSuccess }) {
  const [order, setOrder]       = useState(null);
  const [paidOrder, setPaidOrder] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [status, setStatus]     = useState('pending'); // pending | paid | expired
  const [timeLeft, setTimeLeft] = useState(0);
  const [qrError, setQrError]   = useState(false); // QR không tải được (mạng chặn / thiếu cấu hình)
  useEffect(() => { setQrError(false); }, [order?.qr_url]);
  const pollRef = useRef(null);

  // Create/fetch order
  useEffect(() => {
    api.post('/subscription/checkout', { plan_code: plan.code })
      .then(r => {
        const o = r.data.order;
        setOrder(o);
        setStatus(o.status);
        const diff = Math.max(0, new Date(o.expires_at).getTime() - Date.now());
        setTimeLeft(Math.floor(diff / 1000));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [plan.code]);

  // Poll for payment confirmation
  useEffect(() => {
    if (!order || status !== 'pending') return;

    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/subscription/payment-order/${order.id}`);
        const s = r.data.order?.status;
        if (s && s !== 'pending') {
          clearInterval(pollRef.current);
          setStatus(s);
          if (s === 'paid') setPaidOrder(r.data.order);
        }
      } catch (_) {}
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [order, status, onSuccess]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || status !== 'pending') return;
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { clearInterval(t); setStatus('expired'); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [timeLeft, status]);

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleCancel = async () => {
    if (order) {
      try { await api.post(`/subscription/payment-order/${order.id}/cancel`); } catch (_) {}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative">
        <button onClick={handleCancel} className="absolute top-4 right-4 text-on-muted hover:text-on-surface material-symbols-outlined">close</button>

        {loading && (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-on-muted">Đang tạo lệnh thanh toán...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-red-400 mb-3 block">error</span>
            <p className="text-on-muted">{error}</p>
          </div>
        )}

        {order && status === 'pending' && (
          <>
            <div className="text-center mb-6">
              <h3 className="font-display text-xl font-bold mb-1">Thanh toán Premium</h3>
              <p className="text-on-muted text-sm">Quét mã QR hoặc chuyển khoản theo thông tin bên dưới</p>
            </div>

            {/* QR code — nếu ảnh QR không tải được (mạng chặn qr.sepay.vn / thiếu cấu hình)
                thì hiện hướng dẫn chuyển khoản thủ công thay vì để trống */}
            {order.qr_url && !qrError ? (
              <div className="flex justify-center mb-5">
                <img src={`/api/payment/qr?amount=${order.amount}&des=${order.payment_code}`} alt="QR Thanh toán"
                  className="w-52 h-52 border-4 border-amber-300 rounded-2xl object-contain bg-white"
                  onError={() => setQrError(true)}
                />
              </div>
            ) : (
              <div className="mb-5 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Không tải được mã QR. Vui lòng chuyển khoản thủ công theo thông tin bên dưới.
              </div>
            )}

            {/* Transfer info — luôn hiển thị để chuyển khoản thủ công được kể cả khi QR lỗi */}
            <div className="bg-amber-50 rounded-xl p-4 space-y-2 text-sm mb-4">
              {order.bank_code && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-on-muted">Ngân hàng</span>
                  <span className="font-bold text-amber-800">{order.bank_code}</span>
                </div>
              )}
              {order.account_number && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-on-muted">Số tài khoản</span>
                  <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded text-amber-800 select-all">{order.account_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-on-muted">Số tiền</span>
                <span className="font-bold text-amber-700">{Number(order.amount).toLocaleString('vi-VN')}₫</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-on-muted">Nội dung CK</span>
                <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded text-amber-800 select-all">{order.payment_code}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-on-muted justify-center mb-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Đang chờ xác nhận thanh toán...</span>
            </div>

            <div className="text-center">
              <p className="text-xs text-on-muted">
                Hết hạn sau <span className="font-mono font-bold text-red-500">{fmtTime(timeLeft)}</span>
              </p>
            </div>
          </>
        )}

        {status === 'paid' && (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-6xl text-emerald-500 mb-3 block">check_circle</span>
            <h3 className="font-display text-2xl font-bold mb-1">Thanh toán thành công!</h3>
            <p className="text-on-muted mb-5">Tài khoản của bạn đã được nâng cấp lên Premium.</p>
            <div className="flex flex-col gap-2 items-center">
              <ReceiptButton
                data={{
                  type: 'subscription', typeLabel: 'Gói',
                  buyerName: buyer?.name, buyerEmail: buyer?.email,
                  itemName: plan?.name || 'Premium',
                  amount: paidOrder?.amount ?? order?.amount,
                  currency: paidOrder?.currency || 'VND',
                  orderCode: paidOrder?.order_code || order?.order_code,
                  paymentCode: paidOrder?.payment_code || order?.payment_code,
                  paidAt: paidOrder?.paid_at || new Date().toISOString(),
                }}
                filename={`bien-lai-${paidOrder?.order_code || order?.order_code || 'premium'}.pdf`}
                className="w-full"
              />
              <button onClick={onSuccess}
                className="w-full px-6 py-3 bg-amber-400 hover:bg-amber-500 text-white rounded-xl font-semibold transition-colors">
                Hoàn tất
              </button>
            </div>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-5xl text-on-muted mb-4 block">schedule</span>
            <h3 className="font-display text-xl font-bold mb-2">Lệnh thanh toán đã hết hạn</h3>
            <p className="text-on-muted text-sm mb-6">Vui lòng tạo lại lệnh thanh toán mới.</p>
            <button onClick={onClose} className="px-6 py-2 bg-amber-400 text-white rounded-xl font-semibold">Đóng</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SubscriptionStatus() {
  const { data, loading, refetch } = useSubscription();
  const { user } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [premiumPlan, setPremiumPlan]   = useState(null);

  useEffect(() => {
    api.get('/subscription/plans').then(r => {
      const p = r.data.plans?.find(pl => pl.tier === 'premium');
      if (p) setPremiumPlan(p);
    }).catch(() => {});
  }, []);

  if (loading) {
    return (
      <StudentLayout title="Gói đăng ký">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </StudentLayout>
    );
  }

  const { subscription, tier = 'free', quotas = [] } = data || {};
  const isPremium = tier === 'premium';

  const handleUpgradeSuccess = async () => {
    setShowCheckout(false);
    await refetch();
  };

  return (
    <StudentLayout title="Gói đăng ký">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Status card */}
        <div className={`rounded-2xl p-6 ${isPremium
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300'
          : 'glass-card border border-outline/30'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-muted uppercase tracking-wider mb-1">Gói hiện tại</p>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold">
                  {isPremium ? 'Premium' : 'Miễn phí'}
                </h2>
                {isPremium && <span className="material-symbols-outlined text-amber-500">workspace_premium</span>}
              </div>
              {subscription?.current_period_end && (
                <p className="text-sm text-on-muted mt-1">
                  Hết hạn: {new Date(subscription.current_period_end).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
            {!isPremium && premiumPlan && (
              <button onClick={() => setShowCheckout(true)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-white rounded-xl font-bold transition-colors shadow-md shadow-amber-200 text-sm">
                Nâng cấp
              </button>
            )}
          </div>
        </div>

        {/* Quota usage */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-semibold mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-tsubaki-red">data_usage</span>
            Mức sử dụng
          </h3>
          <div className="space-y-4">
            {quotas.map(q => (
              <QuotaBar
                key={q.feature}
                label={FEATURE_LABELS[q.feature] || q.feature}
                used={q.used}
                limit={q.limit}
                periodType={q.periodType}
              />
            ))}
          </div>
          {!isPremium && (
            <p className="text-xs text-on-muted mt-4 pt-4 border-t border-outline/20">
              Nâng cấp Premium để dùng không giới hạn.{' '}
              <Link to="/pricing" className="text-amber-600 font-semibold hover:underline">Xem bảng giá</Link>
            </p>
          )}
        </div>

        {/* Billing history link */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Lịch sử thanh toán</p>
            <p className="text-xs text-on-muted mt-0.5">Xem các giao dịch trước đây</p>
          </div>
          <Link to="/billing" className="flex items-center gap-1 text-sm text-tsubaki-red font-semibold hover:underline">
            Xem <span className="material-symbols-outlined text-lg">chevron_right</span>
          </Link>
        </div>
      </div>

      {showCheckout && premiumPlan && (
        <CheckoutModal
          plan={premiumPlan}
          buyer={{ name: user?.user_metadata?.full_name || user?.email, email: user?.email }}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleUpgradeSuccess}
        />
      )}
    </StudentLayout>
  );
}
