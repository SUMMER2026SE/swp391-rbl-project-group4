import { useState, useEffect, useCallback, useRef } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';

// ── Level metadata ─────────────────────────────────────────────────────────────

const LEVEL_INFO = {
  N5: {
    emoji: '🌱',
    label: 'N5 — Sơ cấp',
    who: 'Người mới bắt đầu',
    difficulty: 'Dễ',
    difficultyColor: 'text-emerald-600',
    scope: '~100 từ vựng cơ bản, ~80 Kanji, ngữ pháp giao tiếp đơn giản',
    gradient: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-300',
    accent: 'bg-emerald-500',
  },
  N4: {
    emoji: '🌿',
    label: 'N4 — Sơ cấp nâng cao',
    who: 'Đã học 1–2 năm',
    difficulty: 'Trung bình',
    difficultyColor: 'text-amber-600',
    scope: '~300 từ vựng, ~300 Kanji, ngữ pháp thông thường',
    gradient: 'from-amber-50 to-yellow-50',
    border: 'border-amber-300',
    accent: 'bg-amber-500',
  },
  N3: {
    emoji: '🌳',
    label: 'N3 — Trung cấp',
    who: 'Đã học 2–3 năm',
    difficulty: 'Trung bình – Khó',
    difficultyColor: 'text-orange-500',
    scope: '~650 từ vựng, ~650 Kanji, ngữ pháp đa dạng',
    gradient: 'from-orange-50 to-amber-50',
    border: 'border-orange-300',
    accent: 'bg-orange-500',
  },
  N2: {
    emoji: '🏔️',
    label: 'N2 — Trung cao cấp',
    who: 'Đã học 3–4 năm',
    difficulty: 'Khó',
    difficultyColor: 'text-red-500',
    scope: '~1500 từ vựng, ~1000 Kanji, ngữ pháp nâng cao',
    gradient: 'from-red-50 to-rose-50',
    border: 'border-red-300',
    accent: 'bg-red-500',
  },
  N1: {
    emoji: '⛰️',
    label: 'N1 — Cao cấp',
    who: 'Thành thạo',
    difficulty: 'Rất khó',
    difficultyColor: 'text-red-700',
    scope: '~2000+ từ vựng, ~2000 Kanji, ngữ pháp học thuật',
    gradient: 'from-purple-50 to-violet-50',
    border: 'border-purple-300',
    accent: 'bg-purple-600',
  },
};

const ALL_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtDate(d) {
  return new Date(d).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = 'bg-tsubaki-red' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-surface-low rounded-full h-2 overflow-hidden">
      <div className={`${color} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function LevelBadge({ level }) {
  const info = LEVEL_INFO[level];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${info.accent} text-white`}>
      {info.emoji} {level}
    </span>
  );
}

// ── Views ──────────────────────────────────────────────────────────────────────

function IntroView({ config, status, onSelect, onResume }) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="text-6xl">📝</div>
        <h1 className="text-3xl font-bold text-charcoal">Kiểm tra năng lực</h1>
        <p className="text-on-muted text-base">Đánh giá trình độ tiếng Nhật của bạn với bài test chuẩn JLPT</p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { icon: '❓', label: `${config?.totalQuestions || 30} câu hỏi` },
          { icon: '⏱️', label: `${config?.durationMinutes || 30} phút` },
          { icon: '📊', label: '3 kỹ năng' },
        ].map(({ icon, label }) => (
          <div key={label} className="bg-surface-low rounded-2xl p-4 space-y-1">
            <div className="text-2xl">{icon}</div>
            <div className="text-sm font-semibold text-charcoal">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-outline/30 p-5 space-y-3">
        <h2 className="font-bold text-charcoal">Bài test gồm</h2>
        <ul className="space-y-2 text-sm text-on-muted">
          <li className="flex items-center gap-2"><span className="text-tsubaki-red">•</span> <span><strong className="text-charcoal">10 câu từ vựng</strong> — nhận dạng và hiểu nghĩa từ</span></li>
          <li className="flex items-center gap-2"><span className="text-tsubaki-red">•</span> <span><strong className="text-charcoal">10 câu Kanji</strong> — đọc và viết chữ Hán</span></li>
          <li className="flex items-center gap-2"><span className="text-tsubaki-red">•</span> <span><strong className="text-charcoal">10 câu ngữ pháp</strong> — cấu trúc và mẫu câu</span></li>
        </ul>
      </div>

      {status?.hasPendingAttempt && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm">Bạn có bài thi đang dở</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Cấp độ: <LevelBadge level={status.pendingLevel} /> — Tiếp tục hay bắt đầu mới?
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={onResume} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
                Tiếp tục bài cũ
              </button>
              <button onClick={onSelect} className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-colors">
                Chọn cấp độ mới
              </button>
            </div>
          </div>
        </div>
      )}

      {!status?.hasPendingAttempt && (
        <button onClick={onSelect} className="w-full py-4 bg-tsubaki-red text-white rounded-2xl font-bold text-lg hover:bg-tsubaki-red/90 transition-colors shadow-md">
          Chọn cấp độ & bắt đầu →
        </button>
      )}
    </div>
  );
}

