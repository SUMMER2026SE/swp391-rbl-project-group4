import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { JLPT_LEVELS } from '../../lib/mockExamConstants';
import { listMockExams } from '../../lib/mockExamApi';

export default function MockExamList() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('N5');

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal">Thi thử JLPT</h1>
            <p className="text-sm text-on-muted mt-1">Đề mô phỏng kỳ thi thật: tính giờ từng phần, chấm điểm, xem lại & bảng xếp hạng.</p>
          </div>
          {/* Lối vào lịch sử — nút nhỏ góc phải */}
          <button onClick={() => navigate('/mock-exams/history')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-outline/40 text-sm font-semibold text-on-muted hover:border-tsubaki-red/50 hover:text-tsubaki-red transition-all">
            <span className="material-symbols-outlined text-lg">history</span>
            <span className="hidden sm:inline">Lịch sử bài làm</span>
          </button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {exams.map(e => (
              <div key={e.id} role="button" tabIndex={0} onClick={() => navigate(`/mock-exams/${e.id}`)}
                className="text-left bg-white border border-outline/40 rounded-2xl p-4 hover:border-tsubaki-red/50 hover:shadow-md transition-all cursor-pointer">
                {/* Tên đề + badge Miễn phí/Mở khóa ngang hàng */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-charcoal truncate flex-1">{e.title}</h3>
                  {e.locked ? (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); navigate('/subscription'); }}
                      className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-amber-500 text-white font-semibold text-[11px] hover:bg-amber-600 transition-colors">
                      <span className="material-symbols-outlined text-sm">lock</span>Mở khóa
                    </button>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-green-100 text-green-700 font-semibold text-[11px]">
                      <span className="material-symbols-outlined text-sm">lock_open</span>Miễn phí
                    </span>
                  )}
                </div>
                {e.active_attempt_id && (
                  <span className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">hourglass_top</span>Đang làm dở</span>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-on-muted mt-2">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{e.total_minutes} phút</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">quiz</span>{e.question_count} câu</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">group</span>{e.attempt_count} lượt</span>
                </div>
                {e.best_score != null ? (
                  <p className="text-[11px] text-green-700 font-semibold mt-2">Điểm cao nhất của bạn: {e.best_score}/180</p>
                ) : (
                  <p className="text-[11px] text-on-muted mt-2">Đề này bạn chưa làm lần nào</p>
                )}
                {e.locked && e.best_score != null && !e.active_attempt_id && (
                  <p className="text-[11px] text-amber-700 mt-1">Chỉ xem lại được kết quả — nâng cấp Premium để làm lại.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
