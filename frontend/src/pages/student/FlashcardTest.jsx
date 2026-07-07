import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import FlashcardModeTabs from '../../components/flashcards/FlashcardModeTabs';
import api from '../../lib/api';
import { shuffle, normalize, buildMcOptions } from '../../lib/flashcardQuiz';

const ALL_TYPES = [
  ['mc',    'Trắc nghiệm'],
  ['write', 'Tự luận'],
];

export default function FlashcardTest() {
  const { id } = useParams();

  const [set, setSet]         = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [stage, setStage] = useState('config'); // 'config' | 'doing' | 'result'

  // Cấu hình
  const [numQuestions, setNumQuestions] = useState(20);
  const [types, setTypes]     = useState({ mc: true, write: true });
  const [promptSide, setPromptSide] = useState('term'); // hỏi bằng mặt nào

  // Bài làm
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState([]); // song song questions: string | bool | null

  const canMulti = allCards.length >= 2; // đủ thẻ cho trắc nghiệm / đúng-sai

  // ── Tải set ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/flashcards/sets/${id}`);
        const data = r.data.data || r.data;
        const cards = data.cards || data.flashcards || [];
        setSet(data);
        setAllCards(cards);
        setNumQuestions(Math.min(20, cards.length || 1));
        if (cards.length < 2) setTypes({ mc: false, write: true }); // chỉ tự luận
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const answerSideOf = (side) => (side === 'term' ? 'definition' : 'term');

  // ── Sinh 1 câu theo loại ──
  const makeQuestion = (card, type, side) => {
    const answerSide = answerSideOf(side);
    if (type === 'mc') {
      const options = buildMcOptions(allCards, card, answerSide, 3);
      if (options.length >= 2) {
        return { type: 'mc', card, promptSide: side, answerSide,
          prompt: card[side], options, correctAnswer: card[answerSide] };
      }
      // không đủ lựa chọn → rơi về tự luận
    }
    // write (mặc định / fallback)
    return { type: 'write', card, promptSide: side, answerSide,
      prompt: card[side], correctAnswer: card[answerSide] };
  };

  // ── Bắt đầu: sinh đề ──
  const startTest = () => {
    const enabled = ALL_TYPES.map(([k]) => k).filter(k => types[k]);
    if (!enabled.length) return;
    const count = Math.min(numQuestions, allCards.length);
    const picked = shuffle(allCards).slice(0, count);
    const qs = picked.map((card, i) => {
      const side = promptSide === 'both' ? (Math.random() < 0.5 ? 'term' : 'definition') : promptSide;
      return makeQuestion(card, enabled[i % enabled.length], side);
    });
    setQuestions(qs);
    setAnswers(qs.map(() => null));
    setStage('doing');
  };

  const setAnswer = (i, val) => setAnswers(a => { const n = a.slice(); n[i] = val; return n; });

  // ── Chấm điểm ──
  const gradeOne = (q, ans) => {
    if (ans == null) return false;
    return normalize(ans) === normalize(q.correctAnswer);
  };

  const submit = () => setStage('result');

  const resetToConfig = () => { setStage('config'); setQuestions([]); setAnswers([]); };

  if (loading) {
    return (
      <StudentLayout title="Thẻ ghi nhớ">
        <div className="flex justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
        </div>
      </StudentLayout>
    );
  }

  const score = questions.reduce((n, q, i) => n + (gradeOne(q, answers[i]) ? 1 : 0), 0);
  const anyType = types.mc || types.write || types.tf;

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      <Link to="/flashcards" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Trở về
      </Link>

      <FlashcardModeTabs setId={id} active="test" />

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate">{set?.title}</h1>
        {stage === 'doing' && (
          <span className="text-sm font-semibold text-on-muted shrink-0">{questions.length} câu</span>
        )}
      </div>

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* ── CONFIG ──────────────────────────────────────────────── */}
      {stage === 'config' && (
        <div className="max-w-lg mx-auto glass-card rounded-2xl p-6 space-y-6">
          {allCards.length === 0 ? (
            <p className="text-center text-sm text-on-muted py-8">Học phần này chưa có thẻ nào để kiểm tra.</p>
          ) : (
            <>
              {allCards.length < 2 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                  <span className="material-symbols-outlined text-base">info</span>
                  Học phần chỉ có 1 thẻ nên chỉ dùng được câu tự luận.
                </div>
              )}

              {/* Số câu */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Số câu hỏi</label>
                <input
                  type="number"
                  min={1}
                  max={allCards.length}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Math.max(1, Math.min(allCards.length, Number(e.target.value) || 1)))}
                  className="w-28 px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
                />
                <span className="text-xs text-on-muted ml-2">/ {allCards.length} thẻ</span>
              </div>

              {/* Loại câu hỏi */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Loại câu hỏi</label>
                <div className="flex flex-col gap-2">
                  {ALL_TYPES.map(([key, label]) => {
                    const disabled = key === 'mc' && !canMulti;
                    return (
                      <label key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-low cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={!!types[key]}
                          onChange={e => setTypes(t => ({ ...t, [key]: e.target.checked }))}
                          className="accent-tsubaki-red w-4 h-4"
                        />
                        <span className="text-sm text-on-surface">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Hướng hỏi */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Hỏi bằng</label>
                <div className="flex flex-wrap gap-2">
                  {[['term', 'Từ vựng → Nghĩa'], ['definition', 'Nghĩa → Từ vựng'], ['both', 'Cả hai']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setPromptSide(val)}
                      className={`flex-1 min-w-[7rem] px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        promptSide === val
                          ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                          : 'border-outline text-on-muted hover:border-tsubaki-red/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startTest}
                disabled={!anyType}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                Bắt đầu kiểm tra
              </button>
            </>
          )}
        </div>
      )}

      {/* ── DOING ───────────────────────────────────────────────── */}
      {stage === 'doing' && (
        <div className="max-w-2xl mx-auto space-y-5">
          {questions.map((q, i) => (
            <QuestionCard key={i} index={i} q={q} value={answers[i]} onChange={v => setAnswer(i, v)} />
          ))}
          <button
            onClick={submit}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">done_all</span>
            Nộp bài
          </button>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────────── */}
      {stage === 'result' && (
        <div className="max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-4">Kết quả kiểm tra</p>
            <ScoreRing score={score} total={questions.length} />
            <p className="text-sm text-on-muted mt-3">
              Đúng {score}/{questions.length} câu
            </p>
          </div>

          <div className="space-y-4 mb-6">
            {questions.map((q, i) => (
              <ResultCard key={i} index={i} q={q} value={answers[i]} correct={gradeOne(q, answers[i])} />
            ))}
          </div>

          <button
            onClick={resetToConfig}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-3.5 hover:bg-tsubaki-red/5 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">replay</span>
            Làm lại
          </button>
        </div>
      )}
    </StudentLayout>
  );
}

// ── Một câu hỏi khi đang làm bài ──
function QuestionCard({ index, q, value, onChange }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-md bg-surface-low flex items-center justify-center text-xs font-bold text-on-muted shrink-0">
          {index + 1}
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted">
          {q.type === 'mc' ? 'Trắc nghiệm' : 'Tự luận'}
        </p>
      </div>

      <p className="font-display text-2xl font-bold text-on-surface mb-4 break-words">{q.prompt}</p>
      {q.type === 'mc' ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onChange(opt)}
              className={`flex items-center gap-3 text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsubaki-red/40 ${
                value === opt
                  ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                  : 'border-outline text-on-surface hover:border-tsubaki-red/50'
              }`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                value === opt ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted'
              }`}>
                {'ABCD'[i]}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          ))}
        </div>
      ) : (
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder={q.answerSide === 'term' ? 'Nhập từ vựng…' : 'Nhập định nghĩa…'}
          className="w-full px-4 py-3 bg-white border-2 border-outline rounded-xl text-base outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
        />
      )}
    </div>
  );
}

// ── Vòng điểm kết quả ──
function ScoreRing({ score, total }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-surface-low" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className="stroke-tsubaki-red transition-all duration-700"
          strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-on-surface leading-none">{pct}%</span>
        <span className="text-xs text-on-muted mt-1">chính xác</span>
      </div>
    </div>
  );
}

// ── Một câu trong màn kết quả ──
function ResultCard({ index, q, value, correct }) {
  const userText = value?.trim() ? value : '(bỏ trống)';
  const correctText = q.correctAnswer;
  const prompt = q.prompt;

  return (
    <div className={`rounded-2xl p-4 border-2 ${correct ? 'border-green-200 bg-green-50/50' : 'border-error/30 bg-error-bg/20'}`}>
      <div className="flex items-start gap-2">
        <span className={`material-symbols-outlined text-lg shrink-0 ${correct ? 'text-green-600' : 'text-error'}`}>
          {correct ? 'check_circle' : 'cancel'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-on-muted mb-1">Câu {index + 1}</p>
          <p className="text-sm font-semibold text-on-surface break-words mb-2">{prompt}</p>
          <p className="text-sm break-words">
            <span className="text-on-muted">Bạn trả lời: </span>
            <span className={correct ? 'text-green-700 font-medium' : 'text-error font-medium'}>{userText}</span>
          </p>
          {!correct && (
            <p className="text-sm break-words">
              <span className="text-on-muted">Đáp án đúng: </span>
              <span className="text-green-700 font-medium">{correctText}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