function LevelSelectView({ levels, status, onStart, onBack }) {
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const hasPending = status?.hasPendingAttempt;

  const handleConfirm = () => {
    if (!selected) return;
    if (hasPending) {
      setConfirming(true);
    } else {
      onStart(selected, false);
    }
  };

  const levelMap = {};
  (levels || []).forEach(l => { levelMap[l.level] = l; });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-low transition-colors text-on-muted">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-bold text-charcoal">Chọn cấp độ JLPT</h1>
          <p className="text-sm text-on-muted">Chọn cấp độ phù hợp với trình độ hiện tại của bạn</p>
        </div>
      </div>

      <div className="space-y-3">
        {ALL_LEVELS.map(lvl => {
          const info = LEVEL_INFO[lvl];
          const data = levelMap[lvl];
          const available = data?.available ?? false;
          const needsFallback = data?.needsFallback ?? false;
          const isSelected = selected === lvl;

          return (
            <button
              key={lvl}
              disabled={!available}
              onClick={() => available && setSelected(lvl)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-150 ${
                !available ? 'opacity-40 cursor-not-allowed border-outline/30 bg-surface-low' :
                isSelected ? `${info.border} bg-gradient-to-r ${info.gradient} shadow-md` :
                'border-outline/30 bg-white hover:border-outline hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{info.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-charcoal">{info.label}</span>
                      {needsFallback && available && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">kết hợp cấp thấp hơn</span>
                      )}
                      {!available && (
                        <span className="text-xs bg-surface-low text-on-muted px-2 py-0.5 rounded-full">Chưa đủ câu hỏi</span>
                      )}
                    </div>
                    <div className="text-xs text-on-muted mt-0.5">{info.who}</div>
                    <div className="text-xs text-on-muted mt-1">{info.scope}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-semibold ${info.difficultyColor}`}>{info.difficulty}</span>
                  {data && (
                    <span className="text-xs text-on-muted">{data.total} câu</span>
                  )}
                  {isSelected && <span className="text-tsubaki-red">✓</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && !confirming && (
        <div className={`bg-gradient-to-r ${LEVEL_INFO[selected].gradient} border ${LEVEL_INFO[selected].border} rounded-2xl p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{LEVEL_INFO[selected].emoji}</span>
            <span className="font-bold text-charcoal">Bắt đầu thi {selected}</span>
          </div>
          <p className="text-sm text-on-muted">30 câu hỏi • 30 phút • Từ vựng, Kanji, Ngữ pháp</p>
          {hasPending && (
            <p className="text-sm text-amber-700">⚠️ Bài thi cũ ({status.pendingLevel}) sẽ bị tự động nộp và tính điểm.</p>
          )}
          <button onClick={handleConfirm}
            className="w-full py-3 bg-tsubaki-red text-white rounded-xl font-bold hover:bg-tsubaki-red/90 transition-colors">
            Bắt đầu thi {selected} →
          </button>
        </div>
      )}

      {confirming && (
        <div className="bg-white border border-red-200 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="text-center space-y-2">
            <span className="text-3xl">⚠️</span>
            <h3 className="font-bold text-charcoal">Xác nhận bắt đầu mới</h3>
            <p className="text-sm text-on-muted">Bài thi <strong>{status.pendingLevel}</strong> hiện tại sẽ bị tự động nộp. Bạn có chắc chắn muốn bắt đầu <strong>{selected}</strong> không?</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setConfirming(false)} className="flex-1 py-3 border border-outline/50 rounded-xl text-sm font-semibold text-on-muted hover:bg-surface-low">Hủy</button>
            <button onClick={() => onStart(selected, true)} className="flex-1 py-3 bg-tsubaki-red text-white rounded-xl text-sm font-bold hover:bg-tsubaki-red/90">Xác nhận</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamView({ attempt, questions, savedAnswers: initialAnswers, onSubmit }) {
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.floor((new Date(attempt.expires_at) - Date.now()) / 1000)));
  const timerRef = useRef(null);
  const submitRef = useRef(null);

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    const answered = Object.values(answers).filter(v => v).length;
    if (!auto && answered < questions.length) {
      const ok = window.confirm(`Bạn còn ${questions.length - answered} câu chưa trả lời. Nộp bài?`);
      if (!ok) return;
    }
    setSubmitting(true);
    clearInterval(timerRef.current);
    try {
      const { data } = await api.post(`/placement/${attempt.id}/submit`);
      onSubmit(data);
    } catch (e) {
      alert('Lỗi nộp bài: ' + (e.response?.data?.error || e.message));
      setSubmitting(false);
    }
  }, [submitting, answers, questions, attempt.id, onSubmit]);

  submitRef.current = handleSubmit;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const answered = Object.values(answers).filter(v => v).length;
  const q = questions[current];
  const level = attempt.jlpt_level_selected;

  const handleSelect = async (questionId, optionId) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    try {
      await api.put(`/placement/${attempt.id}/answer`, { questionId, optionId });
    } catch (_) {}
  };

  if (!q) return null;

  const timerColor = timeLeft < 60 ? 'text-red-500' : timeLeft < 300 ? 'text-amber-500' : 'text-charcoal';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white border border-outline/30 rounded-2xl p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-on-muted">Câu {current + 1}/{questions.length}</span>
            {level && <LevelBadge level={level} />}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              q.category === 'vocabulary' ? 'bg-blue-100 text-blue-700' :
              q.category === 'kanji' ? 'bg-purple-100 text-purple-700' :
              'bg-green-100 text-green-700'
            }`}>
              {q.category === 'vocabulary' ? 'Từ vựng' : q.category === 'kanji' ? 'Kanji' : 'Ngữ pháp'}
            </span>
          </div>
          <ProgressBar value={answered} max={questions.length} />
        </div>
        <div className={`text-2xl font-mono font-bold tabular-nums ${timerColor}`}>{fmtTime(timeLeft)}</div>
        <button onClick={() => handleSubmit(false)} disabled={submitting}
          className="px-4 py-2 bg-tsubaki-red text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-tsubaki-red/90 transition-colors">
          {submitting ? '...' : 'Nộp bài'}
        </button>
      </div>

      {/* Question */}
      <div className="bg-white border border-outline/30 rounded-2xl p-6 space-y-5">
        <p className="text-lg font-medium text-charcoal leading-relaxed">{q.question_text}</p>
        <div className="space-y-2">
          {(q.options || []).map(opt => {
            const isSelected = answers[q.id] === opt.id;
            return (
              <button key={opt.id} onClick={() => handleSelect(q.id, opt.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-100 font-medium text-sm ${
                  isSelected ? 'border-tsubaki-red bg-red-50 text-tsubaki-red' : 'border-outline/30 hover:border-outline bg-white text-charcoal'
                }`}>
                {opt.option_text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}
          className="px-5 py-2.5 border border-outline/50 rounded-xl text-sm font-semibold text-on-muted disabled:opacity-30 hover:bg-surface-low transition-colors">
          ← Trước
        </button>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                i === current ? 'bg-tsubaki-red text-white' :
                answers[questions[i].id] ? 'bg-tsubaki-red/20 text-tsubaki-red' :
                'bg-surface-low text-on-muted hover:bg-surface'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>
        <button onClick={() => setCurrent(p => Math.min(questions.length - 1, p + 1))} disabled={current === questions.length - 1}
          className="px-5 py-2.5 border border-outline/50 rounded-xl text-sm font-semibold text-on-muted disabled:opacity-30 hover:bg-surface-low transition-colors">
          Sau →
        </button>
      </div>
    </div>
  );
}

