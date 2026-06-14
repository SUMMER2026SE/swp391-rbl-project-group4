import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
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
  const [queue, setQueue]     = useState([]);   // hàng đợi thẻ trong phiên
  const [pos, setPos]         = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState({}); // { card_id: 'learning' | 'mastered' }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [trackProgress, setTrackProgress] = useState(false);
  const [frontSide, setFrontSide] = useState(() => localStorage.getItem(FRONT_KEY) || 'term');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Tải set + tiến độ ──
  useEffect(() => {
    (async () => {
      const [setRes, progRes] = await Promise.allSettled([
        api.get(`/flashcards/sets/${id}`),
        api.get(`/flashcards/sets/${id}/progress`),
      ]);
      // Lấy tiến độ trước để dựng hàng đợi loại bỏ thẻ đã thuộc (tiếp tục từ chỗ dở)
      const prog = progRes.status === 'fulfilled'
        ? (progRes.value.data.data || progRes.value.data || {})
        : {};
      setProgress(prog);
      if (setRes.status === 'fulfilled') {
        const data = setRes.value.data.data || setRes.value.data;
        const cards = data.cards || data.flashcards || [];
        setSet(data);
        setQueue(cards.filter(c => prog[c.id] !== 'mastered'));
      } else {
        setError(setRes.reason?.message || 'Không thể tải học phần.');
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => { localStorage.setItem(FRONT_KEY, frontSide); }, [frontSide]);

  const totalCards = set?.cards?.length ?? set?.flashcards?.length ?? queue.length;
  const masteredCount = useMemo(
    () => Object.values(progress).filter(s => s === 'mastered').length,
    [progress]
  );

  const current = queue[pos];

  // ── Điều hướng thường (không theo dõi) ──
  const go = (delta) => {
    setFlipped(false);
    setPos(p => Math.min(Math.max(p + delta, 0), queue.length - 1));
  };

  // ── Đánh dấu thuộc/chưa thuộc ──
  const mark = async (status) => {
    if (!current) return;
    const card = current;
    setProgress(p => ({ ...p, [card.id]: status }));

    // Cập nhật hàng đợi: bỏ thẻ hiện tại; nếu "chưa thuộc" thì đẩy về cuối
    const nq = queue.slice();
    nq.splice(pos, 1);
    if (status === 'learning') nq.push(card);
    setQueue(nq);
    setPos(nq.length === 0 ? 0 : pos % nq.length);
    setFlipped(false);

    try {
      await api.put(`/flashcards/sets/${id}/progress`, { card_id: card.id, status });
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Trộn thẻ ──
  const handleShuffle = () => {
    setQueue(q => shuffle(q));
    setPos(0);
    setFlipped(false);
  };

  // ── Khởi động lại ──
  const handleRestart = async () => {
    setSettingsOpen(false);
    const cards = set?.cards || set?.flashcards || [];
    setProgress({});
    setQueue(cards);
    setPos(0);
    setFlipped(false);
    try {
      await api.delete(`/flashcards/sets/${id}/progress`);
    } catch (e) {
      setError(e.message);
    }
  };

  // ── Phím tắt: Space lật thẻ, ←/→ chuyển thẻ ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue.length]);

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

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      {/* ── Quay lại ────────────────────────────────────────────── */}
      <Link to="/flashcards" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Trở về
      </Link>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate">{set?.title}</h1>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-tsubaki-red bg-tsubaki-red/10 px-3 py-1.5 rounded-full shrink-0">
          <span className="material-symbols-outlined text-lg fill">check_circle</span>
          Đã thuộc {masteredCount}/{totalCards}
        </span>
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
                          onChange={() => { setFrontSide(val); setFlipped(false); }}
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

      {/* ── Thẻ / hoàn thành ────────────────────────────────────── */}
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-2xl">
          <span className="material-symbols-outlined text-6xl text-tsubaki-red/30 mb-4">celebration</span>
          <p className="font-display text-lg font-bold text-on-surface mb-1">Tuyệt vời! Bạn đã thuộc hết thẻ</p>
          <p className="text-on-muted text-sm mb-5">Khởi động lại để ôn tập từ đầu</p>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-tsubaki-red rounded-xl px-6 py-3 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
            Khởi động lại thẻ
          </button>
        </div>
      ) : current ? (
        <>
          {/* Flip card */}
          <button
            onClick={() => setFlipped(f => !f)}
            className="w-full glass-card rounded-3xl min-h-[18rem] sm:min-h-[22rem] flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-tsubaki-red border-2 border-transparent transition-colors relative select-none"
          >
            {progress[current.id] && (
              <span className={`absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full ${
                progress[current.id] === 'mastered'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {progress[current.id] === 'mastered' ? 'Đã thuộc' : 'Chưa thuộc'}
              </span>
            )}
            <p className="font-display text-3xl sm:text-5xl font-bold text-on-surface leading-tight break-words">
              {flipped ? backContent(current) : frontContent(current)}
            </p>
            <span className="absolute bottom-4 inset-x-0 text-xs text-on-muted flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">touch_app</span>
              Chạm để lật
            </span>
          </button>

          {/* Điều hướng — khi theo dõi tiến độ: X/✓ thay cho ←/→ */}
          <div className="flex items-center justify-center gap-8 mt-6">
            {trackProgress ? (
              <>
                <button
                  onClick={() => mark('learning')}
                  title="Chưa thuộc"
                  className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-error/40 text-error hover:bg-error hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
                <span className="text-sm font-medium text-on-muted tabular-nums">{pos + 1}/{queue.length}</span>
                <button
                  onClick={() => mark('mastered')}
                  title="Đã thuộc"
                  className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-green-500/40 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-2xl">check</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => go(-1)}
                  disabled={pos === 0}
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-outline text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 disabled:hover:border-outline disabled:hover:text-on-muted transition-colors"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <span className="text-sm font-medium text-on-muted tabular-nums">{pos + 1}/{queue.length}</span>
                <button
                  onClick={() => go(1)}
                  disabled={pos >= queue.length - 1}
                  className="w-12 h-12 flex items-center justify-center rounded-full border border-outline text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 disabled:hover:border-outline disabled:hover:text-on-muted transition-colors"
                >
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </>
            )}
          </div>
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
