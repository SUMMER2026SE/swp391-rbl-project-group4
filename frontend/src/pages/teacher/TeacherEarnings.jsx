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
  const course   = data?.course;

  return (
    <TeacherLayout title="Thu nhập">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold font-display">Thu nhập</h1>
          <p className="text-sm text-on-muted">Hai nguồn riêng biệt: tiền bán khóa học của bạn, và quỹ chia sẻ từ doanh thu Premium.</p>
        </div>

        {error && <div className="mb-4"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="glass-card h-20 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <>
            {/* Doanh thu bán khóa học — tiền vào thẳng, không qua quỹ chia sẻ */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-emerald-600">shopping_cart</span>
                <h2 className="font-bold">Bán khóa học</h2>
                <span className="ml-auto text-xs text-on-muted">{Number(course?.total_sales || 0)} lượt mua</span>
              </div>
              <p className="text-xs font-bold text-on-muted uppercase tracking-widest">Bạn thực nhận</p>
              <p className="text-3xl font-bold font-display text-emerald-600 mt-1">{vnd(course?.total_payout)}</p>
              <p className="text-xs text-on-muted mt-1">
                Tổng bán {vnd(course?.total_gross)} · nền tảng giữ {vnd(course?.total_fee)}
              </p>

              {(course?.by_course || []).length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-outline/40">
                      <tr>{['Khóa học', 'Lượt mua', 'Tổng bán', 'Bạn nhận'].map(h =>
                        <th key={h} className="text-left px-2 py-2 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {course.by_course.map(c => (
                        <tr key={c.course_id} className="border-t border-outline/40">
                          <td className="px-2 py-2 font-semibold">{c.title}</td>
                          <td className="px-2 py-2 tabular-nums">{c.sales}</td>
                          <td className="px-2 py-2 tabular-nums">{vnd(c.gross)}</td>
                          <td className="px-2 py-2 font-bold tabular-nums text-emerald-600">{vnd(c.payout)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!course?.total_sales && (
                <p className="text-sm text-on-muted mt-3">Chưa có lượt mua khóa học nào.</p>
              )}
            </div>

            {/* Quỹ chia sẻ từ doanh thu Premium */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-tsubaki-red">savings</span>
                <h2 className="font-bold">Quỹ chia sẻ doanh thu Premium</h2>
              </div>
              <p className="text-xs font-bold text-on-muted uppercase tracking-widest">Tổng đã ghi nhận</p>
              <p className="text-3xl font-bold font-display text-tsubaki-red mt-1">{vnd(data?.total_earned)}</p>
              <p className="text-xs text-on-muted mt-1">Chia theo tỷ lệ lượt học viên dùng bài nghe/đọc/từ vựng của bạn mỗi tháng.</p>
            </div>

            {/* Current-month estimate */}
            {estimate && (
              <div className="glass-card rounded-2xl p-5 mb-4 border border-sumire-purple/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-sumire-purple">trending_up</span>
                  <h2 className="font-bold">Dự kiến nhận tháng này ({estimate.period_key})</h2>
                  <span className="ml-auto text-xs text-on-muted">
                    {estimate.finalized_early ? 'tạm tính' : 'chưa chốt sổ'}
                  </span>
                </div>

                {estimate.finalized_early && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                    Kỳ này đã được chốt sổ sớm khi tháng chưa kết thúc. Con số dưới đây là mức đang chạy
                    theo dữ liệu thực tế — số trong bảng lịch sử bên dưới chưa phải số cuối cùng.
                  </p>
                )}
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
