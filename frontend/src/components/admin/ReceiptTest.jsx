import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Receipt, { ReceiptButton } from '../receipt/Receipt';
import api from '../../lib/api';

// Dữ liệu biên lai mẫu để kiểm tra (không đụng dữ liệu thật)
const sampleData = (type, user) => ({
  type,
  typeLabel:   type === 'course' ? 'Khóa học' : 'Gói',
  buyerName:   user?.user_metadata?.full_name || user?.email || 'Nguyễn Văn A',
  buyerEmail:  user?.email || 'test@example.com',
  itemName:    type === 'course' ? 'Khóa học tiếng Nhật N5 cơ bản (mẫu)' : 'Premium 1 tháng (mẫu)',
  amount:      type === 'course' ? 499000 : 100000,
  currency:    'VND',
  orderCode:   type === 'course' ? 'CRS-TEST-000001' : 'SUB-TEST-000001',
  paymentCode: type === 'course' ? 'COURSETEST01' : 'PREMTEST01',
  paidAt:      new Date().toISOString(),
});

export default function ReceiptTest() {
  const { user } = useAuth();
  const [type, setType]       = useState('course');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);

  const data = sampleData(type, user);

  const sendTestEmail = async () => {
    setSending(true); setResult(null);
    try {
      const r = await api.post('/admin/test-receipt-email', { type });
      setResult({ ok: true, msg: r.data.message });
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally { setSending(false); }
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="font-display font-bold text-base mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-tsubaki-red">receipt_long</span>
        Test biên lai
      </h2>
      <p className="text-sm text-on-muted mb-4">
        Kiểm tra mẫu biên lai (PDF) và email xác nhận thanh toán bằng dữ liệu mẫu.
      </p>

      {/* Chọn loại */}
      <div className="flex rounded-xl border border-outline overflow-hidden text-sm w-fit mb-4">
        {[['course', 'Mua khóa học'], ['subscription', 'Đăng ký VIP']].map(([v, l]) => (
          <button key={v} onClick={() => { setType(v); setResult(null); }}
            className={`px-4 py-2 transition-colors ${type === v ? 'bg-tsubaki-red text-white' : 'bg-white text-on-muted hover:bg-surface-low'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
        {/* Xem trước */}
        <div className="border border-outline/40 rounded-xl p-3 bg-surface-low/40 overflow-x-auto">
          <Receipt id="receipt-preview" data={data} />
        </div>

        {/* Hành động */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1.5">1. Kiểm tra file PDF</p>
            <ReceiptButton data={data} filename={`bien-lai-mau-${type}.pdf`} label="Tải PDF mẫu" />
          </div>

          <div className="pt-1">
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1.5">2. Kiểm tra email (SMTP)</p>
            <button onClick={sendTestEmail} disabled={sending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low disabled:opacity-50 transition-colors">
              <span className={`material-symbols-outlined text-lg ${sending ? 'animate-spin' : ''}`}>
                {sending ? 'progress_activity' : 'outgoing_mail'}
              </span>
              {sending ? 'Đang gửi...' : 'Gửi email thử'}
            </button>
            <p className="text-xs text-on-muted mt-1.5">Gửi tới email của bạn: <strong>{user?.email || '—'}</strong></p>
          </div>

          {result && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm ${
              result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <span className="material-symbols-outlined text-lg shrink-0">{result.ok ? 'check_circle' : 'error'}</span>
              <span className="break-words">{result.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
