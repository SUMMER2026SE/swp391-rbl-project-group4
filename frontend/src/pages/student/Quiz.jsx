import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import api from '../../lib/api';

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

  useEffect(() => {
    api.get(`/quizzes/${id}`)
      .then(r => {
        setQuiz(r.data);
        if (r.data.time_limit) setTimeLeft(r.data.time_limit);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!timeLeft) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft !== null && !result]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await api.post(`/quizzes/${id}/attempt`, { answers });
      setResult(r.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <StudentLayout title="Quiz"><div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (error && !quiz) return <StudentLayout title="Lỗi"><Alert type="error">{error}</Alert></StudentLayout>;

  const questions = quiz?.questions || [];
  const q         = questions[current];
  const pct       = Math.round((Object.keys(answers).length / questions.length) * 100);

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
            <div className="space-y-3">
              {(q.options || []).map((opt, i) => (
                <button key={i} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
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

            <div className="flex justify-between mt-8">
              <Button variant="secondary" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                ← Trước
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent(c => c + 1)} disabled={!answers[q.id]}>
                  Tiếp →
                </Button>
              ) : (
                <Button onClick={handleSubmit} loading={submitting}
                  disabled={Object.keys(answers).length < questions.length}>
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
