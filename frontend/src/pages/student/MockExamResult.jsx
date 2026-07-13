import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ScoreColumns from '../../components/mockexam/ScoreColumns';
import MockExamCertificate from '../../components/mockexam/MockExamCertificate';
import { useAuth } from '../../contexts/AuthContext';
import { formatDuration } from '../../lib/mockExamConstants';
import { getMockResult } from '../../lib/mockExamApi';

// Vòng tròn điểm tổng (SVG progress ring)
function ScoreRing({ score, passed }) {
  const R = 66, C = 2 * Math.PI * R;
  const pct = Math.min(1, Math.max(0, (score || 0) / 180));
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="12" className="stroke-black/10" />
        <circle cx="80" cy="80" r={R} fill="none" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          className={passed ? 'stroke-green-500' : 'stroke-error'}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-charcoal leading-none">{score}</p>
        <p className="text-sm text-on-muted mt-1">/ 180</p>
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

  if (loading) return <StudentLayout title="Kết quả"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (!result) return <StudentLayout title="Kết quả"><Alert type="error">{error}</Alert></StudentLayout>;

  const passed = result.passed;
  const userName = user?.user_metadata?.full_name || user?.email || 'Học viên';
  const dateStr = result.submitted_at
    ? new Date(result.submitted_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <StudentLayout title="Kết quả thi thử">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Hero: banner đậu/trượt + vòng tròn điểm */}
        <div className={`rounded-2xl p-6 sm:p-8 text-center border ${passed ? 'bg-green-50 border-green-200' : 'bg-error-bg/50 border-error/30'}`}>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-5 ${passed ? 'bg-green-600 text-white' : 'bg-error text-white'}`}>
            <span className="material-symbols-outlined text-lg">{passed ? 'verified' : 'sentiment_dissatisfied'}</span>
            {passed ? 'ĐẬU' : 'CHƯA ĐẠT'}
          </div>
          <ScoreRing score={result.total_score} passed={passed} />
          <p className="text-sm text-charcoal font-semibold mt-4">{result.exam_title}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-on-muted mt-2">
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">flag</span>Điểm đậu {result.level}: {result.pass_total}/180</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{formatDuration(result.duration_seconds)}</span>
            {dateStr && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">event</span>{dateStr}</span>}
          </div>
        </div>

        <ScoreColumns scores={result.scores} columns={result.score_columns} />

        <Alert type="info">※ Đây là <b>điểm ước lượng</b> (quy đổi tuyến tính theo tỉ lệ đúng), không phải scaled score chính thức của JLPT. Cần đạt tổng ≥ {result.pass_total} <b>và</b> mọi cột trên điểm liệt để đậu.</Alert>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate(`/mock-exams/attempt/${attemptId}/review`)}>
            <span className="material-symbols-outlined text-lg">fact_check</span> Xem đáp án
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/mock-exams/${result.exam_id}`)}>
            <span className="material-symbols-outlined text-lg">leaderboard</span> Bảng xếp hạng
          </Button>
          <Link to="/mock-exams" className="ml-auto text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1 self-center">Về danh sách đề</Link>
        </div>

        {/* Phiếu báo điểm (chứng chỉ mô phỏng) */}
        <div>
          <h2 className="font-display font-bold text-charcoal mb-3">Phiếu báo điểm</h2>
          <MockExamCertificate result={result} userName={userName} />
        </div>
      </div>
    </StudentLayout>
  );
}
