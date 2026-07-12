import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import UpgradeModal from '../../components/UpgradeModal';
import FlashcardModeTabs from '../../components/flashcards/FlashcardModeTabs';
import api from '../../lib/api';
import { normalize } from '../../lib/flashcardQuiz';

// 5 loại câu hỏi (mcq_reading/mcq_kanji cần thẻ có kanji)
const TYPE_OPTIONS = [
  { key: 'mcq_meaning', label: 'Trắc nghiệm nghĩa', desc: 'Chọn từ đúng theo nghĩa tiếng Việt', kanji: false },
  { key: 'mcq_reading', label: 'Chọn cách đọc',    desc: 'Chọn cách đọc đúng của từ có kanji',  kanji: true  },
  { key: 'mcq_kanji',   label: 'Chọn kanji',       desc: 'Chọn chữ kanji đúng theo cách đọc',   kanji: true  },
  { key: 'fill_blank',  label: 'Điền vào câu',      desc: 'Điền từ vào chỗ trống trong câu',      kanji: false },
  { key: 'written',     label: 'Tự luận',           desc: 'Gõ lại từ tiếng Nhật theo nghĩa',      kanji: false },
];
const TYPE_LABEL = {
  mcq_meaning: 'Trắc nghiệm nghĩa', mcq_reading: 'Cách đọc', mcq_kanji: 'Chọn kanji',
  fill_blank: 'Điền vào câu', written: 'Tự luận',
};
const hasKanji = (s) => /[一-鿿㐀-䶿]/.test(s || '');

// Cỡ chữ câu hỏi trong bài kiểm tra: vừa mắt, tự co theo độ dài (không quá to như trước)
const questionTextClass = (text) => {
  const s = text || '';
  const len = s.length;
  const multiline = s.includes('\n');
  let size;
  if (len <= 20)      size = 'text-lg sm:text-xl';
  else if (len <= 60) size = 'text-base sm:text-lg';
  else                size = 'text-sm sm:text-base';
  const align = (multiline || len > 40) ? 'text-left' : 'text-center';
  return `${size} ${align}`;
};

// Câu hỏi hợp lệ để làm bài (phòng test cũ/hỏng thiếu options → tránh crash trắng trang)
const isValidQuestions = (qs) =>
  Array.isArray(qs) && qs.length > 0 &&
  qs.every(q => q && q.type && (q.type === 'written' || Array.isArray(q.options)));

// Các bước hiển thị khi AI đang sinh đề (đổi chữ theo thời gian, không spinner trần)
const GEN_STEPS = [
  'Đang phân tích bộ từ vựng…',
  'Đang soạn câu hỏi…',
  'Đang kiểm tra & lọc đáp án…',
  'Sắp xong…',
];

