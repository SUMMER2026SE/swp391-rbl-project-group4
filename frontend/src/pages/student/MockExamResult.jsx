import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MockExamShell from '../../components/mockexam/MockExamShell';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ScoreColumns from '../../components/mockexam/ScoreColumns';
import MockExamCertificate from '../../components/mockexam/MockExamCertificate';
import { useAuth } from '../../contexts/AuthContext';
import { formatDuration } from '../../lib/mockExamConstants';
import { getMockResult } from '../../lib/mockExamApi';

// Vòng tròn điểm tổng (SVG progress ring) — nhỏ gọn dùng trong hero
function ScoreRing({ score, passed, size = 120 }) {
  const R = 66, C = 2 * Math.PI * R;
  const pct = Math.min(1, Math.max(0, (score || 0) / 180));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="12" className="stroke-black/10" />
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          className={passed ? 'stroke-green-500' : 'stroke-error'}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-charcoal leading-none">{score}</p>
        <p className="text-xs text-on-muted mt-0.5">/ 180</p>
      </div>
    </div>
  );
}

export default function MockExamResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMockResult(attemptId).then(setResult).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <MockExamShell title="Kết quả"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></MockExamShell>;
  if (!result) return <MockExamShell title="Kết quả"><Alert type="error">{error}</Alert></MockExamShell>;

  const passed = result.passed;
  const userName = user?.user_metadata?.full_name || user?.email || 'Học viên';
  const dateStr = result.submitted_at
    ? new Date(result.submitted_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <MockExamShell title="Kết quả thi thử">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Về danh sách đề — góc trái trên cùng */}
        <Link to="/mock-exams" className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1 w-fit">
          <span className="material-symbols-outlined text-base">arrow_back</span> Về danh sách đề
        </Link>

        {/* Hero ngang full-width: vòng tròn điểm + kết quả + nút hành động */}
        <div className={`rounded-2xl p-6 sm:p-8 border ${passed ? 'bg-green-50 border-green-200' : 'bg-error-bg/50 border-error/30'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
            <ScoreRing score={result.total_score} passed={passed} size={120} />

            <div className="flex-1 text-center sm:text-left">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${passed ? 'bg-green-600 text-white' : 'bg-error text-white'}`}>
                <span className="material-symbols-outlined text-lg">{passed ? 'verified' : 'sentiment_dissatisfied'}</span>
                {passed ? 'ĐẬU' : 'CHƯA ĐẠT'}
              </div>
              <p className="text-base font-semibold text-charcoal">{result.exam_title}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1 text-xs text-on-muted mt-2">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">flag</span>Điểm đậu {result.level}: {result.pass_total}/180</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{formatDuration(result.duration_seconds)}</span>
                {dateStr && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">event</span>{dateStr}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
              <Button onClick={() => navigate(`/mock-exams/attempt/${attemptId}/review`)}>
                <span className="material-symbols-outlined text-lg">fact_check</span> Xem đáp án
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/mock-exams/${result.exam_id}`, { state: { tab: 'board' } })}>
                <span className="material-symbols-outlined text-lg">leaderboard</span> Bảng xếp hạng
              </Button>
            </div>
          </div>
        </div>

        {/* Phân tích điểm từng phần */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-charcoal">Phân tích điểm từng phần</h2>
          <ScoreColumns scores={result.scores} columns={result.score_columns} />
          <Alert type="info">Đây là <b>điểm ước lượng</b> (quy đổi tuyến tính theo tỉ lệ đúng), không phải scaled score chính thức của JLPT.</Alert>
        </div>

        {/* Phiếu báo điểm full-width, kích thước thật */}
        <MockExamCertificate result={result} userName={userName} />
      </div>
    </MockExamShell>
  );
}
