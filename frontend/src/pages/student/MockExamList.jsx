import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { JLPT_LEVELS } from '../../lib/mockExamConstants';
import { listMockExams } from '../../lib/mockExamApi';

export default function MockExamList() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('');

  useEffect(() => {
    setLoading(true);
    listMockExams(level || undefined)
      .then(r => setExams(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [level]);

  return (
    <StudentLayout title="Thi thử JLPT">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal">Thi thử JLPT</h1>
            <p className="text-sm text-on-muted mt-1">Đề mô phỏng kỳ thi thật: tính giờ từng phần, chấm điểm, xem lại & bảng xếp hạng.</p>
          </div>
          <Link to="/mock-exams/history" className="text-sm font-semibold text-tsubaki-red flex items-center gap-1 hover:underline">
            <span className="material-symbols-outlined text-lg">bar_chart</span> Lịch sử & thống kê
          </Link>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <div className="flex items-center gap-2">
          <button onClick={() => setLevel('')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!level ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>Tất cả</button>
          {JLPT_LEVELS.map(lv => (
            <button key={lv} onClick={() => setLevel(lv)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${level === lv ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>{lv}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
        ) : exams.length === 0 ? (
          <div className="text-center text-on-muted py-16 border border-dashed border-outline/50 rounded-2xl">
            <span className="material-symbols-outlined text-5xl opacity-30 block mb-2">fact_check</span>
            Chưa có đề thi thử nào{level && ` cấp ${level}`}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map(e => (
              <button key={e.id} onClick={() => navigate(`/mock-exams/${e.id}`)}
                className="text-left bg-white border border-outline/40 rounded-2xl p-5 hover:border-tsubaki-red/50 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-sumire-purple/10 text-sumire-purple font-bold text-sm">{e.level}</span>
                    {e.locked && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold text-xs">
                        <span className="material-symbols-outlined text-sm">workspace_premium</span>Premium
                      </span>
                    )}
                  </div>
                  {e.active_attempt_id && <span className="text-xs font-semibold text-amber-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">hourglass_top</span>Đang làm dở</span>}
                </div>
                <h3 className="font-display font-bold text-charcoal mb-3 line-clamp-2">{e.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-muted">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{e.total_minutes} phút</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">quiz</span>{e.question_count} câu</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">group</span>{e.attempt_count} lượt</span>
                </div>
                {e.best_score != null && (
                  <p className="text-xs text-green-700 font-semibold mt-2">Điểm cao nhất của bạn: {e.best_score}/180</p>
                )}
                {e.locked && e.best_score != null && !e.active_attempt_id && (
                  <p className="text-xs text-amber-700 mt-1">Chỉ xem lại được kết quả — nâng cấp Premium để làm lại.</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