export default function FlashcardTest() {
  const { id } = useParams();

  const [set, setSet]           = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [test, setTest]         = useState(null);   // bài kiểm tra đã lưu (DB) | null
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [stage, setStage] = useState('intro'); // 'intro' | 'generating' | 'doing' | 'result'

  // Cấu hình (popup)
  const [configOpen, setConfigOpen]         = useState(false);
  const [numQuestions, setNumQuestions]     = useState(20);
  const [selectedTypes, setSelectedTypes]   = useState(() => new Set());
  const [confirmRegen, setConfirmRegen]     = useState(false);

  // Sinh đề
  const [genStep, setGenStep]     = useState(0);
  const [quotaError, setQuotaError] = useState(null);

  // Bài làm
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Kết quả
  const [resultFilter, setResultFilter] = useState('all');

  const hasKanjiCard = allCards.some(c => hasKanji(c.term));

  // ── Tải set + bài kiểm tra đã lưu ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sRes, tRes] = await Promise.allSettled([
          api.get(`/flashcards/sets/${id}`),
          api.get(`/flashcards/sets/${id}/test`),
        ]);
        if (sRes.status === 'fulfilled') {
          const data  = sRes.value.data.data || sRes.value.data;
          const cards = data.cards || data.flashcards || [];
          setSet(data);
          setAllCards(cards);
          setNumQuestions(Math.min(20, cards.length || 1));
          // Mặc định chọn các loại khả dụng
          const kanji = cards.some(c => hasKanji(c.term));
          setSelectedTypes(new Set(
            TYPE_OPTIONS.filter(t => !t.kanji || kanji).map(t => t.key)
          ));
        } else {
          setError(sRes.reason?.message || 'Không thể tải học phần.');
        }
        if (tRes.status === 'fulfilled') {
          const t = tRes.value.data.data || tRes.value.data || null;
          // Test cũ/hỏng (thiếu options) → coi như chưa có bài, tránh trắng trang khi bấm Làm bài
          setTest(isValidQuestions(t?.questions) ? t : null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Đổi chữ bước sinh đề theo thời gian ──
  useEffect(() => {
    if (stage !== 'generating') return;
    setGenStep(0);
    const iv = setInterval(() => setGenStep(s => Math.min(s + 1, GEN_STEPS.length - 1)), 4500);
    return () => clearInterval(iv);
  }, [stage]);

  const toggleType = (key) => setSelectedTypes(prev => {
    const n = new Set(prev);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });

  // ── Vào làm bài với 1 bộ câu hỏi ──
  const beginDoing = (qs) => {
    if (!isValidQuestions(qs)) {
      setError('Bài kiểm tra không hợp lệ, vui lòng tạo lại.');
      setStage('intro');
      return;
    }
    setQuestions(qs);
    setAnswers(qs.map(() => null));
    setResultFilter('all');
    setStage('doing');
    window.scrollTo({ top: 0 });
  };

  // ── Gọi AI sinh đề ──
  const startGenerate = async () => {
    if (selectedTypes.size === 0) return;
    setConfigOpen(false);
    setError('');
    setStage('generating');
    try {
      const r = await api.post(`/flashcards/sets/${id}/test/generate`, {
        numQuestions,
        types: [...selectedTypes],
      });
      const t = r.data.data || r.data;
      setTest(t);
      beginDoing(t.questions);
    } catch (e) {
      if (e.status === 403 && e.data?.error === 'quota_exceeded') {
        setQuotaError(e.data);
      } else {
        setError(e.message);
      }
      setStage('intro');
    }
  };

  const setAnswer = (i, val) => setAnswers(a => { const n = a.slice(); n[i] = val; return n; });

  const isAnswered = (i) => answers[i] != null && String(answers[i]).trim() !== '';
  const answeredCount = answers.reduce((n, _, i) => n + (isAnswered(i) ? 1 : 0), 0);

  // ── Chấm điểm ──
  const gradeOne = (q, ans) => {
    if (ans == null) return false;
    if (q.type === 'written') {
      const accept = q.answersAccept?.length ? q.answersAccept : [q.answer];
      return accept.some(a => normalize(a) === normalize(ans));
    }
    return normalize(ans) === normalize(q.answer);
  };

  const submit = () => {
    if (answeredCount < questions.length) setConfirmSubmit(true);
    else finishTest();
  };
  const finishTest = () => {
    setConfirmSubmit(false);
    setStage('result');
    window.scrollTo({ top: 0 });
  };

  const jumpTo = (i) =>
    document.getElementById(`test-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const jumpToResult = (i, correct) => {
    const visible = resultFilter === 'all' || (resultFilter === 'correct') === correct;
    const scroll = () =>
      document.getElementById(`result-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (visible) scroll();
    else {
      setResultFilter('all');
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
      {/* ── Header ─────────────────────────────────────── */}
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

      {/* ── INTRO: chưa có / đã có bài kiểm tra ─────────── */}
      {stage === 'intro' && (
        <div className="max-w-lg mx-auto glass-card rounded-2xl p-8 sm:p-10 flex flex-col items-center text-center">
          {allCards.length === 0 ? (
            <>
              <span className="material-symbols-outlined text-5xl text-tsubaki-red/60 mb-3">quiz</span>
              <p className="text-sm text-on-muted">Học phần này chưa có thẻ nào để tạo bài kiểm tra.</p>
            </>
          ) : test ? (
            <>
              <span className="material-symbols-outlined text-5xl text-tsubaki-red/70 mb-3">assignment</span>
              <h2 className="font-display text-lg font-bold text-on-surface mb-1">Bài kiểm tra của bạn</h2>
              <p className="text-sm text-on-muted mb-4">
                {test.questions?.length || 0} câu · {(test.config?.types || []).map(t => TYPE_LABEL[t]).filter(Boolean).join(', ')}
              </p>
              <p className="text-xs text-on-muted mb-6">
                Tạo ngày {test.created_at ? new Date(test.created_at).toLocaleDateString('vi-VN') : '—'} · làm lại không giới hạn
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => beginDoing(test.questions)}
                  className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3 hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  Làm bài
                </button>
                <button
                  onClick={() => setConfirmRegen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-3 hover:bg-tsubaki-red/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Tạo bài mới
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-5xl text-tsubaki-red/60 mb-3">auto_awesome</span>
              <h2 className="font-display text-lg font-bold text-on-surface mb-1">Bài kiểm tra bằng AI</h2>
              <p className="text-sm text-on-muted mb-6">
                AI sẽ soạn bài kiểm tra đa dạng (trắc nghiệm, cách đọc, điền câu, tự luận…) từ nội dung học phần này.
              </p>
              <button
                onClick={() => setConfigOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl px-6 py-3 hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">tune</span>
                Thiết lập & tạo bài kiểm tra
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Popup thiết lập ─────────────────────────────── */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Thiết lập bài kiểm tra"
        size="md"
        footer={
          <button
            onClick={startGenerate}
            disabled={selectedTypes.size === 0}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            Tạo bài kiểm tra
          </button>
        }
      >
        <div className="space-y-6">
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
            {!hasKanjiCard && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3">
                <span className="material-symbols-outlined text-base">info</span>
                Học phần không có từ chứa kanji nên loại "Chọn cách đọc" và "Chọn kanji" bị tắt.
              </div>
            )}
            <div className="space-y-2">
              {TYPE_OPTIONS.map(opt => {
                const disabled = opt.kanji && !hasKanjiCard;
                const checked  = selectedTypes.has(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleType(opt.key)}
                    className={`w-full flex items-start gap-3 text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                      disabled
                        ? 'border-outline opacity-40 cursor-not-allowed'
                        : checked
                          ? 'border-tsubaki-red bg-tsubaki-red/5'
                          : 'border-outline hover:border-tsubaki-red/50'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg shrink-0 ${checked ? 'text-tsubaki-red' : 'text-on-muted'}`}>
                      {checked ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${checked ? 'text-tsubaki-red' : 'text-on-surface'}`}>{opt.label}</span>
                      <span className="block text-xs text-on-muted">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRegen}
        icon="auto_awesome"
        variant="primary"
        title="Tạo bài kiểm tra mới?"
        message="Bài kiểm tra hiện tại sẽ bị thay thế và bạn sẽ dùng 1 lượt tạo bằng AI trong ngày."
        confirmLabel="Tạo mới"
        cancelLabel="Hủy"
        onConfirm={() => { setConfirmRegen(false); setConfigOpen(true); }}
        onCancel={() => setConfirmRegen(false)}
      />

      {/* ── GENERATING ──────────────────────────────────── */}
      {stage === 'generating' && (
        <div className="max-w-lg mx-auto glass-card rounded-2xl p-10 flex flex-col items-center text-center">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl mb-4">progress_activity</span>
          <p className="font-display text-lg font-bold text-on-surface mb-1">{GEN_STEPS[genStep]}</p>
          <p className="text-sm text-on-muted">AI đang tạo bài kiểm tra, việc này có thể mất khoảng 10–30 giây.</p>
        </div>
      )}

      {/* ── DOING ───────────────────────────────────────── */}
      {stage === 'doing' && (
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] items-start">
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

      {/* ── RESULT ──────────────────────────────────────── */}
      {stage === 'result' && (
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] items-start">
          <div className="min-w-0">
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-4">Kết quả kiểm tra</p>
              <ScoreRing score={score} total={questions.length} />
              <p className="text-sm text-on-muted mt-3">Đúng {score}/{questions.length} câu</p>
            </div>

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

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => beginDoing(questions)}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">replay</span>
                Làm lại
              </button>
              <button
                onClick={() => setStage('intro')}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-3.5 hover:bg-tsubaki-red/5 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                Bài kiểm tra khác
              </button>
            </div>
          </div>

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

      <UpgradeModal quota={quotaError} onClose={() => setQuotaError(null)} />
    </StudentLayout>
  );
}

// ── Một câu hỏi khi đang làm bài ──
function QuestionCard({ index, q, value, onChange }) {
  const isChoice = q.type !== 'written';
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-md bg-surface-low flex items-center justify-center text-xs font-bold text-on-muted shrink-0">
          {index + 1}
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted">
          {TYPE_LABEL[q.type] || 'Câu hỏi'}
        </p>
      </div>

      <div className="max-h-[40vh] overflow-y-auto mb-4">
        <p className={`font-display font-semibold text-on-surface leading-snug break-words whitespace-pre-wrap ${questionTextClass(q.prompt)}`}>{q.prompt}</p>
      </div>

      {isChoice ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {(q.options || []).map((opt, i) => (
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
              <span className="flex-1 whitespace-pre-wrap">{opt}</span>
            </button>
          ))}
        </div>
      ) : (
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder="Nhập từ tiếng Nhật…"
          className="w-full px-4 py-3 bg-white border-2 border-outline rounded-xl text-base outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
        />
      )}
    </div>
  );
}

// ── Vòng điểm: cung xanh = phần đúng, nền đỏ = phần sai/chưa làm ──
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

  return (
    <div className={`rounded-2xl p-4 border-2 ${correct ? 'border-green-200 bg-green-50/50' : 'border-error/30 bg-error-bg/20'}`}>
      <div className="flex items-start gap-2">
        <span className={`material-symbols-outlined text-lg shrink-0 ${correct ? 'text-success' : 'text-error'}`}>
          {correct ? 'check_circle' : 'cancel'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-on-muted mb-1">Câu {index + 1} · {TYPE_LABEL[q.type] || ''}</p>
          <p className="text-sm font-semibold text-on-surface break-words whitespace-pre-wrap mb-2">{q.prompt}</p>
          <p className="text-sm break-words">
            <span className="text-on-muted">Bạn trả lời: </span>
            <span className={`whitespace-pre-wrap ${correct ? 'text-green-700 font-medium' : 'text-error font-medium'}`}>{userText}</span>
          </p>
          {!correct && (
            <p className="text-sm break-words">
              <span className="text-on-muted">Đáp án đúng: </span>
              <span className="text-green-700 font-medium whitespace-pre-wrap">{q.answer}</span>
            </p>
          )}
          {q.explanation && (
            <p className="text-xs text-on-muted mt-2 break-words whitespace-pre-wrap">
              <span className="material-symbols-outlined text-sm align-middle mr-1">lightbulb</span>
              {q.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
