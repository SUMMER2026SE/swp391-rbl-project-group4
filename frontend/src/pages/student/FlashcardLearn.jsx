import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import SpeakButton from '../../components/dictionary/SpeakButton';
import FlashcardModeTabs from '../../components/flashcards/FlashcardModeTabs';
import api from '../../lib/api';
import { normalize, buildMcOptions } from '../../lib/flashcardQuiz';

const BATCH = 6;

export default function FlashcardLearn() {
  const { id } = useParams();

  const [set, setSet]         = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [progress, setProgress] = useState({}); // { card_id: 'learning' | 'mastered' }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // ── State phiên học ──
  const [sessionList, setSessionList]   = useState([]); // toàn bộ thẻ của lượt (cố định)
  const [pending, setPending]           = useState([]); // thẻ MỚI chưa đưa vào batch nào
  const [work, setWork]                 = useState([]); // câu hỏi của batch hiện tại (động — nối thêm khi lặp)
  const [batchCards, setBatchCards]     = useState([]); // các thẻ của batch hiện tại (cho summary)
  const [mcAtt, setMcAtt]               = useState({}); // cardId -> số lần đã hỏi trắc nghiệm
  const [wrAtt, setWrAtt]               = useState({}); // cardId -> số lần đã hỏi tự luận
  const [doneCount, setDoneCount]       = useState(0);  // số thẻ đã thuộc trong lượt (chỉ tăng)
  const [masteredIds, setMasteredIds]   = useState([]); // id thẻ đã thuộc trong lượt
  const [pos, setPos]             = useState(0);
  const [results, setResults]     = useState([]); // log câu trả lời của batch: [{card, type, correct}]
  const [roundOver, setRoundOver] = useState(false);
  const [sessionOver, setSessionOver] = useState(false);
  const [roundNum, setRoundNum]   = useState(0);  // số thứ tự đợt (batch) hiện tại

  // Trả lời câu hiện tại
  const [selected, setSelected]   = useState(null);   // lựa chọn MC
  const [input, setInput]         = useState('');     // ô tự luận
  const [answered, setAnswered]   = useState(null);   // null | { correct, correctAnswer }
  const composingRef = useRef(false);

  // ── Tải set + tiến độ, khởi tạo phiên ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [setRes, progRes] = await Promise.allSettled([
        api.get(`/flashcards/sets/${id}`),
        api.get(`/flashcards/sets/${id}/progress?mode=learn`),
      ]);
      const prog = progRes.status === 'fulfilled'
        ? (progRes.value.data.data || progRes.value.data || {})
        : {};
      if (setRes.status === 'fulfilled') {
        const data = setRes.value.data.data || setRes.value.data;
        const cards = data.cards || data.flashcards || [];
        setSet(data);
        setAllCards(cards);
        setProgress(prog);
        // Vào lại = học tiếp: chỉ học thẻ CHƯA thuộc (bỏ qua thẻ đã thuộc); distractors lấy từ toàn bộ thẻ
        startSession(cards.filter(c => prog[c.id] !== 'mastered'), cards);
      } else {
        setError(setRes.reason?.message || 'Không thể tải học phần.');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Dựng 1 câu hỏi cho thẻ theo dạng mong muốn ──
  // 'mc' → trắc nghiệm hướng ngẫu nhiên (cả 2 chiều); nếu set quá nhỏ (options<2) rơi về tự luận.
  // 'write' → tự luận: LUÔN định nghĩa → gõ từ (tiếng Nhật).
  const buildQuestion = (card, wantStage, cards) => {
    if (wantStage === 'mc') {
      const promptSide = Math.random() < 0.5 ? 'term' : 'definition';
      const answerSide = promptSide === 'term' ? 'definition' : 'term';
      const options = buildMcOptions(cards, card, answerSide, 3);
      if (options.length >= 2) {
        return { card, type: 'mc', options, promptSide, answerSide, correctAnswer: card[answerSide] };
      }
    }
    return { card, type: 'write', options: null, promptSide: 'definition', answerSide: 'term', correctAnswer: card.term };
  };

  // ── Bắt đầu 1 đợt (batch): lấy BATCH thẻ MỚI đầu pending, mỗi thẻ 1 câu trắc nghiệm ──
  const startBatch = (pendingList, distractorPool = allCards) => {
    const group = pendingList.slice(0, Math.min(BATCH, pendingList.length));
    if (!group.length) { setSessionOver(true); setWork([]); setBatchCards([]); return; }
    setWork(group.map(c => buildQuestion(c, 'mc', distractorPool)));
    setBatchCards(group);
    setPending(pendingList.slice(BATCH));
    setPos(0);
    setResults([]);
    setRoundOver(false);
    setSelected(null);
    setInput('');
    setAnswered(null);
    setRoundNum(n => n + 1);
  };

  // ── Khởi tạo/khởi động lại một lượt học (học toàn bộ cardList) ──
  // distractorPool: tập thẻ dùng để sinh đáp án nhiễu (nên là toàn bộ thẻ).
  const startSession = (cardList, distractorPool = cardList) => {
    setMcAtt({});
    setWrAtt({});
    setSessionList(cardList);
    setDoneCount(0);
    setMasteredIds([]);
    setSessionOver(false);
    setRoundNum(0);
    startBatch(cardList, distractorPool);
  };

  const q = work[pos];

  // ── Ghi nhận câu trả lời ──
  const record = (userAnswer, correct) => {
    setAnswered({ correct, correctAnswer: q.correctAnswer });
    setResults(r => [...r, {
      card: q.card, type: q.type, correct, userAnswer, correctAnswer: q.correctAnswer,
    }]);
  };

  const submitMc = (option) => {
    if (answered || !q) return;
    setSelected(option);
    record(option, normalize(option) === normalize(q.correctAnswer));
  };

  const submitWrite = () => {
    if (answered || !q || composingRef.current || !input.trim()) return;
    record(input, normalize(input) === normalize(q.correctAnswer));
  };

  // ── Sang câu kế: quyết định LẶP NGAY trong batch + đánh dấu thuộc khi tự luận đúng ──
  // mc: đúng HOẶC sai 2 lần → nối câu tự luận vào cuối batch; sai lần 1 → nối lại câu trắc nghiệm.
  // write: đúng → thuộc; sai lần 1 → nối lại câu tự luận; sai lần 2 → dừng thẻ (chưa thuộc).
  const proceed = async () => {
    if (!q) return;
    const cur = q;
    const cid = cur.card.id;
    const correct = answered?.correct;

    const newMc = { ...mcAtt };
    const newWr = { ...wrAtt };
    let pushed = null;
    let mastered = false;

    if (cur.type === 'mc') {
      newMc[cid] = (newMc[cid] || 0) + 1;
      pushed = buildQuestion(cur.card, (correct || newMc[cid] >= 2) ? 'write' : 'mc', allCards);
    } else { // write
      if (correct) mastered = true;
      else {
        newWr[cid] = (newWr[cid] || 0) + 1;
        if (newWr[cid] < 2) pushed = buildQuestion(cur.card, 'write', allCards);
      }
    }

    setMcAtt(newMc);
    setWrAtt(newWr);
    const newWork = pushed ? [...work, pushed] : work;
    if (pushed) setWork(newWork);

    setSelected(null);
    setInput('');
    setAnswered(null);

    if (pos + 1 >= newWork.length) setRoundOver(true); // hết batch → tổng kết
    else setPos(pos + 1);

    if (mastered) {
      setDoneCount(d => d + 1);
      setMasteredIds(ids => [...ids, cid]);
      setProgress(p => ({ ...p, [cid]: 'mastered' }));
      try {
        await api.put(`/flashcards/sets/${id}/progress`, { card_id: cid, status: 'mastered', mode: 'learn' });
      } catch (e) {
        setError(e.message);
      }
    }
  };

  // ── Tiếp tục sang batch thẻ MỚI (hết pending → hoàn thành lượt) ──
  const continueNext = () => {
    if (!pending.length) { setSessionOver(true); return; }
    startBatch(pending, allCards);
  };

  // ── Học lại từ đầu: XOÁ tiến độ chế độ Học trên DB (về 0) rồi học lại toàn bộ thẻ ──
  const restartAll = async () => {
    setProgress({});
    try {
      await api.delete(`/flashcards/sets/${id}/progress?mode=learn`);
    } catch (e) {
      setError(e.message);
    }
    startSession(allCards, allCards);
  };

  // ── Phím tắt: Enter xác nhận/sang câu; 1–4 chọn đáp án trắc nghiệm ──
  useEffect(() => {
    const onKey = (e) => {
      if (composingRef.current) return;
      const tag = e.target?.tagName;
      if (e.key === 'Enter') {
        if (answered) { e.preventDefault(); proceed(); }
        else if (q?.type === 'write' && tag !== 'TEXTAREA') { e.preventDefault(); submitWrite(); }
        return;
      }
      if (!answered && q?.type === 'mc' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx >= 0 && idx < q.options.length) { e.preventDefault(); submitMc(q.options[idx]); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, q, input, pos, work]);

  if (loading) {
    return (
      <StudentLayout title="Thẻ ghi nhớ">
        <div className="flex justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
        </div>
      </StudentLayout>
    );
  }

  const total = allCards.length;
  const sessionCards = sessionList.length;
  const masteredNow = allCards.filter(c => progress[c.id] === 'mastered').length; // theo DB
  const pct = total ? Math.round((masteredNow / total) * 100) : 0; // % tiến độ tổng học phần
  const estRounds = Math.ceil(sessionCards / BATCH); // mỗi đợt = BATCH thẻ
  const answerSide = q?.answerSide;
  const promptText = q ? q.card[q.promptSide] : '';
  const showSpeaker = q && q.promptSide === 'term'; // mặt hỏi là tiếng Nhật

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      <Link to="/flashcards" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Trở về
      </Link>

      <FlashcardModeTabs setId={id} active="learn" />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-1">Chế độ học</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate">{set?.title}</h1>
      </div>

      {/* Thanh tiến độ TỔNG của học phần (số thẻ đã thuộc / tổng) — kiểu Quizlet */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-1.5">
          <span>Tiến độ học phần</span>
          <span className="text-tsubaki-red text-sm">{pct}%</span>
        </div>
        <div className="w-full bg-surface-low rounded-full h-2.5">
          <div className="bg-tsubaki-red h-2.5 rounded-full transition-all"
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-on-muted mt-1.5">Đã thuộc {masteredNow}/{total} thẻ</p>
      </div>

      {/* Vị trí câu trong đợt hiện tại */}
      {!roundOver && !sessionOver && work.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] text-on-muted mb-2">
            Đợt {roundNum}/{estRounds} · Câu {Math.min(pos + 1, work.length)}/{work.length}
            <span className="ml-1">({q?.type === 'mc' ? 'trắc nghiệm' : 'tự luận'})</span>
          </p>
          <div className="flex gap-1">
            {work.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < pos ? 'bg-tsubaki-red' : i === pos ? 'bg-tsubaki-red/40' : 'bg-surface-low'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* ── Nội dung chính ─────────────────────────────────────── */}
      {sessionOver ? (() => {
        const notMastered = sessionList.filter(c => !masteredIds.includes(c.id));
        return (
          <div className="flex flex-col items-center justify-center py-16 text-center glass-card rounded-2xl px-6">
            <span className="material-symbols-outlined text-6xl text-tsubaki-red/30 mb-3">military_tech</span>
            <p className="font-display text-lg font-bold text-on-surface mb-1">
              {sessionCards === 0
                ? 'Bạn đã thuộc tất cả thẻ của học phần này!'
                : notMastered.length === 0 ? 'Tuyệt vời! Bạn đã thuộc hết lượt này.' : 'Hoàn thành lượt học!'}
            </p>
            <p className="text-sm text-on-muted mb-6">
              {sessionCards === 0
                ? 'Không còn thẻ nào để học. Bạn có thể học lại từ đầu.'
                : <>Đã thuộc {doneCount}/{sessionCards} thẻ trong lượt này.
                    {notMastered.length > 0 && ` Còn ${notMastered.length} thẻ chưa thuộc.`}</>}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {notMastered.length > 0 && (
                <button
                  onClick={() => startSession(notMastered, allCards)}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl px-6 py-3 hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Ôn {notMastered.length} thẻ chưa thuộc
                </button>
              )}
              <button
                onClick={restartAll}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl px-6 py-3 hover:bg-tsubaki-red/5 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">replay</span>
                Học lại từ đầu
              </button>
              <Link
                to="/flashcards"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-on-muted border border-outline/50 rounded-xl px-6 py-3 hover:bg-surface-low transition-colors"
              >
                <span className="material-symbols-outlined text-lg">grid_view</span>
                Về danh sách
              </Link>
            </div>
          </div>
        );
      })() : roundOver ? (
        <RoundSummary batchCards={batchCards} masteredIds={masteredIds} results={results}
          remaining={pending.length} onContinue={continueNext} />
      ) : q ? (
        <div className="max-w-2xl mx-auto">
          {/* Câu hỏi */}
          <div className="glass-card rounded-3xl p-8 mb-5 relative">
            {showSpeaker && <SpeakButton text={q.card.term} className="absolute top-4 left-4" />}
            <p className="text-xs font-semibold uppercase tracking-wide text-on-muted text-center mb-4">
              {q.type === 'mc' ? 'Chọn đáp án đúng' : 'Gõ từ vựng (tiếng Nhật)'}
            </p>
            <p className="font-display text-2xl sm:text-4xl font-bold text-on-surface text-center leading-tight break-words">
              {promptText}
            </p>
          </div>

          {/* Trả lời: trắc nghiệm */}
          {q.type === 'mc' ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                {q.options.map((opt, i) => {
                  const isCorrect = normalize(opt) === normalize(q.correctAnswer);
                  const isPicked  = selected === opt;
                  let cls = 'border-outline hover:border-tsubaki-red hover:bg-tsubaki-red/5';
                  let badge = 'bg-surface-low text-on-muted';
                  if (answered) {
                    if (isCorrect) { cls = 'border-green-500 bg-green-50 text-green-800'; badge = 'bg-green-500 text-white'; }
                    else if (isPicked) { cls = 'border-error bg-error-bg/40 text-error'; badge = 'bg-error text-white'; }
                    else cls = 'border-outline opacity-60';
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => submitMc(opt)}
                      disabled={!!answered}
                      className={`flex items-center gap-3 text-left px-4 py-4 rounded-2xl border-2 text-sm font-medium text-on-surface transition-colors break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsubaki-red/40 ${cls}`}
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${badge}`}>
                        {'ABCD'[i]}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {answered && isCorrect && <span className="material-symbols-outlined text-green-600 text-lg">check</span>}
                      {answered && isPicked && !isCorrect && <span className="material-symbols-outlined text-error text-lg">close</span>}
                    </button>
                  );
                })}
              </div>
              {!answered && (
                <p className="text-center text-xs text-on-muted mt-3">Mẹo: bấm phím 1–4 để chọn nhanh</p>
              )}
            </>
          ) : (
            <div>
              <input
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                onKeyDown={e => { if (e.key === 'Enter' && !composingRef.current && !answered) { e.preventDefault(); submitWrite(); } }}
                disabled={!!answered}
                placeholder={answerSide === 'term' ? 'Nhập từ vựng (tiếng Nhật)…' : 'Nhập định nghĩa…'}
                className="w-full px-5 py-4 bg-white border-2 border-outline rounded-2xl text-base outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all disabled:opacity-70"
              />
              {!answered && (
                <button
                  onClick={submitWrite}
                  disabled={!input.trim()}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Kiểm tra
                </button>
              )}
            </div>
          )}

          {/* Phản hồi */}
          {answered && (
            <div className="mt-5">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold ${
                answered.correct ? 'bg-green-50 text-green-700' : 'bg-error-bg/40 text-error'
              }`}>
                <span className="material-symbols-outlined">{answered.correct ? 'check_circle' : 'cancel'}</span>
                {answered.correct ? 'Chính xác!' : (
                  <span>Đáp án đúng: <span className="font-bold">{answered.correctAnswer}</span></span>
                )}
              </div>
              <button
                onClick={proceed}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3 hover:opacity-90 transition-opacity"
              >
                Tiếp tục
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-on-muted text-sm">Học phần này chưa có thẻ nào.</div>
      )}
    </StudentLayout>
  );
}

// ── Màn tổng kết cuối đợt (batch): 2 nhóm Đã thuộc / Chưa thuộc ──
function RoundSummary({ batchCards, masteredIds, results, remaining, onContinue }) {
  const correct = results.filter(r => r.correct).length;
  const mastered = batchCards.filter(c => masteredIds.includes(c.id));
  const notMastered = batchCards.filter(c => !masteredIds.includes(c.id));
  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-6 text-center mb-6">
        <span className="material-symbols-outlined text-5xl text-tsubaki-red/30 mb-2">flag</span>
        <p className="font-display text-lg font-bold text-on-surface mb-1">Hết đợt!</p>
        <p className="text-sm text-on-muted">
          Đúng {correct}/{results.length} câu · Thuộc {mastered.length}/{batchCards.length} thẻ trong đợt
        </p>
      </div>

      <div className="space-y-6 mb-6">
        <SummaryGroup title="Từ vựng đã thuộc" icon="check_circle" color="text-green-600" cards={mastered} />
        <SummaryGroup title="Từ vựng chưa thuộc" icon="hourglass_top" color="text-amber-600" cards={notMastered} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onContinue}
          className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl py-3.5 hover:opacity-90 transition-opacity"
        >
          {remaining > 0 ? 'Tiếp tục học' : 'Hoàn thành'}
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
        {remaining > 0 && (
          <Link
            to="/flashcards"
            className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-3.5 hover:bg-tsubaki-red/5 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            Lưu &amp; thoát
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Nhóm thẻ trong tổng kết (Đã thuộc / Chưa thuộc) ──
function SummaryGroup({ title, icon, color, cards }) {
  if (!cards.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
        <h2 className="font-display text-base font-bold text-on-surface">{title}</h2>
        <span className="text-sm text-on-muted">({cards.length})</span>
      </div>
      <div className="glass-card rounded-2xl divide-y divide-outline/20">
        {cards.map(c => (
          <div key={c.id} className="flex items-start gap-4 px-5 py-3">
            <span className="text-sm font-semibold text-on-surface flex-1 break-words whitespace-pre-wrap">{c.term}</span>
            <span className="w-px self-stretch bg-outline/30 shrink-0" />
            <span className="text-sm text-on-surface-variant flex-1 break-words whitespace-pre-wrap">{c.definition}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
