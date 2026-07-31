import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Alert from '../../components/ui/Alert';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';

const vnd = (n) => `${Number(n || 0).toLocaleString('vi-VN')}₫`;
const curPeriod = () => new Date().toISOString().slice(0, 7);

// Last 12 month keys, newest first
function recentPeriods() {
  const out = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  return out;
}

export default function AdminRevenuePool() {
  const confirm = useConfirm();
  const [period, setPeriod]   = useState(curPeriod());
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [pct, setPct]         = useState('');
  const [savingPct, setSavingPct] = useState(false);
  const [working, setWorking] = useState('');
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [courseRev, setCourseRev] = useState(null);

  const load = async (pd = period) => {
    setLoading(true);
    try {
      const [poolR, cfgR, crR] = await Promise.all([
        api.get(`/admin/revenue-pool?period=${pd}`),
        api.get('/admin/revenue-pool/config'),
        api.get('/admin/course-revenue?limit=20'),
      ]);
      setData(poolR.data);
      setPct(String(Math.round((cfgR.data.pool_pct ?? 0.3) * 100)));
      setCourseRev(crR.data);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(period); /* eslint-disable-next-line */ }, [period]);

  const savePct = async () => {
    const p = Number(pct) / 100;
    if (!Number.isFinite(p) || p < 0 || p > 1) return setAlert({ type: 'error', msg: '% phải trong khoảng 0–100.' });
    setSavingPct(true);
    try {
      await api.put('/admin/revenue-pool/config', { pool_pct: p });
      setAlert({ type: 'success', msg: 'Đã lưu tỷ lệ quỹ.' });
      load(period);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSavingPct(false); }
  };

  const isCurrent = period === curPeriod();

  const finalize = async () => {
    const warn = isCurrent
      ? `Chốt sổ kỳ ${period}? Tháng này CHƯA kết thúc nên số liệu sẽ bị đóng băng ở mức hiện tại. Bạn vẫn có thể bấm "Tính lại" sau, miễn là chưa trả tiền cho giáo viên nào.`
      : `Chốt sổ kỳ ${period}? Thu nhập giáo viên sẽ được ghi nhận.`;
    if (!await confirm(warn)) return;
    setWorking('finalize');
    try {
      await api.post(`/admin/revenue-pool/${period}/finalize`);
      setAlert({ type: 'success', msg: 'Đã chốt sổ.' });
      load(period);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setWorking(''); }
  };

  const refinalize = async () => {
    if (!await confirm(`Tính lại kỳ ${period} theo số liệu mới nhất? Bản chốt sổ cũ sẽ bị thay thế.`)) return;
    setWorking('refinalize');
    try {
      await api.post(`/admin/revenue-pool/${period}/refinalize`);
      setAlert({ type: 'success', msg: 'Đã tính lại và chốt sổ theo số liệu mới nhất.' });
      load(period);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setWorking(''); }
  };

  const markPaid = async (id) => {
    try {
      await api.post(`/admin/teacher-payouts/${id}/paid`);
      load(period);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const p = data?.period;
  const payouts = data?.payouts || [];
  const finalized = data?.finalized;

  return (
    <AdminLayout title="Quỹ doanh thu">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display">Quỹ chia sẻ doanh thu</h1>
            <p className="text-sm text-on-muted">Trích % doanh thu VIP, chia cho giáo viên theo lượt dùng nội dung.</p>
          </div>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 border border-outline rounded-xl text-sm bg-white outline-none focus:border-tsubaki-red">
            {recentPeriods().map(pk => <option key={pk} value={pk}>{pk}</option>)}
          </select>
        </div>

        {alert.msg && <div className="mb-4"><Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert></div>}

        {/* Pool % config */}
        <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-on-muted">Tỷ lệ trích quỹ từ doanh thu VIP</span>
          <div className="flex items-center gap-1">
            <input type="number" min="0" max="100" value={pct} onChange={e => setPct(e.target.value)}
              className="w-20 px-3 py-1.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
            <span className="text-sm font-bold">%</span>
          </div>
          <button onClick={savePct} disabled={savingPct}
            className="px-3 py-1.5 bg-tsubaki-red text-white text-xs font-semibold rounded-xl disabled:opacity-40">
            {savingPct ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="glass-card h-24 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Stat label="Doanh thu VIP" value={vnd(p?.total_vip_revenue)} icon="payments" color="text-emerald-600" />
              <Stat label={`Quỹ (${Math.round((p?.pool_pct ?? 0) * 100)}%)`} value={vnd(p?.pool_amount)} icon="savings" color="text-tsubaki-red" />
              <Stat label="Tổng lượt dùng" value={Number(p?.total_uses || 0).toLocaleString('vi-VN')} icon="visibility" color="text-sky-600" />
              <Stat label="Trạng thái" value={finalized ? 'Đã chốt' : 'Xem trước'} icon={finalized ? 'lock' : 'schedule'} color={finalized ? 'text-emerald-600' : 'text-amber-500'} />
            </div>

            {!finalized ? (
              <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex-wrap">
                <p className="text-sm text-amber-800">
                  Kỳ này chưa chốt — số liệu là ước tính trực tiếp, tự cập nhật theo doanh thu thực tế.
                  {isCurrent && ' Tháng chưa kết thúc nên chưa cần chốt vội.'}
                </p>
                <button onClick={finalize} disabled={working === 'finalize'}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                  {working === 'finalize' ? 'Đang chốt...' : 'Chốt sổ'}
                </button>
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-sky-50 border border-sky-200 flex-wrap">
                <p className="text-sm text-sky-900">
                  {isCurrent
                    ? 'Kỳ này đã chốt nhưng tháng CHƯA kết thúc — số liệu đang bị đóng băng ở mức dở dang. Bấm "Tính lại" để cập nhật theo doanh thu mới nhất.'
                    : 'Kỳ này đã chốt sổ. Nếu số liệu phát sinh thêm sau khi chốt, bấm "Tính lại".'}
                </p>
                <button onClick={refinalize} disabled={working === 'refinalize'}
                  className="px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
                  {working === 'refinalize' ? 'Đang tính...' : 'Tính lại'}
                </button>
              </div>
            )}

            {/* Payout table */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-low border-b border-outline/40">
                    <tr>{['Giáo viên', 'Tài khoản nhận', 'Lượt', 'Tỷ lệ', 'Tiền nhận', 'Trạng thái', ''].map(h =>
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {payouts.map((r, i) => (
                      <tr key={r.id || r.teacher_id} className={`border-t border-outline/40 ${i % 2 ? 'bg-surface-low/30' : ''}`}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-xs">{r.teacher?.full_name || '—'}</p>
                          <p className="text-on-muted text-xs">{r.teacher?.email}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.teacher?.bank_account_number ? (
                            <>
                              <p className="font-mono text-xs font-semibold">{r.teacher.bank_account_number}</p>
                              <p className="text-on-muted text-xs">
                                {r.teacher.bank_name}{r.teacher.bank_account_name ? ` · ${r.teacher.bank_account_name}` : ''}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-amber-600">Giáo viên chưa cung cấp</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{Number(r.uses).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-2.5 tabular-nums">{Math.round(Number(r.share_pct) * 100)}%</td>
                        <td className="px-4 py-2.5 font-bold tabular-nums">{vnd(r.amount)}</td>
                        <td className="px-4 py-2.5">
                          {finalized
                            ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status === 'paid' ? 'Đã trả' : 'Chờ trả'}</span>
                            : <span className="text-xs text-on-muted">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {finalized && r.status !== 'paid' && r.id && (
                            <button onClick={() => markPaid(r.id)} className="px-3 py-1.5 border border-outline rounded-lg text-xs font-semibold hover:bg-surface-low">Đánh dấu đã trả</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payouts.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-on-muted">Chưa có lượt dùng nội dung giáo viên trong kỳ này.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hoa hồng bán khóa học — nguồn tiền riêng, không nằm trong quỹ chia sẻ ở trên */}
            <div className="mt-8">
              <h2 className="text-lg font-bold font-display mb-1">Hoa hồng bán khóa học</h2>
              <p className="text-sm text-on-muted mb-3">
                Nguồn tiền riêng, tính trên toàn bộ lịch sử: giáo viên nhận thẳng phần của mình, nền tảng giữ hoa hồng theo tỷ lệ của từng khóa.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label="Tổng tiền bán khóa" value={vnd(courseRev?.total_gross)} icon="sell" color="text-emerald-600" />
                <Stat label="Nền tảng thu" value={vnd(courseRev?.total_fee)} icon="account_balance" color="text-tsubaki-red" />
                <Stat label="Trả giáo viên" value={vnd(courseRev?.total_payout)} icon="payments" color="text-sky-600" />
                <Stat label="Số lượt mua" value={Number(courseRev?.total_sales || 0).toLocaleString('vi-VN')} icon="shopping_cart" color="text-amber-500" />
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-low border-b border-outline/40">
                      <tr>{['Thời điểm', 'Học viên', 'Khóa học', 'Số tiền', 'Nền tảng thu', 'Giáo viên nhận'].map(h =>
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(courseRev?.transactions || []).map((t, i) => (
                        <tr key={t.id} className={`border-t border-outline/40 ${i % 2 ? 'bg-surface-low/30' : ''}`}>
                          <td className="px-4 py-2.5 text-xs text-on-muted whitespace-nowrap">
                            {new Date(t.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-xs">{t.student?.full_name || '—'}</p>
                            <p className="text-on-muted text-xs">{t.student?.email}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold">{t.course?.title || '—'}</td>
                          <td className="px-4 py-2.5 tabular-nums font-bold">{vnd(t.amount)}</td>
                          <td className="px-4 py-2.5 tabular-nums text-tsubaki-red">{vnd(t.platform_fee)}</td>
                          <td className="px-4 py-2.5 tabular-nums text-sky-600">{vnd(t.teacher_payout)}</td>
                        </tr>
                      ))}
                      {!(courseRev?.transactions || []).length && (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-on-muted">Chưa có lượt mua khóa học nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {courseRev?.total > (courseRev?.transactions || []).length && (
                  <p className="px-4 py-3 text-xs text-on-muted border-t border-outline/40">
                    Hiển thị {courseRev.transactions.length} / {courseRev.total} giao dịch gần nhất.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, icon, color }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
      <p className="text-lg font-bold font-display mt-1 truncate" title={value}>{value}</p>
      <p className="text-xs text-on-muted">{label}</p>
    </div>
  );
}
