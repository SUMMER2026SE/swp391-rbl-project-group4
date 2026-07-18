import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MockExamShell from '../../components/mockexam/MockExamShell';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import LeaderboardTable from '../../components/mockexam/LeaderboardTable';
import { sectionDisplay, PASS_TOTAL, mondaiJa, mondaiVi, formatDuration } from '../../lib/mockExamConstants';
import { getMockExamMeta, getMockLeaderboard, startMockAttempt, getMockHistory } from '../../lib/mockExamApi';
import { useAuth } from '../../contexts/AuthContext';

export default function MockExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isTeacher } = useAuth();
  const teacher = isTeacher();
  const [exam, setExam] = useState(null);
  const [board, setBoard] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState(location.state?.tab || 'info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmStart, setConfirmStart] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.allSettled([getMockExamMeta(id), getMockLeaderboard(id), getMockHistory()])
      .then(([m, b, h]) => {
        if (m.status === 'fulfilled') setExam(m.value); else setError(m.reason.message);
        if (b.status === 'fulfilled') setBoard(b.value);
        // Chỉ lấy các lần thi của đề này (history trả kèm exam_id)
        if (h.status === 'fulfilled') setHistory(h.value.filter(x => x.exam_id === id));
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

  if (loading) return <MockExamShell title="Thi thử JLPT"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></MockExamShell>;
  if (!exam) return <MockExamShell title="Thi thử JLPT"><Alert type="error">{error || 'Không tìm thấy đề.'}</Alert></MockExamShell>;

  // Đề premium bị khóa: chỉ được tiếp tục attempt dở (nếu có), không bắt đầu mới
  const lockedNoResume = exam.locked && !exam.active_attempt_id;

  return (
    <MockExamShell title={exam.title}>
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
            // Teacher không mua được gói premium → badge khóa thay vì CTA nâng cấp
            teacher ? (
              <span className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-outline/30 text-on-muted text-sm font-bold">
                <span className="material-symbols-outlined text-lg">lock</span> Chỉ dành cho học viên Premium
              </span>
            ) : (
              <button onClick={() => navigate('/subscription')}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-colors">
                <span className="material-symbols-outlined text-lg">workspace_premium</span> Nâng cấp Premium
              </button>
            )
          ) : (
            <Button onClick={() => setConfirmStart(true)}>
              {exam.active_attempt_id ? 'Tiếp tục làm' : 'Bắt đầu thi'}
            </Button>
          )}
        </div>

        {lockedNoResume && (
          <Alert type="warning">
            {teacher ? (
              <>Đề này chỉ dành cho <b>học viên Premium</b> — giáo viên chỉ làm được các đề miễn phí.
              {exam.submitted_attempts > 0 && <> Bạn vẫn xem lại được kết quả các lần thi trước trong <button onClick={() => navigate('/mock-exams/history')} className="font-semibold text-tsubaki-red hover:underline">Lịch sử bài làm</button>.</>}</>
            ) : (
              <>Đề này dành cho tài khoản <b>Premium</b>.
              {exam.submitted_attempts > 0
                ? <> Bạn vẫn xem lại được kết quả các lần thi trước trong <button onClick={() => navigate('/mock-exams/history')} className="font-semibold text-tsubaki-red hover:underline">Lịch sử bài làm</button>, nhưng cần nâng cấp để làm lại.</>
                : <> Nâng cấp để bắt đầu làm bài.</>}</>
            )}
          </Alert>
        )}

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <div className="flex gap-2 border-b border-outline/30">
          {[['info', 'Cấu trúc đề'], ['board', 'Bảng xếp hạng'], ['history', 'Lịch sử bài làm']].map(([k, label]) => (
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
                <div className="divide-y divide-outline/10">
                  {s.mondai.map((m, i) => (
                    <div key={i} className="flex items-baseline gap-2 py-1">
                      <span className="text-xs font-mono text-on-muted shrink-0 w-14">問題{m.mondai_number}</span>
                      <span className="text-sm text-charcoal flex-1">{mondaiVi(m.mondai_type)}</span>
                      <span className="text-[11px] text-on-muted shrink-0">{mondaiJa(m.mondai_type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Alert type="warning">Bài thi làm <b>tuần tự từng phần</b>, mỗi phần có thời gian riêng. Hết giờ phần nào sẽ tự nộp và <b>không quay lại</b> được. Điểm hiển thị là <b>điểm ước lượng</b> (quy đổi tuyến tính, không phải scaled score chính thức).</Alert>
          </div>
        ) : tab === 'board' ? (
          <LeaderboardTable board={board?.board} myRank={board?.my_rank} />
        ) : (
          <div className="bg-white border border-outline/40 rounded-2xl overflow-hidden">
            {history.length === 0 ? (
              <p className="text-center text-on-muted py-10">Bạn chưa làm đề này lần nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-low text-xs text-on-muted uppercase">
                      <th className="text-center px-3 py-2 font-semibold">Điểm</th>
                      <th className="text-center px-3 py-2 font-semibold">Kết quả</th>
                      <th className="text-center px-3 py-2 font-semibold">Thời gian</th>
                      <th className="text-center px-3 py-2 font-semibold">Ngày làm</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-t border-outline/20 hover:bg-surface-low/50">
                        <td className="text-center px-3 py-2.5 font-bold">{h.total_score}/180</td>
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
    </MockExamShell>
  );
}
