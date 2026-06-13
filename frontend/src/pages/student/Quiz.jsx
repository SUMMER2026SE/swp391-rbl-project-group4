import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import api from '../../lib/api';
import { useProctoring } from '../../lib/useProctoring';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz]         = useState(null);
  const [answers, setAnswers]   = useState({});
  const [result, setResult]     = useState(null);
  const [current, setCurrent]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [furigana, setFurigana] = useState(false);
  const [shuffledRights, setShuffledRights] = useState({}); // matching: cột phải đã xáo trộn

  const isProctored = quiz?.mode === 'proctored';
  const proctor     = useProctoring(id, { enabled: isProctored });
  // Thi giám sát: chỉ bắt đầu sau khi học sinh cấp quyền & vào phòng thi
  const examStarted = !isProctored || proctor.status === 'active';

  useEffect(() => {
    api.get(`/quizzes/${id}`)
      .then(r => {
        setQuiz(r.data);
        const sr = {};
        (r.data.questions || []).forEach(q => {
          if (q.question_type === 'matching')
            sr[q.id] = shuffle((q.options || []).map(p => p.right));
        });
        setShuffledRights(sr);
        if (r.data.time_limit) setTimeLeft(r.data.time_limit);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!timeLeft || !examStarted) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft !== null && !result && examStarted]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { answers };
      if (isProctored) Object.assign(payload, proctor.getProctorData());
      const r = await api.post(`/quizzes/${id}/attempt`, payload);
      if (isProctored) proctor.stop();
      setResult(r.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <StudentLayout title="Quiz"><div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (error && !quiz) return <StudentLayout title="Lỗi"><Alert type="error">{error}</Alert></StudentLayout>;

  // ── Phòng thi giám sát: màn hình chờ cấp quyền ──────────────────────────────
  if (isProctored && !examStarted && !result) {
    return (
      <StudentLayout title={quiz?.title}>
        <div className="max-w-lg mx-auto">
          <div className="glass-card rounded-2xl p-8">
            <div className="text-center mb-6">
              <span className="material-symbols-outlined text-5xl text-tsubaki-red block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <h1 className="font-display text-2xl font-bold">Bài thi có giám sát</h1>
              <p className="text-sm text-on-muted mt-1">{quiz?.title}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-2 mb-6">
              <p className="font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">info</span> Quy định phòng thi
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-amber-800">
                <li>Bài thi sẽ chuyển sang chế độ <strong>toàn màn hình</strong>.</li>
                <li>Cần bật <strong>webcam</strong> trong suốt quá trình làm bài.</li>
                <li>Thoát toàn màn hình, chuyển tab, hoặc rời khỏi khung hình sẽ bị <strong>ghi nhận vi phạm</strong> và báo cho giáo viên.</li>
                <li>Hệ thống tự động chụp ảnh định kỳ để giám sát.</li>
              </ul>
            </div>

            {proctor.status === 'denied' && (
              <Alert type="error" className="mb-4">{proctor.errorMsg}</Alert>
            )}

            <Button onClick={proctor.start} loading={proctor.status === 'requesting'} className="w-full">
              <span className="material-symbols-outlined text-lg">play_circle</span>
              {proctor.status === 'denied' ? 'Thử lại — Vào phòng thi' : 'Tôi đã hiểu — Bắt đầu thi'}
            </Button>
            <button onClick={() => navigate(-1)} className="w-full mt-3 text-sm text-on-muted hover:text-charcoal">
              Quay lại
            </button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  const questions = quiz?.questions || [];
  const q         = questions[current];

  const isAnswered = (qq) => {
    const a    = answers[qq.id];
    const type = qq.question_type || 'single_choice';
    if (type === 'matching') return Array.isArray(a) && a.length === (qq.options || []).length && a.every(Boolean);
    if (type === 'ordering') return Array.isArray(a) && a.length === (qq.options || []).length;
    if (type === 'multiple_choice') return Array.isArray(a) && a.length > 0;
    return typeof a === 'string' && a.trim() !== '';
  };
  const answeredCount = questions.filter(isAnswered).length;
  const pct           = Math.round((answeredCount / questions.length) * 100);
  const setAnswer     = (qid, val) => setAnswers(a => ({ ...a, [qid]: val }));

  if (result) {
    const score = result.score;
    const total = result.total;
    const pctScore = Math.round((score / total) * 100);
    return (
      <StudentLayout title="Kết quả">
        <div className="max-w-md mx-auto text-center">
          <div className="glass-card rounded-2xl p-10">
            <span className={`material-symbols-outlined text-7xl mb-4 block ${pctScore >= 70 ? 'text-green-500' : 'text-tsubaki-red'}`}>
              {pctScore >= 70 ? 'emoji_events' : 'sentiment_dissatisfied'}
            </span>
            <h1 className="font-display text-3xl font-bold mb-2">Kết quả</h1>
            <p className="text-6xl font-bold text-tsubaki-red mb-2">{score}<span className="text-2xl text-on-muted">/{total}</span></p>
            <p className="text-on-muted mb-6">{pctScore}% — {pctScore >= 80 ? 'Xuất sắc!' : pctScore >= 60 ? 'Khá tốt!' : 'Cần ôn luyện thêm.'}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setResult(null); setAnswers({}); setCurrent(0); }}>Làm lại</Button>
              <Button variant="secondary" onClick={() => navigate(-1)}>Quay lại</Button>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout title={quiz?.title}>
      {/* ── Giám sát: webcam HUD + overlay che đề ── */}
      {isProctored && examStarted && (
        <>
          <div className="fixed bottom-4 right-4 z-40 bg-charcoal/90 rounded-xl p-2 shadow-2xl w-44">
            <video ref={proctor.videoRef} muted playsInline className="w-full rounded-lg bg-black aspect-[4/3] object-cover" />
            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <span className={`text-[10px] font-bold flex items-center gap-1 ${
                proctor.faceStatus === 'ok' ? 'text-emerald-400'
                : proctor.faceStatus === 'unknown' ? 'text-white/50' : 'text-red-400'}`}>
                <span className="material-symbols-outlined text-[13px]">
                  {proctor.faceStatus === 'ok' ? 'face' : proctor.faceStatus === 'multiple' ? 'groups' : 'no_accounts'}
                </span>
                {proctor.faceStatus === 'ok' ? 'Đang giám sát'
                  : proctor.faceStatus === 'no_face' ? 'Không thấy mặt'
                  : proctor.faceStatus === 'multiple' ? 'Nhiều người' : 'Đang tải...'}
              </span>
              {proctor.violations > 0 && (
                <span className="text-[10px] font-bold text-red-400 flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">warning</span>{proctor.violations}
                </span>
              )}
            </div>
          </div>

          {!proctor.isFullscreen && (
            <div className="fixed inset-0 z-50 bg-charcoal/95 backdrop-blur-xl flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <span className="material-symbols-outlined text-6xl text-amber-400 block mb-4">visibility_off</span>
                <h2 className="font-display text-2xl font-bold text-white mb-2">Nội dung bị ẩn</h2>
                <p className="text-white/70 text-sm mb-2">
                  Bạn đã thoát chế độ toàn màn hình. Vi phạm này đã được ghi nhận.
                </p>
                <p className="text-red-400 text-sm font-semibold mb-6">Số lần vi phạm: {proctor.violations}</p>
                <Button onClick={proctor.reenterFullscreen} className="w-full">
                  <span className="material-symbols-outlined text-lg">fullscreen</span>
                  Quay lại toàn màn hình để tiếp tục
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="max-w-2xl mx-auto">
        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="font-display font-bold text-xl">{quiz?.title}</h1>
            <div className="flex items-center gap-3">
              {timeLeft !== null && (
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${timeLeft < 30 ? 'bg-error-bg text-error' : 'bg-surface-low text-on-muted'}`}>
                  ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              )}
              <span className="text-sm text-on-muted">{current + 1}/{questions.length}</span>
            </div>
          </div>
          <div className="h-2 bg-surface-low rounded-full overflow-hidden">
            <div className="h-full bg-tsubaki-red rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Question */}
        {q && (
          <div className="glass-card rounded-2xl p-8">
            <div className="flex justify-between items-start gap-4 mb-6">
              <FuriganaText text={q.question} enabled={furigana} textClassName="font-display font-bold text-lg" block />
              <button
                type="button"
                onClick={() => setFurigana(v => !v)}
                title={furigana ? 'Ẩn furigana' : 'Hiển thị furigana'}
                className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all select-none ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'}`}>
                <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
                ふりがな
              </button>
            </div>
            {/* ── Single choice ── */}
            {(!q.question_type || q.question_type === 'single_choice') && (
              <div className="space-y-3">
                {(q.options || []).map((opt, i) => (
                  <button key={i} onClick={() => setAnswer(q.id, opt)}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                      answers[q.id] === opt
                        ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                        : 'border-outline hover:border-tsubaki-red/50 hover:bg-surface-low'
                    }`}>
                    <span className="font-bold mr-3 text-on-muted">{String.fromCharCode(65 + i)}.</span>
                    <FuriganaText text={opt} enabled={furigana} />
                  </button>
                ))}
              </div>
            )}

            {/* ── Multiple choice ── */}
            {q.question_type === 'multiple_choice' && (
              <div className="space-y-3">
                <p className="text-xs text-on-muted -mt-3 mb-1">Chọn tất cả đáp án đúng:</p>
                {(q.options || []).map((opt, i) => {
                  const selected = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                  return (
                    <button key={i}
                      onClick={() => {
                        const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                        setAnswer(q.id, selected ? cur.filter(o => o !== opt) : [...cur, opt]);
                      }}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                        selected
                          ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                          : 'border-outline hover:border-tsubaki-red/50 hover:bg-surface-low'
                      }`}>
                      <span className={`material-symbols-outlined text-lg align-middle mr-3 ${selected ? 'text-tsubaki-red' : 'text-on-muted'}`}>
                        {selected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <FuriganaText text={opt} enabled={furigana} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Matching ── */}
            {q.question_type === 'matching' && (
              <div className="space-y-3">
                {(q.options || []).map((pair, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 rounded-xl border-2 border-outline bg-surface-low/50 text-sm font-medium">
                      <FuriganaText text={pair.left} enabled={furigana} />
                    </div>
                    <span className="material-symbols-outlined text-on-muted shrink-0">arrow_forward</span>
                    <select
                      value={(answers[q.id] || [])[i] || ''}
                      onChange={e => {
                        const next = Array.isArray(answers[q.id])
                          ? [...answers[q.id]]
                          : new Array((q.options || []).length).fill('');
                        next[i] = e.target.value;
                        setAnswer(q.id, next);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-outline text-sm font-medium bg-white focus:border-tsubaki-red outline-none cursor-pointer">
                      <option value="">— Chọn —</option>
                      {(shuffledRights[q.id] || []).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* ── Ordering ── */}
            {q.question_type === 'ordering' && (() => {
              const chosen    = Array.isArray(answers[q.id]) ? answers[q.id] : [];
              const remaining = (q.options || []).filter(o => !chosen.includes(o));
              return (
                <div>
                  <div className="min-h-[56px] flex flex-wrap gap-2 p-3 rounded-xl border-2 border-dashed border-outline mb-4">
                    {chosen.length === 0 && <span className="text-sm text-on-muted self-center">Bấm các từ bên dưới theo đúng thứ tự…</span>}
                    {chosen.map((w, i) => (
                      <button key={i} onClick={() => setAnswer(q.id, chosen.filter((_, j) => j !== i))}
                        title="Bấm để bỏ ra"
                        className="px-3 py-2 rounded-lg bg-tsubaki-red/10 border border-tsubaki-red/40 text-tsubaki-red text-sm font-medium">
                        {i + 1}. {w}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {remaining.map((w, i) => (
                      <button key={i} onClick={() => setAnswer(q.id, [...chosen, w])}
                        className="px-3 py-2 rounded-lg border-2 border-outline text-sm font-medium hover:border-tsubaki-red/50 hover:bg-surface-low transition-all">
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Fill blank / Short answer ── */}
            {(q.question_type === 'fill_blank' || q.question_type === 'short_answer') && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={e => setAnswer(q.id, e.target.value)}
                placeholder="Nhập câu trả lời…"
                className="w-full px-5 py-4 rounded-xl border-2 border-outline focus:border-tsubaki-red outline-none text-sm font-medium"
              />
            )}

            <div className="flex justify-between mt-8">
              <Button variant="secondary" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                ← Trước
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent(c => c + 1)} disabled={!isAnswered(q)}>
                  Tiếp →
                </Button>
              ) : (
                <Button onClick={handleSubmit} loading={submitting}
                  disabled={answeredCount < questions.length}>
                  Nộp bài
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
