import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';

function ScoreBadge({ score, total }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color =
    pct >= 80 ? 'bg-emerald-100 text-emerald-700' :
    pct >= 60 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-600';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
      {score}/{total} ({pct}%)
    </span>
  );
}

function AttemptRow({ attempt }) {
  const date = attempt.completed_at
    ? new Date(attempt.completed_at).toLocaleString('vi-VN')
    : '—';
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-low/40 hover:bg-surface-low transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-tsubaki-red/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-tsubaki-red text-xl">quiz</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{attempt.quiz_title || 'Bài kiểm tra'}</p>
          <p className="text-xs text-on-muted mt-0.5">{date}</p>
        </div>
      </div>
      <ScoreBadge score={attempt.score} total={attempt.total_questions} />
    </div>
  );
}

export default function ExamHistory() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('all'); // all | pass | fail

  useEffect(() => {
    api.get('/quizzes/history')
      .then(r => setAttempts(r.data || []))
      .catch(() => setError('Không thể tải lịch sử bài thi.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = attempts.filter(a => {
    if (filter === 'all') return true;
    const pct = a.total_questions > 0 ? (a.score / a.total_questions) * 100 : 0;
    return filter === 'pass' ? pct >= 60 : pct < 60;
  });

  const totalExams = attempts.length;
  const avgScore   = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.total_questions > 0 ? (a.score / a.total_questions) * 100 : 0), 0) / attempts.length)
    : 0;
  const passed = attempts.filter(a => a.total_questions > 0 && (a.score / a.total_questions) >= 0.6).length;

  return (
    <StudentLayout title="Lịch sử bài thi">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Lịch sử kết quả bài thi</h1>
        <p className="text-sm text-on-muted mt-1">Tổng hợp tất cả các lần làm bài kiểm tra của bạn.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Tổng lần làm', value: totalExams, icon: 'assignment', color: 'text-tsubaki-red' },
          { label: 'Điểm TB', value: `${avgScore}%`, icon: 'percent', color: 'text-amber-500' },
          { label: 'Đã đạt', value: passed, icon: 'check_circle', color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
            <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
            <div>
              <p className="font-bold text-xl font-display">{loading ? '—' : s.value}</p>
              <p className="text-xs text-on-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[['all','Tất cả'],['pass','Đã đạt'],['fail','Chưa đạt']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              filter === v ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface-low/70'}`}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-4 mb-4 text-red-500 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({length:5}).map((_,i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-low animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">assignment</span>
          <h2 className="font-bold text-lg mb-1">
            {filter === 'all' ? 'Chưa có lịch sử bài thi' : 'Không có kết quả phù hợp'}
          </h2>
          <p className="text-on-muted text-sm mb-4">
            {filter === 'all' ? 'Hãy thử làm một bài kiểm tra!' : 'Thử đổi bộ lọc khác.'}
          </p>
          {filter === 'all' && (
            <Link to="/courses"
              className="inline-flex items-center gap-1 text-sm text-tsubaki-red font-semibold hover:underline">
              Đến khóa học <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          {filtered.map(a => <AttemptRow key={a.id} attempt={a} />)}
        </div>
      )}
    </StudentLayout>
  );
}
