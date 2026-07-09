import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { formatDuration } from '../../lib/mockExamConstants';
import { getMockHistory, getMockStats } from '../../lib/mockExamApi';

export default function MockExamHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([getMockHistory(), getMockStats()])
      .then(([h, s]) => {
        if (h.status === 'fulfilled') setHistory(h.value); else setError(h.reason.message);
        if (s.status === 'fulfilled') setStats(s.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const maxScore = 180;

  return (
    <StudentLayout title="Lịch sử thi thử">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-charcoal">Lịch sử & thống kê</h1>
          <button onClick={() => navigate('/mock-exams')} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách đề
          </button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {loading ? (
          <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
        ) : (<>
          {/* Biểu đồ điểm theo thời gian */}
          {stats?.timeline?.length > 1 && (
            <div className="bg-white border border-outline/40 rounded-2xl p-5">
              <h2 className="font-bold text-charcoal mb-3">Điểm tổng theo thời gian</h2>
              <div className="flex items-end gap-2 h-40">
                {stats.timeline.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.total_score}/180`}>
                    <span className="text-[10px] text-on-muted font-semibold">{t.total_score}</span>
                    <div className="w-full bg-tsubaki-red/80 rounded-t" style={{ height: `${(t.total_score / maxScore) * 100}%` }} />
                    <span className="text-[9px] text-on-muted">{t.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mạnh/yếu theo mondai */}
          {stats?.by_mondai?.length > 0 && (
            <div className="bg-white border border-outline/40 rounded-2xl p-5">
              <h2 className="font-bold text-charcoal mb-3">Điểm mạnh / yếu theo dạng bài</h2>
              <div className="space-y-2">
                {stats.by_mondai.map(m => (
                  <div key={m.mondai_type} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-charcoal truncate">{m.ja} <span className="text-on-muted">{m.vi}</span></span>
                    <div className="flex-1 h-3 bg-surface-low rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.pct >= 70 ? 'bg-green-500' : m.pct >= 50 ? 'bg-amber-400' : 'bg-error'}`} style={{ width: `${m.pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs font-semibold text-on-muted">{m.pct}% ({m.correct}/{m.total})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bảng lịch sử */}
          <div className="bg-white border border-outline/40 rounded-2xl overflow-hidden">
            <h2 className="font-bold text-charcoal p-4 pb-2">Các lần thi ({history.length})</h2>
            {history.length === 0 ? (
              <p className="text-center text-on-muted py-10">Bạn chưa hoàn thành đề thi thử nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-low text-xs text-on-muted uppercase">
                      <th className="text-left px-4 py-2 font-semibold">Đề</th>
                      <th className="text-center px-3 py-2 font-semibold">Cấp</th>
                      <th className="text-center px-3 py-2 font-semibold">Điểm</th>
                      <th className="text-center px-3 py-2 font-semibold">Kết quả</th>
                      <th className="text-center px-3 py-2 font-semibold">Thời gian</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-t border-outline/20 hover:bg-surface-low/50">
                        <td className="px-4 py-2.5 text-charcoal">{h.exam_title}</td>
                        <td className="text-center px-3">{h.level}</td>
                        <td className="text-center px-3 font-bold">{h.total_score}/180</td>
                        <td className="text-center px-3">
                          {h.passed ? <span className="text-green-600 text-xs font-semibold">Đậu</span> : <span className="text-error text-xs font-semibold">Chưa đạt</span>}
                        </td>
                        <td className="text-center px-3 text-on-muted">{formatDuration(h.duration_seconds)}</td>
                        <td className="text-right px-3">
                          <button onClick={() => navigate(`/mock-exams/attempt/${h.id}/review`)} className="text-tsubaki-red text-xs font-semibold hover:underline">Xem lại</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>)}
      </div>
    </StudentLayout>
  );
}
