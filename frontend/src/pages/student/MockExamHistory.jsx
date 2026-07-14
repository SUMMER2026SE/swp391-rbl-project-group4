import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { formatDuration, JLPT_LEVELS, LEVEL_BADGE_CLASS } from '../../lib/mockExamConstants';
import { getMockHistory } from '../../lib/mockExamApi';

export default function MockExamHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getMockHistory()
      .then(setHistory)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Lọc client-side theo cấp; dữ liệu đã sort mới→cũ từ backend
  const rows = filter ? history.filter(h => h.level === filter) : history;

  return (
    <StudentLayout title="Lịch sử bài làm">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-charcoal">Lịch sử bài làm</h1>
          <button onClick={() => navigate('/mock-exams')} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách đề
          </button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {loading ? (
          <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
        ) : (<>
          {/* Bộ lọc theo cấp */}
          <div className="flex items-center gap-2">
            <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!filter ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>Tất cả</button>
            {JLPT_LEVELS.map(lv => (
              <button key={lv} onClick={() => setFilter(lv)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filter === lv ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>{lv}</button>
            ))}
          </div>

          {/* Bảng lịch sử */}
          <div className="bg-white border border-outline/40 rounded-2xl overflow-hidden">
            <h2 className="font-bold text-charcoal p-4 pb-2">Các lần thi ({rows.length})</h2>
            {rows.length === 0 ? (
              <p className="text-center text-on-muted py-10">
                {filter ? `Bạn chưa hoàn thành đề thi thử cấp ${filter} nào.` : 'Bạn chưa hoàn thành đề thi thử nào.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-low text-xs text-on-muted uppercase">
                      <th className="text-left px-4 py-2 font-semibold">Đề</th>
                      {!filter && <th className="text-center px-3 py-2 font-semibold">Cấp</th>}
                      <th className="text-center px-3 py-2 font-semibold">Điểm</th>
                      <th className="text-center px-3 py-2 font-semibold">Kết quả</th>
                      <th className="text-center px-3 py-2 font-semibold">Thời gian</th>
                      <th className="text-center px-3 py-2 font-semibold">Ngày làm</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(h => (
                      <tr key={h.id} className="border-t border-outline/20 hover:bg-surface-low/50">
                        <td className="px-4 py-2.5 text-charcoal">{h.exam_title}</td>
                        {!filter && (
                          <td className="text-center px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-xs ${LEVEL_BADGE_CLASS[h.level] || 'bg-surface-low text-on-muted'}`}>{h.level || '—'}</span>
                          </td>
                        )}
                        <td className="text-center px-3 font-bold">{h.total_score}/180</td>
                        <td className="text-center px-3">
                          {h.passed ? <span className="text-green-600 text-xs font-semibold">Đậu</span> : <span className="text-error text-xs font-semibold">Chưa đạt</span>}
                        </td>
                        <td className="text-center px-3 text-on-muted">{formatDuration(h.duration_seconds)}</td>
                        <td className="text-center px-3 text-on-muted">{h.submitted_at ? new Date(h.submitted_at).toLocaleDateString('vi-VN') : '—'}</td>
                        <td className="text-right px-3">
                          <button onClick={() => navigate(`/mock-exams/attempt/${h.id}/result`)} className="text-tsubaki-red text-xs font-semibold hover:underline">Xem kết quả</button>
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