function ResultView({ result, onHistory, onRetake }) {
  const { attempt, analysis, questionsWithCorrect = [], answers = [] } = result;
  const [showReview, setShowReview] = useState(false);
  const level = attempt?.jlpt_level_selected;

  const scoreColor = analysis.score >= 80 ? 'text-emerald-600' : analysis.score >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreRingColor = analysis.score >= 80 ? '#10b981' : analysis.score >= 60 ? '#f59e0b' : '#ef4444';

  const answerMap = {};
  answers.forEach(a => { answerMap[a.question_id] = a; });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Score card */}
      <div className="bg-white border border-outline/30 rounded-2xl p-6 text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl font-bold text-charcoal">Kết quả bài thi</h2>
          {level && <LevelBadge level={level} />}
        </div>

        <div className="relative w-32 h-32 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={scoreRingColor} strokeWidth="10"
              strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - analysis.score / 100)}`}
              strokeLinecap="round" className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${scoreColor}`}>{analysis.score}%</span>
            <span className="text-xs text-on-muted">{attempt.correct_count}/{attempt.total_questions}</span>
          </div>
        </div>

        {analysis.levelEvaluation && (
          <p className="text-sm text-on-muted italic bg-surface-low rounded-xl px-4 py-3">{analysis.levelEvaluation}</p>
        )}
        <p className="font-semibold text-charcoal">🎯 {analysis.recommendedLevel}</p>
      </div>

      {/* Category breakdown */}
      <div className="bg-white border border-outline/30 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-charcoal">Chi tiết theo kỹ năng</h3>
        {[
          { label: 'Từ vựng', pct: analysis.vp, c: attempt.vocab_correct, t: attempt.vocab_total, color: 'bg-blue-500' },
          { label: 'Kanji',   pct: analysis.kp, c: attempt.kanji_correct, t: attempt.kanji_total, color: 'bg-purple-500' },
          { label: 'Ngữ pháp', pct: analysis.gp, c: attempt.grammar_correct, t: attempt.grammar_total, color: 'bg-green-500' },
        ].map(({ label, pct, c, t, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-charcoal">{label}</span>
              <span className="text-on-muted">{c}/{t} — {pct}%</span>
            </div>
            <ProgressBar value={pct} max={100} color={color} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
          <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3">{analysis.strengthsText}</div>
          <div className="bg-red-50 text-red-700 rounded-xl p-3">{analysis.weaknessText}</div>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations?.length > 0 && (
        <div className="bg-white border border-outline/30 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-charcoal">Gợi ý học tập</h3>
          {analysis.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-surface-low rounded-xl">
              <span className="text-lg mt-0.5">📘</span>
              <div>
                <p className="font-semibold text-charcoal text-sm">{rec.title}</p>
                <p className="text-xs text-on-muted mt-0.5">{rec.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question review */}
      <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden">
        <button onClick={() => setShowReview(v => !v)}
          className="w-full p-4 flex items-center justify-between hover:bg-surface-low transition-colors">
          <span className="font-bold text-charcoal">Xem lại đáp án ({questionsWithCorrect.length} câu)</span>
          <span className="material-symbols-outlined text-on-muted">{showReview ? 'expand_less' : 'expand_more'}</span>
        </button>
        {showReview && (
          <div className="border-t border-outline/30 divide-y divide-outline/20">
            {questionsWithCorrect.map((q, i) => {
              const userAns = answerMap[q.id];
              const opts = [...(q.placement_test_question_options || [])].sort((a, b) => a.sort_order - b.sort_order);
              const isCorrect = userAns?.is_correct;
              return (
                <div key={q.id} className={`p-4 ${isCorrect ? 'bg-emerald-50/40' : 'bg-red-50/40'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-sm font-bold w-5 shrink-0 ${isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>{i + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-charcoal">{q.question_text}</p>
                      <div className="space-y-1">
                        {opts.map(opt => {
                          const isUserPick = userAns?.selected_option_id === opt.id;
                          const isCorrectOpt = opt.is_correct;
                          return (
                            <div key={opt.id} className={`text-xs px-3 py-1.5 rounded-lg ${
                              isCorrectOpt ? 'bg-emerald-100 text-emerald-800 font-semibold' :
                              isUserPick && !isCorrectOpt ? 'bg-red-100 text-red-700 line-through' :
                              'text-on-muted'
                            }`}>
                              {isCorrectOpt && '✓ '}{isUserPick && !isCorrectOpt && '✗ '}{opt.option_text}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && <p className="text-xs text-on-muted bg-white rounded-lg px-3 py-2 border border-outline/20">💡 {q.explanation}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onHistory} className="flex-1 py-3 border border-outline/50 rounded-xl font-semibold text-on-muted hover:bg-surface-low transition-colors">
          Lịch sử
        </button>
        <button onClick={onRetake} className="flex-1 py-3 bg-tsubaki-red text-white rounded-xl font-bold hover:bg-tsubaki-red/90 transition-colors">
          Làm lại
        </button>
      </div>
    </div>
  );
}

function HistoryView({ history, onBack }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-low transition-colors text-on-muted">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-xl font-bold text-charcoal">Lịch sử bài thi</h2>
      </div>
      {history.length === 0 ? (
        <div className="text-center py-12 text-on-muted">Chưa có lịch sử bài thi</div>
      ) : (
        <div className="space-y-3">
          {history.map(h => {
            const sc = h.score >= 80 ? 'text-emerald-600' : h.score >= 60 ? 'text-amber-500' : 'text-red-500';
            return (
              <div key={h.id} className="bg-white border border-outline/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.jlpt_level_selected && <LevelBadge level={h.jlpt_level_selected} />}
                    <span className="text-xs text-on-muted">{fmtDate(h.submitted_at)}</span>
                  </div>
                  <span className={`text-xl font-black tabular-nums ${sc}`}>{h.score}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { label: 'Từ vựng', c: h.vocab_correct, t: h.vocab_total },
                    { label: 'Kanji', c: h.kanji_correct, t: h.kanji_total },
                    { label: 'Ngữ pháp', c: h.grammar_correct, t: h.grammar_total },
                  ].map(({ label, c, t }) => (
                    <div key={label} className="bg-surface-low rounded-xl p-2">
                      <div className="font-bold text-charcoal">{c}/{t}</div>
                      <div className="text-on-muted">{label}</div>
                    </div>
                  ))}
                </div>
                {h.recommended_level && (
                  <p className="text-xs text-on-muted">→ {h.recommended_level}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PlacementTest() {
  const [view, setView]             = useState('loading');
  const [status, setStatus]         = useState(null);
  const [config, setConfig]         = useState(null);
  const [levels, setLevels]         = useState([]);
  const [examData, setExamData]     = useState(null);
  const [resultData, setResultData] = useState(null);
  const [history, setHistory]       = useState([]);
  const [error, setError]           = useState('');
  const [starting, setStarting]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [statusRes, configRes] = await Promise.all([
          api.get('/placement/check-status'),
          api.get('/placement/config'),
        ]);
        setStatus(statusRes.data);
        setConfig(configRes.data);
        setView('intro');
      } catch (e) {
        setError('Không thể tải trang kiểm tra: ' + (e.response?.data?.error || e.message));
        setView('error');
      }
    })();
  }, []);

  const loadLevels = async () => {
    try {
      const { data } = await api.get('/placement/levels');
      setLevels(data);
    } catch (_) {}
  };

  const handleSelectView = async () => {
    await loadLevels();
    setView('level-select');
  };

  const handleResume = async () => {
    setStarting(true);
    try {
      const { data } = await api.post('/placement/start', {});
      setExamData(data);
      setView('exam');
    } catch (e) {
      alert(e.response?.data?.error || 'Không thể tiếp tục bài thi.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartWithLevel = async (level, forceNew) => {
    setStarting(true);
    try {
      const { data } = await api.post('/placement/start', { jlpt_level: level, force_new: forceNew });
      setExamData(data);
      setView('exam');
    } catch (e) {
      alert(e.response?.data?.error || 'Không thể bắt đầu bài thi.');
    } finally {
      setStarting(false);
    }
  };

  const handleExamSubmit = (result) => {
    setResultData(result);
    setView('result');
    setStatus(prev => ({ ...prev, hasCompleted: true, hasPendingAttempt: false }));
  };

  const handleHistory = async () => {
    try {
      const { data } = await api.get('/placement/history');
      setHistory(data);
      setView('history');
    } catch (_) {}
  };

  const handleRetake = async () => {
    await loadLevels();
    const { data } = await api.get('/placement/check-status');
    setStatus(data);
    setView('level-select');
  };

  if (starting) {
    return (
      <StudentLayout title="Kiểm tra NL">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-on-muted">Đang chuẩn bị bài thi...</p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout title="Kiểm tra NL">
      <div className="py-4">
        {view === 'loading' && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {view === 'error' && (
          <div className="max-w-md mx-auto text-center py-12 space-y-3">
            <span className="text-4xl">❌</span>
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={() => window.location.reload()} className="px-5 py-2 bg-tsubaki-red text-white rounded-xl font-semibold">Thử lại</button>
          </div>
        )}
        {view === 'intro' && (
          <IntroView config={config} status={status} onSelect={handleSelectView} onResume={handleResume} />
        )}
        {view === 'level-select' && (
          <LevelSelectView levels={levels} status={status} onStart={handleStartWithLevel} onBack={() => setView('intro')} />
        )}
        {view === 'exam' && examData && (
          <ExamView attempt={examData.attempt} questions={examData.questions} savedAnswers={examData.savedAnswers} onSubmit={handleExamSubmit} />
        )}
        {view === 'result' && resultData && (
          <ResultView result={resultData} onHistory={handleHistory} onRetake={handleRetake} />
        )}
        {view === 'history' && (
          <HistoryView history={history} onBack={() => setView(resultData ? 'result' : 'intro')} />
        )}
      </div>
    </StudentLayout>
  );
}
