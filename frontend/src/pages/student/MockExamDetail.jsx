import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import LeaderboardTable from '../../components/mockexam/LeaderboardTable';
import { sectionDisplay, PASS_TOTAL, mondaiJa, mondaiVi } from '../../lib/mockExamConstants';
import { getMockExamMeta, getMockLeaderboard, startMockAttempt } from '../../lib/mockExamApi';

export default function MockExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [board, setBoard] = useState(null);
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmStart, setConfirmStart] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.allSettled([getMockExamMeta(id), getMockLeaderboard(id)])
      .then(([m, b]) => {
        if (m.status === 'fulfilled') setExam(m.value); else setError(m.reason.message);
        if (b.status === 'fulfilled') setBoard(b.value);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const totalMinutes = exam?.sections?.reduce((s, x) => s + x.time_limit_minutes, 0) || 0;

  const handleStart = async () => {
    setStarting(true); setError('');
    try {
      const r = await startMockAttempt(id);
      navigate(`/mock-exams/attempt/${r.attempt.id}`);
    } catch (e) { setError(e.message); setStarting(false); }
  };

  if (loading) return <StudentLayout title="Thi thử JLPT"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (!exam) return <StudentLayout title="Thi thử JLPT"><Alert type="error">{error || 'Không tìm thấy đề.'}</Alert></StudentLayout>;

  // Đề premium bị khóa: chỉ được tiếp tục attempt dở (nếu có), không bắt đầu mới
  const lockedNoResume = exam.locked && !exam.active_attempt_id;

  return (
    <StudentLayout title={exam.title}>
      <div className="space-y-5 max-w-3xl mx-auto">
        <button onClick={() => navigate('/mock-exams')} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách đề
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex px-2.5 py-1 rounded-lg bg-sumire-purple/10 text-sumire-purple font-bold text-sm">{exam.level}</span>
              {exam.locked && (
                <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold text-xs">
                  <span className="material-symbols-outlined text-sm">workspace_premium</span>Premium
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold text-charcoal">{exam.title}</h1>
            {exam.description && <p className="text-sm text-on-muted mt-1">{exam.description}</p>}
          </div>
          {lockedNoResume ? (
            <button onClick={() => navigate('/subscription')}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-colors">
              <span className="material-symbols-outlined text-lg">workspace_premium</span> Nâng cấp Premium
            </button>
          ) : (
            <Button onClick={() => setConfirmStart(true)}>
              {exam.active_attempt_id ? 'Tiếp tục làm' : 'Bắt đầu thi'}
            </Button>
          )}
        </div>

        {lockedNoResume && (
          <Alert type="warning">
            Đề này dành cho tài khoản <b>Premium</b>.
            {exam.submitted_attempts > 0
              ? <> Bạn vẫn xem lại được kết quả các lần thi trước trong <button onClick={() => navigate('/mock-exams/history')} className="font-semibold text-tsubaki-red hover:underline">Lịch sử &amp; thống kê</button>, nhưng cần nâng cấp để làm lại.</>
              : <> Nâng cấp để bắt đầu làm bài.</>}
          </Alert>
        )}

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <div className="flex gap-2 border-b border-outline/30">
          {[['info', 'Cấu trúc đề'], ['board', 'Bảng xếp hạng']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'info' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-tsubaki-red">timer</span><b>{totalMinutes}</b> phút</span>
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-tsubaki-red">flag</span>Điểm đậu: <b>{PASS_TOTAL[exam.level]}</b>/180</span>
            </div>
            {exam.sections.map(s => (
              <div key={s.id} className="border border-outline/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-charcoal">{sectionDisplay(s)}</h3>
                  <span className="text-xs text-on-muted flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{s.time_limit_minutes} phút · {s.question_count} câu</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.mondai.map((m, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-surface-low text-on-muted">問題{m.mondai_number} {mondaiJa(m.mondai_type)} · {mondaiVi(m.mondai_type)}</span>
                  ))}
                </div>
              </div>
            ))}
            <Alert type="warning">Bài thi làm <b>tuần tự từng phần</b>, mỗi phần có thời gian riêng. Hết giờ phần nào sẽ tự nộp và <b>không quay lại</b> được. Điểm hiển thị là <b>điểm ước lượng</b> (quy đổi tuyến tính, không phải scaled score chính thức).</Alert>
          </div>
        ) : (
          <LeaderboardTable board={board?.board} myRank={board?.my_rank} />
        )}
      </div>

      <Modal open={confirmStart} onClose={() => setConfirmStart(false)} title="Bắt đầu bài thi?"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmStart(false)}>Hủy</Button>
          <Button onClick={handleStart} loading={starting}>{exam.active_attempt_id ? 'Tiếp tục' : 'Bắt đầu'}</Button>
        </>}>
        <p className="text-sm text-on-surface-variant">
          Bài thi gồm <b>{exam.sections.length} phần</b>, tổng <b>{totalMinutes} phút</b>. Mỗi phần tính giờ riêng, hết giờ tự nộp và không quay lại. Hãy đảm bảo bạn có đủ thời gian trước khi bắt đầu.
        </p>
      </Modal>
    </StudentLayout>
  );
}
