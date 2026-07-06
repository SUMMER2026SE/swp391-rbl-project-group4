import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function ScoreCircle({ score }) {
  const radius = 52;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color  = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-outline/20" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-xs text-on-muted font-semibold">/ 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, correct, total }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-on-muted tabular-nums">{correct}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 bg-outline/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Views ─────────────────────────────────────────────────────────────────────

function IntroView({ status, config, onStart, onShowHistory, loading }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-8 space-y-6">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-tsubaki-red/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-tsubaki-red">assignment_ind</span>
      </div>
      <div>
        <h1 className="font-display text-3xl font-bold mb-2">Kiểm tra năng lực</h1>
        <p className="text-on-muted text-base leading-relaxed">
          Bài kiểm tra {config?.totalQuestions || 30} câu ({config?.durationMinutes || 30} phút) đánh giá trình độ của bạn qua 3 kỹ năng:
          Từ vựng, Kanji và Ngữ pháp. Kết quả giúp đề xuất lộ trình học phù hợp nhất.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: 'translate',      label: 'Từ vựng', count: config?.perCategory || 10, color: 'text-blue-500' },
          { icon: 'font_download',  label: 'Kanji',   count: config?.perCategory || 10, color: 'text-purple-500' },
          { icon: 'spellcheck',     label: 'Ngữ pháp', count: config?.perCategory || 10, color: 'text-emerald-500' },
        ].map(({ icon, label, count, color }) => (
          <div key={label} className="glass-card rounded-2xl p-4 text-center">
            <span className={`material-symbols-outlined text-3xl ${color}`}>{icon}</span>
            <p className="font-bold mt-1">{label}</p>
            <p className="text-on-muted text-sm">{count} câu</p>
          </div>
        ))}
      </div>

      <ul className="text-left text-sm text-on-muted space-y-2 bg-surface-low rounded-2xl p-4">
        {[
          'Mỗi câu có 4 lựa chọn, chọn đáp án đúng nhất.',
          'Đáp án được tự động lưu khi bạn chọn.',
          'Bạn có thể nộp bài bất kỳ lúc nào hoặc đợi hết giờ.',
          'Sau 24 giờ, bạn có thể làm lại bài kiểm tra.',
        ].map(t => (
          <li key={t} className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-tsubaki-red mt-0.5">check_circle</span>
            {t}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        {status?.hasPendingAttempt ? (
          <button onClick={() => onStart(true)} disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base transition-all disabled:opacity-50">
            {loading ? 'Đang tải...' : 'Tiếp tục bài thi đang dở →'}
          </button>
        ) : null}

        <button onClick={() => onStart(false)} disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-tsubaki-red hover:bg-tsubaki-red/90 text-white font-bold text-base transition-all disabled:opacity-50">
          {loading
            ? 'Đang tải...'
            : status?.hasPendingAttempt
              ? 'Bắt đầu bài thi mới'
              : 'Bắt đầu kiểm tra'}
        </button>

        {status?.hasCompleted && (
          <button onClick={onShowHistory}
            className="w-full py-3 rounded-2xl border border-outline/40 text-on-muted hover:bg-surface-low font-semibold text-sm transition-all">
            Xem lịch sử kết quả
          </button>
        )}
      </div>
    </div>
  );
}

function ExamView({ attempt, questions, answers, onAnswer, onSubmit, submitting }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const warned = useRef(new Set());

  useEffect(() => {
    if (!attempt?.expires_at) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) onSubmit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt?.expires_at]);

  const answered  = Object.values(answers).filter(v => v).length;
  const current   = questions[currentIdx];
  const timerColor = timeLeft <= 60 ? 'text-red-500' : timeLeft <= 300 ? 'text-amber-500' : 'text-emerald-600';

  if (!current) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header bar */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-on-muted">
            {currentIdx + 1} / {questions.length}
          </span>
          <div className="flex gap-0.5">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => setCurrentIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIdx ? 'bg-tsubaki-red w-4' : answers[q.id] ? 'bg-emerald-500' : 'bg-outline/30'
                }`} />
            ))}
          </div>
        </div>

        <div className={`flex items-center gap-1.5 font-bold tabular-nums ${timerColor}`}>
          <span className="material-symbols-outlined text-base">timer</span>
          {fmtTime(timeLeft)}
        </div>

        <button onClick={() => setShowGrid(v => !v)}
          className="text-xs text-on-muted border border-outline/30 px-3 py-1.5 rounded-xl hover:bg-surface-low transition-colors">
          {answered}/{questions.length} câu
        </button>
      </div>

      {/* Question grid overlay */}
      {showGrid && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm font-bold mb-3 text-on-muted">Điều hướng câu hỏi</p>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => { setCurrentIdx(i); setShowGrid(false); }}
                className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                  i === currentIdx ? 'bg-tsubaki-red text-white' :
                  answers[q.id] ? 'bg-emerald-100 text-emerald-700' :
                  'bg-surface-low text-on-muted hover:bg-outline/20'
                }`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-on-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />Đã trả lời</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface-low border border-outline/30 inline-block" />Chưa trả lời</span>
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
            current.category === 'vocabulary' ? 'bg-blue-100 text-blue-700' :
            current.category === 'kanji' ? 'bg-purple-100 text-purple-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>
            {current.category === 'vocabulary' ? 'Từ vựng' : current.category === 'kanji' ? 'Kanji' : 'Ngữ pháp'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            current.difficulty === 'hard' ? 'bg-red-50 text-red-500' :
            current.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' :
            'bg-emerald-50 text-emerald-600'
          }`}>
            {current.difficulty === 'hard' ? 'Khó' : current.difficulty === 'medium' ? 'Trung bình' : 'Dễ'}
          </span>
        </div>

        <p className="text-lg font-medium leading-relaxed">{current.question_text}</p>

        <div className="space-y-2.5">
          {(current.options || []).map((opt, oi) => {
            const selected = answers[current.id] === opt.id;
            return (
              <button key={opt.id} onClick={() => onAnswer(current.id, opt.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium ${
                  selected
                    ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                    : 'border-outline/30 hover:border-tsubaki-red/50 hover:bg-tsubaki-red/5'
                }`}>
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${
                  selected ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted'
                }`}>
                  {String.fromCharCode(65 + oi)}
                </span>
                {opt.option_text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-outline/30 text-sm font-semibold disabled:opacity-40 hover:bg-surface-low transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Câu trước
        </button>

        <button onClick={() => setShowConfirm(true)} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-bold hover:bg-tsubaki-red/90 transition-colors disabled:opacity-50">
          Nộp bài
        </button>

        <button onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))} disabled={currentIdx === questions.length - 1}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-outline/30 text-sm font-semibold disabled:opacity-40 hover:bg-surface-low transition-colors">
          Câu tiếp <span className="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </div>

      {/* Submit confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-charcoal rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Xác nhận nộp bài</h3>
            <p className="text-on-muted text-sm">
              Bạn đã trả lời <strong>{answered}/{questions.length}</strong> câu.
              {answered < questions.length && (
                <span className="text-amber-600"> Còn {questions.length - answered} câu chưa trả lời.</span>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-outline/30 text-sm font-semibold hover:bg-surface-low transition-colors">
                Làm tiếp
              </button>
              <button onClick={() => { setShowConfirm(false); onSubmit(false); }} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-bold hover:bg-tsubaki-red/90 transition-colors disabled:opacity-50">
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({ result, analysis, questionsWithCorrect, answers, onRetake, onHistory }) {
  const [showReview, setShowReview] = useState(false);
  const attempt = result;

  const ansMap = {};
  (answers || []).forEach(a => { ansMap[a.question_id] = a; });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Score */}
      <div className="glass-card rounded-2xl p-6 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">Kết quả kiểm tra</h2>
        <ScoreCircle score={analysis?.score ?? attempt?.score ?? 0} />
        <div>
          <p className="text-lg font-bold">{attempt?.recommended_level || analysis?.recommendedLevel}</p>
          <p className="text-sm text-on-muted">Trả lời đúng {attempt?.correct_count}/{attempt?.total_questions} câu</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="font-bold">Phân tích theo kỹ năng</h3>
        <CategoryBar label="Từ vựng" correct={attempt?.vocab_correct ?? 0}   total={attempt?.vocab_total ?? 0} />
        <CategoryBar label="Kanji"   correct={attempt?.kanji_correct ?? 0}   total={attempt?.kanji_total ?? 0} />
        <CategoryBar label="Ngữ pháp" correct={attempt?.grammar_correct ?? 0} total={attempt?.grammar_total ?? 0} />
      </div>

      {/* Strengths / Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-4 bg-emerald-50/50">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">Điểm mạnh</p>
          <p className="text-sm">{attempt?.strengths || analysis?.strengthsText || '—'}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 bg-amber-50/50">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">Cần cải thiện</p>
          <p className="text-sm">{attempt?.weaknesses || analysis?.weaknessText || '—'}</p>
        </div>
      </div>

      {/* Recommendations */}
      {analysis?.recommendations?.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="font-bold">Gợi ý lộ trình học</h3>
          {analysis.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-low">
              <span className="material-symbols-outlined text-tsubaki-red mt-0.5">school</span>
              <div>
                <p className="font-semibold text-sm">{rec.title}</p>
                <p className="text-xs text-on-muted">{rec.reason}</p>
              </div>
            </div>
          ))}
          <Link to="/courses" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-bold hover:bg-tsubaki-red/90 transition-colors">
            <span className="material-symbols-outlined text-base">menu_book</span>
            Xem khóa học
          </Link>
        </div>
      )}

      {/* Review answers */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <button onClick={() => setShowReview(v => !v)}
          className="flex items-center justify-between w-full font-bold text-sm">
          <span>Xem lại đáp án ({questionsWithCorrect?.length || 0} câu)</span>
          <span className="material-symbols-outlined text-lg">{showReview ? 'expand_less' : 'expand_more'}</span>
        </button>

        {showReview && (
          <div className="space-y-4 pt-2">
            {(questionsWithCorrect || []).map((q, i) => {
              const userAns = ansMap[q.id];
              const opts = [...(q.placement_test_question_options || [])].sort((a, b) => a.sort_order - b.sort_order);
              const correctOpt = opts.find(o => o.is_correct);
              return (
                <div key={q.id} className={`p-4 rounded-xl border-2 ${userAns?.is_correct ? 'border-emerald-300 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${userAns?.is_correct ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {userAns?.is_correct ? '✓' : '✗'}
                    </span>
                    <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                  </div>
                  {!userAns?.is_correct && userAns?.selected_option_id && (
                    <p className="text-xs text-red-500 ml-7 mb-1">
                      Bạn chọn: {opts.find(o => o.id === userAns.selected_option_id)?.option_text || '—'}
                    </p>
                  )}
                  <p className="text-xs text-emerald-700 ml-7 font-semibold">
                    Đáp án đúng: {correctOpt?.option_text || '—'}
                  </p>
                  {q.explanation && (
                    <p className="text-xs text-on-muted ml-7 mt-1 italic">{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onHistory}
          className="flex-1 py-3 rounded-2xl border border-outline/30 text-sm font-semibold hover:bg-surface-low transition-colors">
          Lịch sử kết quả
        </button>
        <button onClick={onRetake}
          className="flex-1 py-3 rounded-2xl bg-tsubaki-red text-white text-sm font-bold hover:bg-tsubaki-red/90 transition-colors">
          Làm lại (sau 24h)
        </button>
      </div>
    </div>
  );
}

function HistoryView({ history, onBack, onViewResult }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-low transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="font-display text-xl font-bold">Lịch sử kiểm tra</h2>
      </div>

      {history.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-40">history</span>
          Chưa có kết quả nào.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((h, i) => {
            const vp = h.vocab_total   > 0 ? Math.round(h.vocab_correct   / h.vocab_total   * 100) : 0;
            const kp = h.kanji_total   > 0 ? Math.round(h.kanji_correct   / h.kanji_total   * 100) : 0;
            const gp = h.grammar_total > 0 ? Math.round(h.grammar_correct / h.grammar_total * 100) : 0;
            const scoreColor = h.score >= 75 ? 'text-emerald-600' : h.score >= 50 ? 'text-amber-600' : 'text-red-500';
            return (
              <button key={h.id} onClick={() => onViewResult(h.id)}
                className="glass-card rounded-2xl p-4 w-full text-left hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{Math.round(h.score)}</span>
                    <span className="text-on-muted text-sm ml-1">điểm</span>
                    <span className="text-xs text-on-muted ml-3">{h.correct_count}/{h.total_questions} đúng</span>
                  </div>
                  <span className="text-xs text-on-muted">
                    {new Date(h.submitted_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm font-semibold mb-2">{h.recommended_level}</p>
                <div className="flex gap-4 text-xs text-on-muted">
                  <span>Từ vựng: <strong className="text-charcoal">{vp}%</strong></span>
                  <span>Kanji: <strong className="text-charcoal">{kp}%</strong></span>
                  <span>Ngữ pháp: <strong className="text-charcoal">{gp}%</strong></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlacementTest() {
  const [view, setView]     = useState('loading');   // loading | intro | exam | result | history
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [error, setError]   = useState('');

  // Exam
  const [attempt, setAttempt]     = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Result
  const [result, setResult]                     = useState(null);
  const [analysis, setAnalysis]                 = useState(null);
  const [questionsWithCorrect, setQuestionsWithCorrect] = useState([]);
  const [resultAnswers, setResultAnswers]       = useState([]);

  // History
  const [history, setHistory] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/placement/config'),
      api.get('/placement/check-status'),
    ]).then(([cfgRes, statusRes]) => {
      setConfig(cfgRes.data);
      setStatus(statusRes.data);
      setView('intro');
    }).catch(() => setView('intro'));
  }, []);

  const handleStart = async () => {
    setLoadingStart(true);
    setError('');
    try {
      const { data } = await api.post('/placement/start');
      setAttempt(data.attempt);
      setQuestions(data.questions);
      const initialAnswers = {};
      Object.entries(data.savedAnswers || {}).forEach(([qId, optId]) => {
        initialAnswers[qId] = optId;
      });
      setAnswers(initialAnswers);
      setView('exam');
    } catch (e) {
      setError(e.response?.data?.error || 'Không thể bắt đầu bài thi. Vui lòng thử lại.');
    } finally {
      setLoadingStart(false);
    }
  };

  const handleAnswer = useCallback(async (questionId, optionId) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    try {
      await api.put(`/placement/${attempt.id}/answer`, { questionId, optionId });
    } catch { /* silent — UI already updated */ }
  }, [attempt?.id]);

  const handleSubmit = async (isAuto) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/placement/${attempt.id}/submit`);
      setResult(data.attempt);
      setAnalysis(data.analysis);
      setQuestionsWithCorrect(data.questionsWithCorrect || []);
      setResultAnswers(data.answers || []);
      setStatus(prev => ({ ...prev, hasCompleted: true }));
      setView('result');
    } catch (e) {
      setError(e.response?.data?.error || 'Không thể nộp bài. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShowHistory = async () => {
    try {
      const { data } = await api.get('/placement/history');
      setHistory(data);
      setView('history');
    } catch { setHistory([]); setView('history'); }
  };

  const handleViewHistoryResult = async (attemptId) => {
    try {
      const { data } = await api.get(`/placement/${attemptId}/result`);
      setResult(data.attempt);
      setAnalysis(data.analysis);
      setQuestionsWithCorrect(data.questionsWithCorrect || []);
      setResultAnswers(data.answers || []);
      setView('result');
    } catch {}
  };

  const handleRetake = () => {
    setResult(null); setAnalysis(null); setAttempt(null);
    setQuestions([]); setAnswers({});
    setView('intro');
    // refresh status
    api.get('/placement/check-status').then(r => setStatus(r.data)).catch(() => {});
  };

  const viewTitles = {
    loading: '',
    intro:   'Kiểm tra năng lực',
    exam:    'Đang làm bài kiểm tra',
    result:  'Kết quả kiểm tra',
    history: 'Lịch sử kiểm tra',
  };

  return (
    <StudentLayout title={viewTitles[view] || 'Kiểm tra năng lực'}>
      {error && (
        <div className="max-w-2xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
          <button onClick={() => setError('')} className="ml-auto"><span className="material-symbols-outlined text-base">close</span></button>
        </div>
      )}

      {view === 'loading' && (
        <div className="flex items-center justify-center min-h-64">
          <div className="w-8 h-8 border-3 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {view === 'intro' && (
        <IntroView
          status={status} config={config}
          onStart={handleStart}
          onShowHistory={handleShowHistory}
          loading={loadingStart}
        />
      )}

      {view === 'exam' && (
        <ExamView
          attempt={attempt} questions={questions} answers={answers}
          onAnswer={handleAnswer} onSubmit={handleSubmit} submitting={submitting}
        />
      )}

      {view === 'result' && (
        <ResultView
          result={result} analysis={analysis}
          questionsWithCorrect={questionsWithCorrect} answers={resultAnswers}
          onRetake={handleRetake} onHistory={handleShowHistory}
        />
      )}

      {view === 'history' && (
        <HistoryView
          history={history}
          onBack={() => setView('intro')}
          onViewResult={handleViewHistoryResult}
        />
      )}
    </StudentLayout>
  );
}
