import { useId, useState } from 'react';
import Button from '../ui/Button';
import { formatVnd } from '../../lib/format';
import { downloadWorksheetPDF } from '../../lib/kanjiWorksheet';

// data: { type, typeLabel, buyerName, buyerEmail, itemName, amount, currency,
//         orderCode, paymentCode, paidAt, method }

const MONO = "'Courier New', Courier, monospace";

const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return '—'; }
};

const Rule = ({ style = 'dashed' }) => (
  <div style={{
    borderTop: style === 'double' ? '3px double #000' : `1px ${style} #000`,
    margin: '10px 0',
  }} />
);

function Line({ label, value }) {
  return (
    <tr>
      <td style={{ padding: '3px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '3px 0 3px 12px', textAlign: 'right', wordBreak: 'break-word', fontWeight: 'bold' }}>{value}</td>
    </tr>
  );
}

// Printable receipt — black & white, styled like a printed paper slip.
// Give it a unique `id` so downloadWorksheetPDF can capture it.
export function Receipt({ id = 'receipt-print', data }) {
  if (!data) return null;
  return (
    <div id={id} style={{
      width: 380, background: '#fff', color: '#000',
      padding: '24px 22px', boxSizing: 'border-box',
      fontFamily: MONO, fontSize: 12, lineHeight: 1.6,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 'bold', letterSpacing: 2 }}>KIZUNA NIHONGO</div>
        <div style={{ fontSize: 10, marginTop: 2 }}>Học tiếng Nhật cùng nhau</div>
        <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 12, letterSpacing: 1 }}>BIÊN LAI THANH TOÁN</div>
      </div>

      <Rule />

      <div style={{ textAlign: 'center', fontWeight: 'bold', letterSpacing: 1 }}>*** ĐÃ THANH TOÁN ***</div>

      <Rule />

      {/* Details */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <Line label="Người mua" value={data.buyerName || '—'} />
          {data.buyerEmail && <Line label="Email" value={data.buyerEmail} />}
          <Line label={data.typeLabel || 'Sản phẩm'} value={data.itemName || '—'} />
          <Line label="Mã đơn" value={data.orderCode || '—'} />
          <Line label="Nội dung CK" value={data.paymentCode || '—'} />
          <Line label="Thời gian" value={fmtDate(data.paidAt)} />
          <Line label="Phương thức" value={data.method || 'Chuyển khoản (SePay)'} />
        </tbody>
      </table>

      <Rule style="double" />

      {/* Total */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 1, whiteSpace: 'nowrap' }}>TỔNG CỘNG</td>
            <td style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'right' }}>{formatVnd(data.amount)}</td>
          </tr>
        </tbody>
      </table>

      <Rule style="double" />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 11 }}>
        <div style={{ fontWeight: 'bold' }}>Cảm ơn bạn đã tin tưởng</div>
        <div style={{ fontWeight: 'bold' }}>Kizuna Nihongo!</div>
        <div style={{ marginTop: 8, fontSize: 10 }}>Biên lai xác nhận thanh toán,</div>
        <div style={{ fontSize: 10 }}>không phải hóa đơn GTGT.</div>
      </div>

      <Rule />

      <div style={{ textAlign: 'center', fontSize: 9, letterSpacing: 1 }}>
        - - - - - - - - - - - - - - - -
      </div>
    </div>
  );
}

// Button that renders a hidden Receipt (offscreen) and downloads it as PDF.
export function ReceiptButton({ data, filename, label = 'Tải biên lai', variant = 'secondary', size = 'md', className = '' }) {
  const rawId = useId();
  const id = `receipt-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [downloading, setDownloading] = useState(false);

  const handle = async () => {
    setDownloading(true);
    try { await downloadWorksheetPDF(id, filename || `bien-lai-${data?.orderCode || 'kizuna'}.pdf`); }
    finally { setDownloading(false); }
  };

  return (
    <>
      <Button variant={variant} size={size} loading={downloading} onClick={handle} className={className}>
        <span className="material-symbols-outlined text-lg">download</span>{label}
      </Button>
      {/* Hidden offscreen node (real size so html2canvas can capture it) */}
      <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', opacity: 0 }} aria-hidden="true">
        <Receipt id={id} data={data} />
      </div>
    </>
  );
}

export default Receipt;
