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
  const [queue, setQueue]               = useState([]); // thẻ chưa kết thúc trong lượt, theo thứ tự
  const [sessionList, setSessionList]   = useState([]); // toàn bộ thẻ của lượt (cố định)
  const [stage, setStage]               = useState({}); // cardId -> 'mc' | 'write'
  const [mcAtt, setMcAtt]               = useState({}); // cardId -> số lần đã hỏi trắc nghiệm
  const [wrAtt, setWrAtt]               = useState({}); // cardId -> số lần đã hỏi tự luận
  const [doneCount, setDoneCount]       = useState(0);  // số thẻ đã thuộc trong lượt (chỉ tăng)
  const [masteredIds, setMasteredIds]   = useState([]); // id thẻ đã thuộc trong lượt
  const [answeredTotal, setAnsweredTotal] = useState(0);// tổng số câu đã trả lời
  const [questions, setQuestions] = useState([]); // câu hỏi của đợt hiện tại
  const [pos, setPos]             = useState(0);
  const [results, setResults]     = useState([]); // kết quả đợt: [{card, type, correct, userAnswer, correctAnswer}]
  const [roundOver, setRoundOver] = useState(false);
  const [sessionOver, setSessionOver] = useState(false);
  const [roundNum, setRoundNum]   = useState(0);  // số thứ tự đợt hiện tại

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
        api.get(`/flashcards/sets/${id}/progress`),
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
        startSession(cards);
      } else {
        setError(setRes.reason?.message || 'Không thể tải học phần.');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Dựng 1 câu hỏi cho thẻ theo stage hiện tại ──
  // Trắc nghiệm: hướng ngẫu nhiên (cả 2 chiều). Tự luận: LUÔN định nghĩa → gõ từ (tiếng Nhật).
  const buildQuestion = (card, stageMap, cards) => {
    const st = stageMap[card.id] || 'mc';
    if (st === 'mc') {
      const promptSide = Math.random() < 0.5 ? 'term' : 'definition';
      const answerSide = promptSide === 'term' ? 'definition' : 'term';
      const options = buildMcOptions(cards, card, answerSide, 3);
      if (options.length >= 2) {
        return { card, type: 'mc', options, promptSide, answerSide, correctAnswer: card[answerSide] };
      }
      // set quá nhỏ để làm trắc nghiệm → rơi về tự luận
    }
    // Tự luận: hỏi định nghĩa, gõ từ vựng
    return { card, type: 'write', options: null, promptSide: 'definition', answerSide: 'term', correctAnswer: card.term };
  };

  // ── Bắt đầu 1 đợt (round): lấy BATCH thẻ ĐẦU queue (tuần tự, không random) ──
  const startRound = (currentQueue, stageMap, cards) => {
    if (!currentQueue.length) { setSessionOver(true); setQuestions([]); return; }
    const batch = currentQueue.slice(0, Math.min(BATCH, currentQueue.length));
    setQuestions(batch.map(c => buildQuestion(c, stageMap, cards)));
    setPos(0);
    setResults([]);
    setRoundOver(false);
    setSelected(null);
    setInput('');
    setAnswered(null);
    setRoundNum(n => n + 1);
  };

  // ── Khởi tạo/khởi động lại một lượt học (học toàn bộ cardList) ──
  // distractorPool: tập thẻ dùng để sinh đáp án nhiễu (mặc định = cardList; nên là toàn bộ thẻ).
  const startSession = (cardList, distractorPool = cardList) => {
    setStage({});
    setMcAtt({});
    setWrAtt({});
    setQueue(cardList);
    setSessionList(cardList);
    setDoneCount(0);
    setMasteredIds([]);
    setAnsweredTotal(0);
    setSessionOver(false);
    setRoundNum(0);
    startRound(cardList, {}, distractorPool);
  };

  const q = questions[pos];

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

  // ── Sang câu kế / kết đợt ──
  const proceed = () => {
    setSelected(null);
    setInput('');
    setAnswered(null);
    if (pos + 1 >= questions.length) finishRound();
    else setPos(pos + 1);
  };

  // ── Xử lý cuối đợt: vòng đời thẻ có giới hạn ──
  // mc: đúng HOẶC sai 2 lần → lên tự luận; sai lần 1 → còn trắc nghiệm.
  // write: đúng → thuộc (bỏ khỏi queue); sai lần 1 → hỏi lại tự luận; sai lần 2 → bỏ (chưa thuộc).
  const finishRound = async () => {
    const newStage = { ...stage };
    const newMc = { ...mcAtt };
    const newWr = { ...wrAtt };
    const mastered = [];   // thẻ vừa thuộc trong đợt
    const finished = new Set(); // thẻ kết thúc (thuộc hoặc hết lượt) → rời queue

    results.forEach(res => {
      const cid = res.card.id;
      if (res.type === 'mc') {
        newMc[cid] = (newMc[cid] || 0) + 1;
        if (res.correct || newMc[cid] >= 2) newStage[cid] = 'write'; // lên tự luận
        else newStage[cid] = 'mc';                                    // sai lần 1 → còn trắc nghiệm
      } else { // write
        if (res.correct) { mastered.push(res.card); finished.add(cid); }
        else {
          newWr[cid] = (newWr[cid] || 0) + 1;
          if (newWr[cid] >= 2) finished.add(cid);                     // sai 2 lần → bỏ (chưa thuộc)
          else newStage[cid] = 'write';                               // sai lần 1 → hỏi lại tự luận
        }
      }
    });

    // Dựng lại queue: thẻ chưa hỏi ở đợt này giữ nguyên thứ tự, thẻ vừa hỏi (chưa kết thúc) dồn về cuối
    const roundIds = new Set(results.map(r => r.card.id));
    const rest = queue.filter(c => !roundIds.has(c.id));
    const stillActive = results.map(r => r.card).filter(c => !finished.has(c.id));
    const newQueue = [...rest, ...stillActive];

    setStage(newStage);
    setMcAtt(newMc);
    setWrAtt(newWr);
    setQueue(newQueue);
    setAnsweredTotal(t => t + results.length);
    setRoundOver(true);

    if (mastered.length) {
      setDoneCount(d => d + mastered.length);
      setMasteredIds(ids => [...ids, ...mastered.map(c => c.id)]);
      setProgress(p => {
        const next = { ...p };
        mastered.forEach(c => { next[c.id] = 'mastered'; });
        return next;
      });
      try {
        await Promise.all(mastered.map(c =>
          api.put(`/flashcards/sets/${id}/progress`, { card_id: c.id, status: 'mastered' })
        ));
      } catch (e) {
        setError(e.message);
      }
    }
  };

  // ── Tiếp tục đợt kế (hết queue → hoàn thành lượt) ──
  const continueNext = () => {
    if (!queue.length) { setSessionOver(true); return; }
    startRound(queue, stage, allCards);
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
  }, [answered, q, input, pos, questions]);

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
  const estTotal = sessionCards * 2;
  const estRounds = Math.ceil(estTotal / BATCH);
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
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-1">Chế độ học</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate">{set?.title}</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-tsubaki-red bg-tsubaki-red/10 px-3 py-1.5 rounded-full shrink-0">
          <span className="material-symbols-outlined text-lg fill">check_circle</span>
          Đã thuộc {masteredNow}/{total}
        </span>
      </div>

      {/* Tiến độ lượt học (tiến-thẳng) + đợt hiện tại */}
      {!roundOver && !sessionOver && questions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-1.5">
            <span>Lượt học · ~{estTotal} câu · ~{estRounds} đợt</span>
            <span className="text-tsubaki-red">Đã thuộc {doneCount}/{sessionCards} thẻ</span>
          </div>
          <div className="w-full bg-surface-low rounded-full h-2 mb-4">
            <div className="bg-tsubaki-red h-2 rounded-full transition-all"
              style={{ width: `${sessionCards ? (doneCount / sessionCards) * 100 : 0}%` }} />
          </div>
          <p className="text-[11px] text-on-muted mb-2">
            Đợt {roundNum} · Câu {Math.min(pos + 1, questions.length)}/{questions.length}
            <span className="ml-1">({q?.type === 'mc' ? 'trắc nghiệm' : 'tự luận'})</span>
          </p>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < results.length ? 'bg-tsubaki-red' : i === pos ? 'bg-tsubaki-red/40' : 'bg-surface-low'
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
              {notMastered.length === 0 ? 'Tuyệt vời! Bạn đã thuộc hết lượt này.' : 'Hoàn thành lượt học!'}
            </p>
            <p className="text-sm text-on-muted mb-6">
              Đã thuộc {doneCount}/{sessionCards} thẻ trong lượt này.
              {notMastered.length > 0 && ` Còn ${notMastered.length} thẻ chưa thuộc.`}
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
                onClick={() => startSession(allCards)}
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
        <RoundSummary results={results} doneCount={doneCount} sessionCards={sessionCards}
          remaining={queue.length} onContinue={continueNext} />
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

// ── Màn tổng kết cuối đợt ──
function RoundSummary({ results, doneCount, sessionCards, remaining, onContinue }) {
  const correct = results.filter(r => r.correct).length;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-6 text-center mb-6">
        <span className="material-symbols-outlined text-5xl text-tsubaki-red/30 mb-2">flag</span>
        <p className="font-display text-lg font-bold text-on-surface mb-1">Hết đợt!</p>
        <p className="text-sm text-on-muted">
          Đúng {correct}/{results.length} câu · Đã thuộc {doneCount}/{sessionCards} thẻ
        </p>
      </div>

      <div className="glass-card rounded-2xl divide-y divide-outline/20 mb-6">
        {results.map((r, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-3">
            <span className={`material-symbols-outlined text-lg shrink-0 ${r.correct ? 'text-green-600' : 'text-error'}`}>
              {r.correct ? 'check_circle' : 'cancel'}
            </span>
            <span className="text-sm font-semibold text-on-surface flex-1 break-words">{r.card.term}</span>
            <span className="w-px self-stretch bg-outline/30 shrink-0" />
            <span className="text-sm text-on-surface-variant flex-1 break-words">{r.card.definition}</span>
          </div>
        ))}
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
