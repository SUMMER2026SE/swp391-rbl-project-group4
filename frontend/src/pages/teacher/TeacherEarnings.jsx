import { useEffect, useState } from 'react';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const vnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')}₫`;

export default function TeacherEarnings() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/teacher/earnings')
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const payouts  = data?.payouts || [];
  const estimate = data?.estimate;

  return (
    <TeacherLayout title="Thu nhập">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold font-display">Thu nhập từ quỹ chia sẻ</h1>
          <p className="text-sm text-on-muted">Bạn nhận tiền theo tỷ lệ lượt học viên dùng bài nghe/đọc/vocab của bạn mỗi tháng.</p>
        </div>

        {error && <div className="mb-4"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="glass-card h-20 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <>
            {/* Total earned */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <p className="text-xs font-bold text-on-muted uppercase tracking-widest">Tổng đã ghi nhận</p>
              <p className="text-3xl font-bold font-display text-tsubaki-red mt-1">{vnd(data?.total_earned)}</p>
            </div>

            {/* Current-month estimate */}
            {estimate && (
              <div className="glass-card rounded-2xl p-5 mb-4 border border-sumire-purple/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-sumire-purple">trending_up</span>
                  <h2 className="font-bold">Ước tính tháng này ({estimate.period_key})</h2>
                  <span className="ml-auto text-xs text-on-muted">chưa chốt sổ</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Cell label="Lượt của bạn" value={Number(estimate.uses).toLocaleString('vi-VN')} />
                  <Cell label="Tỷ lệ" value={`${Math.round(estimate.share_pct * 100)}%`} />
                  <Cell label="Dự kiến nhận" value={vnd(estimate.amount)} highlight />
                </div>
                <p className="text-xs text-on-muted mt-3 text-center">Quỹ tháng: {vnd(estimate.pool_amount)} · Tổng lượt toàn hệ thống: {Number(estimate.total_uses).toLocaleString('vi-VN')}</p>
              </div>
            )}

            {/* History */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-low border-b border-outline/40">
                    <tr>{['Kỳ', 'Lượt', 'Tỷ lệ', 'Tiền nhận', 'Trạng thái'].map(h =>
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {payouts.map((r, i) => (
                      <tr key={r.id} className={`border-t border-outline/40 ${i % 2 ? 'bg-surface-low/30' : ''}`}>
                        <td className="px-4 py-2.5 font-semibold">{r.period_key}</td>
                        <td className="px-4 py-2.5 tabular-nums">{Number(r.uses).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-2.5 tabular-nums">{Math.round(Number(r.share_pct) * 100)}%</td>
                        <td className="px-4 py-2.5 font-bold tabular-nums">{vnd(r.amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status === 'paid' ? 'Đã trả' : 'Chờ trả'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {payouts.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-on-muted">Chưa có kỳ nào được chốt sổ.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </TeacherLayout>
  );
}

function Cell({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-tsubaki-red/5' : 'bg-surface-low/40'}`}>
      <p className={`text-lg font-bold font-display ${highlight ? 'text-tsubaki-red' : ''}`}>{value}</p>
      <p className="text-xs text-on-muted">{label}</p>
    </div>
  );
}
