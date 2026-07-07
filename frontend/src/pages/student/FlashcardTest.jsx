import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FlashcardModeTabs from '../../components/flashcards/FlashcardModeTabs';
import api from '../../lib/api';
import { shuffle, normalize, buildMcOptions } from '../../lib/flashcardQuiz';

// Loại câu hỏi: chọn 1 trong 3 (Cả hai = xen kẽ trắc nghiệm/tự luận)
const Q_TYPES = [
  ['mc',    'Trắc nghiệm'],
  ['write', 'Tự luận'],
  ['both',  'Cả hai'],
];

export default function FlashcardTest() {
  const { id } = useParams();

  const [set, setSet]         = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [stage, setStage] = useState('config'); // 'config' | 'doing' | 'result'

  // Cấu hình (popup Thiết lập bài kiểm tra)
  const [configOpen, setConfigOpen]     = useState(false);
  const [numQuestions, setNumQuestions] = useState(20);
  const [promptSide, setPromptSide]     = useState('term'); // hỏi bằng mặt nào
  const [qType, setQType]               = useState('both'); // 'mc' | 'write' | 'both'

  // Bài làm
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState([]); // song song questions: string | null
  const [confirmSubmit, setConfirmSubmit] = useState(false); // popup xác nhận khi còn câu trống

  // Kết quả
  const [resultFilter, setResultFilter] = useState('all'); // 'all' | 'correct' | 'wrong'

  const canMulti = allCards.length >= 2; // đủ thẻ cho trắc nghiệm

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
        if (cards.length < 2) setQType('write'); // chỉ tự luận
        setConfigOpen(cards.length > 0);         // vào trang là mở popup thiết lập
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
    const enabled = qType === 'both' ? ['mc', 'write'] : [qType];
    const count = Math.min(numQuestions, allCards.length);
    const picked = shuffle(allCards).slice(0, count);
    const qs = picked.map((card, i) => {
      const side = promptSide === 'both' ? (Math.random() < 0.5 ? 'term' : 'definition') : promptSide;
      return makeQuestion(card, enabled[i % enabled.length], side);
    });
    setQuestions(qs);
    setAnswers(qs.map(() => null));
    setResultFilter('all');
    setConfigOpen(false);
    setStage('doing');
    window.scrollTo({ top: 0 });
  };

  const setAnswer = (i, val) => setAnswers(a => { const n = a.slice(); n[i] = val; return n; });

  // Câu i coi là "đã làm" khi có nội dung (tự luận xoá trắng = chưa làm)
  const isAnswered = (i) => answers[i] != null && String(answers[i]).trim() !== '';
  const answeredCount = answers.reduce((n, _, i) => n + (isAnswered(i) ? 1 : 0), 0);

  // ── Chấm điểm ──
  const gradeOne = (q, ans) => {
    if (ans == null) return false;
    return normalize(ans) === normalize(q.correctAnswer);
  };

  // ── Nộp bài (còn câu trống → hỏi xác nhận) ──
  const submit = () => {
    if (answeredCount < questions.length) setConfirmSubmit(true);
    else finishTest();
  };

  const finishTest = () => {
    setConfirmSubmit(false);
    setStage('result');
    window.scrollTo({ top: 0 });
  };

  const resetToConfig = () => {
    setStage('config');
    setQuestions([]);
    setAnswers([]);
    setResultFilter('all');
    setConfigOpen(true);
  };

  const jumpTo = (i) => {
    document.getElementById(`test-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Nhảy đến 1 câu ở màn kết quả; câu đang bị tab lọc ẩn → chuyển về "Tất cả" rồi mới cuộn
  const jumpToResult = (i, correct) => {
    const visible = resultFilter === 'all' || (resultFilter === 'correct') === correct;
    const scroll = () =>
      document.getElementById(`result-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (visible) scroll();
    else {
      setResultFilter('all');
      // Chờ danh sách render lại sau khi đổi tab rồi mới cuộn (2 khung hình cho chắc)
      requestAnimationFrame(() => requestAnimationFrame(scroll));
    }
  };

  if (loading) {
    return (
      <StudentLayout title="Thẻ ghi nhớ">
        <div className="flex justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
        </div>
      </StudentLayout>
    );
  }

  const graded = questions.map((q, i) => gradeOne(q, answers[i]));
  const score  = graded.reduce((n, ok) => n + (ok ? 1 : 0), 0);

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      {/* ── Header: nút back + tên học phần ─────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          to="/flashcards"
          title="Trở về"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low text-on-muted hover:text-charcoal transition-colors shrink-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate flex-1">{set?.title}</h1>
        {stage === 'doing' && (
          <span className="text-sm font-semibold text-on-muted shrink-0">{questions.length} câu</span>
        )}
      </div>

      <FlashcardModeTabs setId={id} active="test" />

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* ── CONFIG: màn nền + popup Thiết lập bài kiểm tra ─────────── */}
      {stage === 'config' && (
        <div className="max-w-lg mx-auto glass-card rounded-2xl p-10 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-5xl text-tsubaki-red/60 mb-3">quiz</span>
          {allCards.length === 0 ? (
            <p className="text-sm text-on-muted">Học phần này chưa có thẻ nào để kiểm tra.</p>
          ) : (
            <>
              <p className="text-sm text-on-muted mb-6">
                Thiết lập số câu, cách hỏi và loại câu hỏi rồi bắt đầu làm bài.
              </p>
              <button
                onClick={() => setConfigOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl px-6 py-3 hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">tune</span>
                Thiết lập bài kiểm tra
              </button>
            </>
          )}
        </div>
      )}

      <Modal
        open={stage === 'config' && configOpen}
        onClose={() => setConfigOpen(false)}
        title="Thiết lập bài kiểm tra"
        size="md"
        footer={
          <button
            onClick={startTest}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            Bắt đầu làm kiểm tra
          </button>
        }
      >
        <div className="space-y-6">
          {!canMulti && (
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

          {/* Loại câu hỏi */}
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">Loại câu hỏi</label>
            <div className="flex flex-wrap gap-2">
              {Q_TYPES.map(([val, label]) => {
                const disabled = val !== 'write' && !canMulti;
                return (
                  <button
                    key={val}
                    disabled={disabled}
                    onClick={() => setQType(val)}
                    className={`flex-1 min-w-[7rem] px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      disabled
                        ? 'border-outline text-on-muted opacity-40 cursor-not-allowed'
                        : qType === val
                          ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                          : 'border-outline text-on-muted hover:border-tsubaki-red/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── DOING: câu hỏi + bảng điều hướng bên phải ───────────────── */}
      {stage === 'doing' && (
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] items-start">
          {/* Danh sách câu hỏi */}
          <div className="order-2 lg:order-1 min-w-0 space-y-5">
            {questions.map((q, i) => (
              <div key={i} id={`test-q-${i}`} className="scroll-mt-24">
                <QuestionCard index={i} q={q} value={answers[i]} onChange={v => setAnswer(i, v)} />
              </div>
            ))}
            <button
              onClick={submit}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg">done_all</span>
              Nộp bài
            </button>
          </div>

          {/* Bảng điều hướng câu hỏi */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-24 glass-card rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-1">Bảng câu hỏi</p>
            <p className="text-sm text-on-muted mb-3">
              Đã trả lời <span className="font-semibold text-on-surface">{answeredCount}/{questions.length}</span>
            </p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(i)}
                  title={`Câu ${i + 1}`}
                  className={`h-9 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsubaki-red/40 ${
                    isAnswered(i)
                      ? 'bg-tsubaki-red text-white'
                      : 'bg-white border border-outline text-on-surface hover:border-tsubaki-red/50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={submit}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-2.5 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg">done_all</span>
              Nộp bài
            </button>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        icon="assignment_turned_in"
        variant="primary"
        title="Nộp bài kiểm tra?"
        message={`Còn ${questions.length - answeredCount} câu chưa trả lời. Bạn vẫn muốn nộp bài?`}
        confirmLabel="Nộp bài"
        cancelLabel="Làm tiếp"
        onConfirm={finishTest}
        onCancel={() => setConfirmSubmit(false)}
      />

      {/* ── RESULT: điểm + lọc Đúng/Sai + bảng điều hướng câu ───────── */}
      {stage === 'result' && (
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] items-start">
          <div className="min-w-0">
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-4">Kết quả kiểm tra</p>
              <ScoreRing score={score} total={questions.length} />
              <p className="text-sm text-on-muted mt-3">
                Đúng {score}/{questions.length} câu
              </p>
            </div>

            {/* Tab lọc kết quả */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                ['all',     'Tất cả',   questions.length],
                ['correct', 'Câu đúng', score],
                ['wrong',   'Câu sai',  questions.length - score],
              ].map(([val, label, count]) => (
                <button
                  key={val}
                  onClick={() => setResultFilter(val)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    resultFilter === val
                      ? val === 'correct'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : val === 'wrong'
                          ? 'border-error bg-error-bg/40 text-error'
                          : 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
                      : 'border-outline text-on-muted hover:border-tsubaki-red/50'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            <div className="space-y-4 mb-6">
              {questions.map((q, i) => {
                if (resultFilter === 'correct' && !graded[i]) return null;
                if (resultFilter === 'wrong'   &&  graded[i]) return null;
                return (
                  <div key={i} id={`result-q-${i}`} className="scroll-mt-24">
                    <ResultCard index={i} q={q} value={answers[i]} correct={graded[i]} />
                  </div>
                );
              })}
              {resultFilter === 'correct' && score === 0 && (
                <p className="text-center text-sm text-on-muted py-6">Không có câu nào đúng.</p>
              )}
              {resultFilter === 'wrong' && score === questions.length && (
                <p className="text-center text-sm text-on-muted py-6">Không có câu nào sai. Tuyệt vời!</p>
              )}
            </div>

            <button
              onClick={resetToConfig}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-3.5 hover:bg-tsubaki-red/5 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">replay</span>
              Làm lại
            </button>
          </div>

          {/* Bảng điều hướng câu ở kết quả: xanh = đúng, đỏ = sai */}
          <aside className="lg:sticky lg:top-24 glass-card rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-3">Bảng câu hỏi</p>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => jumpToResult(i, graded[i])}
                  title={`Câu ${i + 1} — ${graded[i] ? 'Đúng' : 'Sai'}`}
                  className={`h-9 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsubaki-red/40 ${
                    graded[i] ? 'bg-green-500' : 'bg-error'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-on-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />Đúng
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-error" />Sai
              </span>
            </div>
          </aside>
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

// ── Vòng điểm kết quả: cung xanh = phần đúng, nền đỏ = phần sai/chưa làm ──
function ScoreRing({ score, total }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-error" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className="stroke-green-500 transition-all duration-700"
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
        <span className={`material-symbols-outlined text-lg shrink-0 ${correct ? 'text-success' : 'text-error'}`}>
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
