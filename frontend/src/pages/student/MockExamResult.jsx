import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ScoreColumns from '../../components/mockexam/ScoreColumns';
import { formatDuration } from '../../lib/mockExamConstants';
import { getMockResult } from '../../lib/mockExamApi';

export default function MockExamResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMockResult(attemptId).then(setResult).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <StudentLayout title="Kết quả"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (!result) return <StudentLayout title="Kết quả"><Alert type="error">{error}</Alert></StudentLayout>;

  const passed = result.passed;

  return (
    <StudentLayout title="Kết quả thi thử">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className={`rounded-2xl p-6 text-center ${passed ? 'bg-green-50 border border-green-200' : 'bg-error-bg/50 border border-error/30'}`}>
          <span className={`material-symbols-outlined text-5xl ${passed ? 'text-green-600' : 'text-error'}`}>{passed ? 'verified' : 'sentiment_dissatisfied'}</span>
          <h1 className={`font-display text-2xl font-bold mt-2 ${passed ? 'text-green-700' : 'text-error'}`}>{passed ? 'ĐẬU' : 'CHƯA ĐẠT'}</h1>
          <p className="text-4xl font-bold text-charcoal mt-3">{result.total_score}<span className="text-lg text-on-muted">/180</span></p>
          <p className="text-xs text-on-muted mt-1">Điểm đậu {result.level}: {result.pass_total}/180 · Thời gian: {formatDuration(result.duration_seconds)}</p>
        </div>

        <ScoreColumns scores={result.scores} columns={result.score_columns} />

        <Alert type="info">※ Đây là <b>điểm ước lượng</b> (quy đổi tuyến tính theo tỉ lệ đúng), không phải scaled score chính thức của JLPT. Cần đạt tổng ≥ {result.pass_total} <b>và</b> mọi cột trên điểm liệt để đậu.</Alert>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate(`/mock-exams/attempt/${attemptId}/review`)}>
            <span className="material-symbols-outlined text-lg">fact_check</span> Xem lại bài làm
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/mock-exams/${result.exam_id}`)}>
            <span className="material-symbols-outlined text-lg">leaderboard</span> Bảng xếp hạng
          </Button>
          <Link to="/mock-exams" className="ml-auto text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1 self-center">Về danh sách đề</Link>
        </div>
      </div>
    </StudentLayout>
  );
}
