import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import SpeakButton from '../../components/dictionary/SpeakButton';
import FlashcardModeTabs from '../../components/flashcards/FlashcardModeTabs';
import api from '../../lib/api';

const FRONT_KEY = 'flashcard.frontSide';
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function FlashcardStudy() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [set, setSet]         = useState(null);
  const [deck, setDeck]       = useState([]);   // bộ thẻ của lượt học hiện tại (tuần tự)
  const [pos, setPos]         = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState({}); // { card_id: 'learning' | 'mastered' }
  const [history, setHistory] = useState([]);   // ngăn xếp Hoàn tác: [{ cardId, prevStatus }]
  const [done, setDone]       = useState(false); // đã đi hết lượt → màn kết quả
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [trackProgress, setTrackProgress] = useState(false);
  const [frontSide, setFrontSide] = useState(() => localStorage.getItem(FRONT_KEY) || 'term');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noAnim, setNoAnim] = useState(false);

  // Đổi thẻ: đưa về mặt trước tức thời (tắt transition 1 nhịp để không xoay ngược thô)
  const resetFlip = () => {
    setNoAnim(true);
    setFlipped(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setNoAnim(false)));
  };

  // ── Tải set + tiến độ ──
  useEffect(() => {
    (async () => {
      const [setRes, progRes] = await Promise.allSettled([
        api.get(`/flashcards/sets/${id}`),
        api.get(`/flashcards/sets/${id}/progress`),
      ]);
      const prog = progRes.status === 'fulfilled'
        ? (progRes.value.data.data || progRes.value.data || {})
        : {};
      setProgress(prog);
      if (setRes.status === 'fulfilled') {
        const data = setRes.value.data.data || setRes.value.data;
        const cards = data.cards || data.flashcards || [];
        setSet(data);
        setDeck(cards); // nạp toàn bộ thẻ → bộ đếm luôn 1/N … N/N
      } else {
        setError(setRes.reason?.message || 'Không thể tải học phần.');
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => { localStorage.setItem(FRONT_KEY, frontSide); }, [frontSide]);

  const totalCards = set?.cards?.length ?? set?.flashcards?.length ?? deck.length;
  const masteredCount = useMemo(
    () => Object.values(progress).filter(s => s === 'mastered').length,
    [progress]
  );

  const current = deck[pos];

  // ── Điều hướng thường (chế độ xem lướt — không đánh dấu) ──
  const go = (delta) => {
    if (done) return;
    resetFlip();
    setPos(p => Math.min(Math.max(p + delta, 0), deck.length - 1));
  };

  // ── Đánh dấu thuộc/chưa thuộc rồi sang thẻ kế (tuần tự) ──
  const answer = async (status) => {
    if (done || !current) return;
    const card = current;
    setHistory(h => [...h, { cardId: card.id, prevStatus: progress[card.id] }]);
    setProgress(p => ({ ...p, [card.id]: status }));
    resetFlip();
    if (pos >= deck.length - 1) setDone(true); // thẻ cuối → màn kết quả
    else setPos(pos + 1);

    try {
      await api.put(`/flashcards/sets/${id}/progress`, { card_id: card.id, status });
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Hoàn tác: lùi về thẻ trước + khôi phục trạng thái thẻ đó ──
  const handleUndo = async () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    if (done) { setDone(false); setPos(deck.length - 1); }
    else setPos(p => Math.max(p - 1, 0));
    resetFlip();

    setProgress(p => {
      const next = { ...p };
      if (last.prevStatus === undefined) delete next[last.cardId];
      else next[last.cardId] = last.prevStatus;
      return next;
    });

    try {
      if (last.prevStatus === undefined) {
        await api.delete(`/flashcards/sets/${id}/progress/${last.cardId}`);
      } else {
        await api.put(`/flashcards/sets/${id}/progress`, { card_id: last.cardId, status: last.prevStatus });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Trộn thẻ ──
  const handleShuffle = () => {
    setDeck(d => shuffle(d));
    setPos(0);
    resetFlip();
    setDone(false);
    setHistory([]);
  };

  // ── Khởi động lại (xóa tiến độ trên DB) ──
  const handleRestart = async () => {
    setSettingsOpen(false);
    const cards = set?.cards || set?.flashcards || [];
    setProgress({});
    setDeck(cards);
    setPos(0);
    resetFlip();
    setDone(false);
    setHistory([]);
    try {
      await api.delete(`/flashcards/sets/${id}/progress`);
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Cuối lượt: ôn lại thẻ chưa thuộc (giữ nguyên tiến độ DB) ──
  const reviewLearning = () => {
    setDeck(d => d.filter(c => progress[c.id] === 'learning'));
    setPos(0);
    resetFlip();
    setDone(false);
    setHistory([]);
  };

  // ── Cuối lượt: học lại toàn bộ set từ đầu (giữ nguyên tiến độ DB) ──
  const restartRound = () => {
    const cards = set?.cards || set?.flashcards || [];
    setDeck(cards);
    setPos(0);
    resetFlip();
    setDone(false);
    setHistory([]);
  };

  // ── Phím tắt: Space lật thẻ; ←/→ tùy chế độ ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); trackProgress ? answer('mastered') : go(1); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); trackProgress ? answer('learning') : go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deck, pos, trackProgress, done, progress]);

  if (loading) {
    return (
      <StudentLayout title="Thẻ ghi nhớ">
        <div className="flex justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
        </div>
      </StudentLayout>
    );
  }

  const frontContent = (c) => (frontSide === 'term' ? c.term : c.definition);
  const backContent  = (c) => (frontSide === 'term' ? c.definition : c.term);

  // Toàn bộ thẻ của set (cho danh sách phân nhóm phía dưới)
  const allCards      = set?.cards || set?.flashcards || [];
  const masteredCards = allCards.filter(c => progress[c.id] === 'mastered');
  const learningCards = allCards.filter(c => progress[c.id] !== 'mastered');

  // Kết quả lượt học hiện tại (đếm trên deck theo trạng thái mới nhất)
  const roundMastered = deck.filter(c => progress[c.id] === 'mastered').length;
  const roundLearning = deck.filter(c => progress[c.id] === 'learning').length;

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      {/* ── Quay lại ────────────────────────────────────────────── */}
      <Link to="/flashcards" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Trở về
      </Link>

      <FlashcardModeTabs setId={id} active="cards" />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-1">Chế độ thẻ ghi nhớ</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate">{set?.title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-tsubaki-red leading-tight">Đã thuộc</p>
            <p className="text-xs text-on-muted">{masteredCount}/{totalCards} thẻ</p>
          </div>
          <ProgressRing value={masteredCount} total={totalCards} />
        </div>
      </div>

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          onClick={() => setTrackProgress(t => !t)}
          className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
        >
          <span className={`relative w-10 h-6 rounded-full transition-colors ${trackProgress ? 'bg-tsubaki-red' : 'bg-outline'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${trackProgress ? 'translate-x-4' : ''}`} />
          </span>
          <span className={trackProgress ? 'text-tsubaki-red' : 'text-on-muted'}>Theo dõi tiến độ</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-on-muted hover:text-tsubaki-red px-3 py-2 rounded-xl hover:bg-surface-low transition-colors"
          >
            <span className="material-symbols-outlined text-lg">shuffle</span>
            Trộn thẻ
          </button>
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-on-muted hover:text-tsubaki-red hover:bg-surface-low transition-colors"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-outline/30 z-20 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-muted mb-2">Mặt trước</p>
                  <div className="flex flex-col gap-2 mb-4">
                    {[['term', 'Từ vựng'], ['definition', 'Định nghĩa']].map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="frontSide"
                          checked={frontSide === val}
                          onChange={() => { setFrontSide(val); resetFlip(); }}
                          className="accent-tsubaki-red"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleRestart}
                    className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-2.5 hover:bg-tsubaki-red/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">restart_alt</span>
                    Khởi động lại thẻ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Thẻ / kết quả ───────────────────────────────────────── */}
      {done ? (
        <div className="flex flex-col items-center justify-center py-16 text-center glass-card rounded-2xl px-6">
          <span className="material-symbols-outlined text-6xl text-tsubaki-red/30 mb-3">celebration</span>
          <p className="font-display text-lg font-bold text-on-surface mb-1">Hoàn thành lượt học!</p>
          <div className="flex items-center gap-8 my-5">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{roundMastered}</p>
              <p className="text-xs text-on-muted">Đã thuộc</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">{roundLearning}</p>
              <p className="text-xs text-on-muted">Chưa thuộc</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {roundLearning > 0 && (
              <button
                onClick={reviewLearning}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl px-6 py-3 hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                Ôn lại thẻ chưa thuộc ({roundLearning})
              </button>
            )}
            <button
              onClick={restartRound}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl px-6 py-3 hover:bg-tsubaki-red/5 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">replay</span>
              Học lại từ đầu
            </button>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleUndo}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-on-muted hover:text-tsubaki-red px-3 py-2 rounded-xl hover:bg-surface-low transition-colors"
            >
              <span className="material-symbols-outlined text-lg">undo</span>
              Hoàn tác
            </button>
          )}
        </div>
      ) : current ? (
        <>
          {/* Flip card 3D */}
          <div className="relative max-w-3xl mx-auto">
            {(flipped ? frontSide !== 'term' : frontSide === 'term') && (
              <span className="absolute top-4 left-4 z-20" onClick={e => e.stopPropagation()}>
                <SpeakButton text={current.term} />
              </span>
            )}
            {progress[current.id] && (
              <span className={`absolute top-4 right-4 z-20 text-xs font-bold px-2.5 py-1 rounded-full ${
                progress[current.id] === 'mastered'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {progress[current.id] === 'mastered' ? 'Đã thuộc' : 'Chưa thuộc'}
              </span>
            )}
            <div
              onClick={() => setFlipped(f => !f)}
              className={`fc-flip h-72 sm:h-96 cursor-pointer select-none ${flipped ? 'is-flipped' : ''} ${noAnim ? 'no-anim' : ''}`}
            >
              <div className="fc-flip-inner">
                {/* Mặt trước */}
                <div className="fc-face">
                  <div className="glass-card rounded-3xl w-full h-full flex flex-col items-center justify-center p-8 text-center border-2 border-transparent hover:border-tsubaki-red/60 transition-colors">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-muted mb-4">
                      {frontSide === 'term' ? 'Từ vựng' : 'Định nghĩa'}
                    </p>
                    <p className="font-display text-3xl sm:text-5xl font-bold text-on-surface leading-tight break-words">
                      {frontContent(current)}
                    </p>
                    <span className="absolute bottom-4 inset-x-0 text-xs text-on-muted flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">touch_app</span>
                      Chạm để lật
                    </span>
                  </div>
                </div>
                {/* Mặt sau */}
                <div className="fc-face fc-back">
                  <div className="glass-card rounded-3xl w-full h-full flex flex-col items-center justify-center p-8 text-center border-2 border-tsubaki-red/30">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tsubaki-red/70 mb-4">
                      {frontSide === 'term' ? 'Định nghĩa' : 'Từ vựng'}
                    </p>
                    <p className="font-display text-3xl sm:text-5xl font-bold text-on-surface leading-tight break-words">
                      {backContent(current)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Điều hướng — khi theo dõi tiến độ: X (chưa thuộc) / ✓ (đã thuộc) + Hoàn tác */}
          {trackProgress ? (
            <>
              <div className="flex items-center justify-center gap-8 mt-6">
                <button
                  onClick={() => answer('learning')}
                  title="Chưa thuộc"
                  className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-error/40 text-error hover:bg-error hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
                <span className="text-sm font-medium text-on-muted tabular-nums">{pos + 1}/{deck.length}</span>
                <button
                  onClick={() => answer('mastered')}
                  title="Đã thuộc"
                  className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-green-500/40 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">check</span>
                </button>
              </div>
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleUndo}
                  disabled={!history.length}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-on-muted hover:text-tsubaki-red disabled:opacity-30 disabled:hover:text-on-muted px-3 py-2 rounded-xl hover:bg-surface-low transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">undo</span>
                  Hoàn tác
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-8 mt-6">
              <button
                onClick={() => go(-1)}
                disabled={pos === 0}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-outline text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 disabled:hover:border-outline disabled:hover:text-on-muted transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <span className="text-sm font-medium text-on-muted tabular-nums">{pos + 1}/{deck.length}</span>
              <button
                onClick={() => go(1)}
                disabled={pos >= deck.length - 1}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-outline text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 disabled:hover:border-outline disabled:hover:text-on-muted transition-colors"
              >
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          )}
        </>
      ) : null}

      {/* ── Danh sách toàn bộ thẻ, phân theo trạng thái ─────────── */}
      {allCards.length > 0 && (
        <div className="mt-12 space-y-8">
          <CardGroup
            title="Đang học"
            icon="hourglass_top"
            color="text-amber-600"
            cards={learningCards}
          />
          <CardGroup
            title="Đã thuộc"
            icon="check_circle"
            color="text-green-600"
            cards={masteredCards}
          />
        </div>
      )}
    </StudentLayout>
  );
}

// ── Vòng tiến độ tròn (SVG) ──
function ProgressRing({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-surface-low" />
        <circle
          cx="24" cy="24" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className="stroke-tsubaki-red transition-all duration-500"
          strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-tsubaki-red">
        {pct}%
      </span>
    </div>
  );
}

// ── Nhóm thẻ (Đang học / Đã thuộc) ──
function CardGroup({ title, icon, color, cards }) {
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
