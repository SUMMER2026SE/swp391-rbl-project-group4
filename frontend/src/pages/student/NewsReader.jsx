import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import FuriganaText from '../../components/ui/FuriganaText';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import WordLookupPopup from '../../components/news/WordLookupPopup';
import api from '../../lib/api';

const FONT_STEPS = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

const LEVEL_DOT = {
  N5: 'bg-green-500', N4: 'bg-blue-500', N3: 'bg-yellow-500', N2: 'bg-orange-500', N1: 'bg-red-600',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function NewsReader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [quotaBlock, setQuotaBlock] = useState(null);  // set khi hết lượt đọc miễn phí

  // Toolbar state
  const [furiganaOn, setFuriganaOn]       = useState(true);
  const [translationOn, setTranslationOn] = useState(false);
  const [fontIdx, setFontIdx]             = useState(1);
  const [chatOpen, setChatOpen]           = useState(false);   // chỉ dùng cho drawer mobile

  const readRef = useRef(null);   // vùng đọc — để bắt selection cho popup tra từ
  const chat = useArticleChat(article);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setQuotaBlock(null);
    api.get(`/news/${id}`)
      .then(r => { if (active) setArticle(r.data); })
      .catch(e => {
        if (!active) return;
        if (e.status === 403 && e.data?.error === 'quota_exceeded') setQuotaBlock(e.data);
        else setError(e.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  // Hỏi AI về 1 từ (từ popup tra từ khi không có trong từ điển)
  const askAboutWord = (word) => {
    chat.setInput(`Từ「${word}」trong bài này nghĩa là gì và dùng như thế nào?`);
    setChatOpen(true);   // mở drawer trên mobile; desktop panel luôn hiện sẵn
  };

  const fontClass = FONT_STEPS[fontIdx];
  const segments = article?.segments || [];

  return (
    <StudentLayout title="Luyện đọc báo">
      {/* ── Back ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/news')}
        className="inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-5"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Quay lại danh sách
      </button>

      {error && <Alert type="error">{error}</Alert>}

      {quotaBlock ? (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-3xl text-amber-500">workspace_premium</span>
          </div>
          <h2 className="font-display text-xl font-bold text-on-surface mb-2">Đã hết lượt đọc miễn phí hôm nay</h2>
          <p className="text-on-muted text-sm mb-1">
            Bạn đã đọc hết <strong>{quotaBlock.used}/{quotaBlock.limit}</strong> bài mới trong ngày.
          </p>
          <p className="text-on-muted text-sm mb-6">{quotaBlock.resetInfo} Bài đã đọc trước đó vẫn xem lại được bình thường.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/news')}
              className="px-5 py-2.5 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low transition-colors">
              Quay lại danh sách
            </button>
            {quotaBlock.upgradeRequired && (
              <button onClick={() => navigate('/subscription')}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-colors">
                Nâng cấp Premium
              </button>
            )}
          </div>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-7 bg-surface-container rounded-full w-2/3" />
          <div className="h-4 bg-surface-container rounded-full w-1/3" />
          <div className="h-40 bg-surface-container rounded-2xl" />
        </div>
      ) : article && (
        <div className="lg:flex lg:gap-6 lg:items-start">
          {/* ── Cột đọc ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 max-w-3xl">
            {/* Header */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                {article.level && (
                  <span className="bg-tsubaki-red text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-bold">
                    <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[article.level] || 'bg-white'}`} />
                    {article.level}
                  </span>
                )}
                {article.source && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-muted bg-surface-low px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-sm">newspaper</span>
                    {article.source_url
                      ? <a href={article.source_url} target="_blank" rel="noreferrer" className="hover:text-tsubaki-red hover:underline">{article.source}</a>
                      : article.source}
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface leading-snug mb-1">
                {article.title}
              </h1>
              {article.title_vi && <p className="text-tsubaki-red/80 font-medium">{article.title_vi}</p>}

              {/* Meta: người đăng • ngày đăng • lượt xem */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-on-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">person</span>
                  {article.author_name || 'Quản trị viên'}
                </span>
                {article.published_at && (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    {formatDate(article.published_at)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  {article.view_count ?? 0} lượt xem
                </span>
              </div>

              {/* Ảnh bài báo */}
              {article.thumbnail_url && (
                <img
                  src={article.thumbnail_url}
                  alt={article.title}
                  className="w-full max-h-72 object-cover rounded-2xl mt-4"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>

            {/* Toolbar (sticky) */}
            <div className="sticky top-16 z-20 -mx-2 px-2 py-3 mb-6 bg-surface/80 backdrop-blur-md border-b border-outline/30 flex flex-wrap items-center gap-2">
              {/* Font size */}
              <div className="flex items-center gap-1 bg-white border border-outline rounded-xl px-1.5 py-1">
                <span className="material-symbols-outlined text-on-muted text-lg px-1">format_size</span>
                <button
                  onClick={() => setFontIdx(i => Math.max(0, i - 1))}
                  disabled={fontIdx === 0}
                  className="w-7 h-7 rounded-lg hover:bg-surface-low text-charcoal-text disabled:opacity-30 transition-colors"
                  title="Giảm cỡ chữ"
                >−</button>
                <button
                  onClick={() => setFontIdx(i => Math.min(FONT_STEPS.length - 1, i + 1))}
                  disabled={fontIdx === FONT_STEPS.length - 1}
                  className="w-7 h-7 rounded-lg hover:bg-surface-low text-charcoal-text disabled:opacity-30 transition-colors"
                  title="Tăng cỡ chữ"
                >+</button>
              </div>

              {/* Furigana + Bản dịch — chỉ có tác dụng khi bài đã tách câu (segments) */}
              {segments.length > 0 && (
                <>
                  <button
                    onClick={() => setFuriganaOn(v => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      furiganaOn
                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : 'bg-white border-outline text-on-muted hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    <span style={{ fontFamily: 'serif' }}>あ</span>
                    Furigana
                  </button>

                  <button
                    onClick={() => setTranslationOn(v => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      translationOn
                        ? 'bg-tsubaki-red/10 border-tsubaki-red/30 text-tsubaki-red'
                        : 'bg-white border-outline text-on-muted hover:border-tsubaki-red/40 hover:text-tsubaki-red'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">translate</span>
                    Bản dịch
                  </button>
                </>
              )}

              {/* AI — chỉ hiện ở mobile (desktop đã có panel cố định bên phải) */}
              <button
                onClick={() => setChatOpen(true)}
                className="lg:hidden ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-sumire-purple text-white hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined text-lg">smart_toy</span>
                Trợ lý AI
              </button>
            </div>

            {/* Reading area (bôi đen / double-click 1 từ để tra từ điển) */}
            <div ref={readRef}>
              {segments.length === 0 ? (
                <p className={`${fontClass} leading-loose whitespace-pre-line text-on-surface`}>
                  {article.content || 'Bài đọc chưa có nội dung.'}
                </p>
              ) : (
                <div className="space-y-5">
                  {segments.map((seg, i) => (
                    <div key={i} className="group">
                      {furiganaOn
                        ? <FuriganaText html={seg.furigana} enabled={true} textClassName={`${fontClass} text-on-surface`} />
                        : <p className={`${fontClass} leading-loose text-on-surface`}>{seg.jp}</p>}
                      {translationOn && seg.vi && (
                        <p className="mt-1.5 text-sm text-on-muted leading-relaxed border-l-2 border-outline pl-3">
                          {seg.vi}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-on-muted/70 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">touch_app</span>
              Mẹo: bôi đen hoặc nhấp đúp vào một từ để tra nghĩa nhanh.
            </p>

            {/* Quiz đọc hiểu */}
            {article.questions?.length > 0 && <QuizSection questions={article.questions} />}

            {/* Từ vựng trong bài */}
            {article.vocab?.length > 0 && (
              <VocabSection
                vocab={article.vocab}
                articleTitle={article.title}
                onWordClick={(entryId) => navigate(`/dictionary?entry=${entryId}`)}
              />
            )}

            {/* Ngữ pháp trong bài */}
            {article.grammar?.length > 0 && <GrammarSection grammar={article.grammar} />}

            {/* Disclaimer */}
            <p className="mt-10 mb-16 text-[11px] text-on-muted/70 leading-relaxed border-t border-outline/30 pt-4">
              Bài đọc phục vụ mục đích luyện tập, do đội ngũ nội dung biên soạn với sự hỗ trợ của AI, không nhằm
              cung cấp thông tin thời sự. Nếu phát hiện nội dung chưa chính xác, hãy phản hồi để chúng tôi điều chỉnh.
            </p>
          </div>

          {/* ── Cột Trợ lý AI (cố định bên phải — desktop) ─────────────── */}
          <aside className="hidden lg:block lg:w-[360px] shrink-0">
            <div className="sticky top-16 h-[calc(100vh-5rem)] glass-card rounded-2xl border border-outline/30 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-5 h-14 border-b border-outline/30 shrink-0">
                <span className="material-symbols-outlined text-sumire-purple">smart_toy</span>
                <h2 className="font-display font-bold text-charcoal">Trợ lý AI</h2>
              </div>
              <ChatPanel chat={chat} />
            </div>
          </aside>

          {/* Popup tra từ điển khi bôi đen / nhấp đúp trong vùng đọc */}
          <WordLookupPopup containerRef={readRef} onAskAI={askAboutWord} />
        </div>
      )}

      {/* ── Drawer Trợ lý AI (mobile) ────────────────────────────────── */}
      {chatOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 h-16 border-b border-outline/30 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sumire-purple">smart_toy</span>
                <h2 className="font-display font-bold text-charcoal">Trợ lý AI</h2>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-on-muted hover:text-charcoal transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ChatPanel chat={chat} />
          </div>
        </div>
      )}
    </StudentLayout>
  );
}

// ── Hook giữ state hội thoại — nối tạm /api/ai/chat (BE teammate có thể thay ───
//    bằng endpoint news riêng sau) ──────────────────────────────────────────────
function useArticleChat(article) {
  const [messages, setMessages] = useState([]);   // { role: 'user'|'assistant', content }
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const sessionRef = useRef(null);

  // Reset hội thoại khi đổi sang bài đọc khác (route /news/:id đổi id không remount component)
  useEffect(() => {
    setMessages([]); setInput(''); setSending(false); setError(''); sessionRef.current = null;
  }, [article?.id]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !article) return;
    setError('');
    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      // Lần gửi đầu chèn ngữ cảnh bài đọc (không hiển thị trên UI) để AI biết bài
      const articleContext = '[Ngữ cảnh: học viên đang đọc bài báo tiếng Nhật sau]\n' +
        `Tiêu đề: ${article.title}\n` +
        'Nội dung: ' + (article.content || (article.segments || []).map(s => s.jp).join('')) +
        '\n[Hãy trả lời các câu hỏi của học viên dựa trên bài đọc này.]';
      const payload = messages.length === 0
        ? [{ role: 'user', content: articleContext }, userMsg]
        : next;
      const r = await api.post('/ai/chat', { messages: payload, sessionId: sessionRef.current });
      sessionRef.current = r.data.sessionId || sessionRef.current;
      setMessages(m => [...m, { role: 'assistant', content: r.data.reply || '' }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return { messages, input, setInput, sending, error, send };
}

// ── Khung chat dùng chung (panel desktop + drawer mobile) ─────────────────────
function ChatPanel({ chat }) {
  const { messages, input, setInput, sending, error, send } = chat;
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  return (
    <>
      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-on-muted text-sm py-10">
            <span className="material-symbols-outlined text-4xl text-sumire-purple/30 mb-2 block">forum</span>
            Hỏi mình bất cứ điều gì về bài đọc — nghĩa của từ, ngữ pháp, hay nội dung chính nhé!
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-tsubaki-red text-white rounded-br-md'
                : 'bg-surface-low text-charcoal-text rounded-bl-md'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface-low px-4 py-2.5 rounded-2xl rounded-bl-md">
              <span className="material-symbols-outlined animate-spin text-on-muted text-lg">progress_activity</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-outline/30 p-3 shrink-0">
        {error && <p className="text-xs text-error mb-2 px-1">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Nhập câu hỏi..."
            className="flex-1 resize-none px-4 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red max-h-32"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="w-11 h-11 shrink-0 rounded-xl bg-tsubaki-red text-white flex items-center justify-center hover:bg-primary disabled:opacity-40 transition-all"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ── Quiz đọc hiểu cuối bài (chấm client-side — đây là luyện tập, không phải thi) ─
function QuizSection({ questions }) {
  const [answers, setAnswers] = useState({});   // { [qIndex]: optionIndex }
  const [checked, setChecked] = useState(false);

  const allAnswered = questions.every((_, i) => answers[i] != null);
  const score = questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);

  return (
    <section className="mt-10 pt-6 border-t border-outline/30">
      <h2 className="font-display text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-tsubaki-red">quiz</span>
        Kiểm tra độ hiểu
      </h2>

      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={i} className="glass-card rounded-2xl p-4 border border-outline/30">
            <p className="font-semibold text-on-surface mb-3">{i + 1}. {q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, j) => {
                const selected = answers[i] === j;
                const isCorrect = j === q.answer;
                let cls = 'border-outline hover:border-tsubaki-red/50';
                if (checked) {
                  if (isCorrect) cls = 'border-green-400 bg-green-50';
                  else if (selected) cls = 'border-red-400 bg-red-50';
                  else cls = 'border-outline opacity-60';
                } else if (selected) {
                  cls = 'border-tsubaki-red bg-tsubaki-red/5';
                }
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={checked}
                    onClick={() => setAnswers(a => ({ ...a, [i]: j }))}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors flex items-center gap-2 ${cls}`}
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full border border-current flex items-center justify-center text-[11px] font-bold">
                      {String.fromCharCode(65 + j)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {checked && isCorrect && <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>}
                    {checked && selected && !isCorrect && <span className="material-symbols-outlined text-red-500 text-lg">cancel</span>}
                  </button>
                );
              })}
            </div>
            {checked && q.explanation_vi && (
              <p className="mt-3 text-sm text-on-muted leading-relaxed bg-surface-low rounded-xl px-3 py-2">
                <strong className="text-on-surface">Giải thích:</strong> {q.explanation_vi}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        {!checked ? (
          <Button disabled={!allAnswered} onClick={() => setChecked(true)}>
            <span className="material-symbols-outlined text-[18px]">task_alt</span>
            Kiểm tra đáp án
          </Button>
        ) : (
          <>
            <span className="font-display text-lg font-bold text-on-surface">
              {score}/{questions.length} câu đúng
            </span>
            <button
              onClick={() => { setChecked(false); setAnswers({}); }}
              className="px-4 py-2 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low transition-colors"
            >
              Làm lại
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ── Từ vựng trong bài + lưu nhanh vào Flashcard ───────────────────────────────
function VocabSection({ vocab, articleTitle, onWordClick }) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [setTitle, setSetTitle]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [savedId, setSavedId]     = useState(null);

  const openModal = () => {
    setSetTitle(`Từ vựng: ${articleTitle}`.slice(0, 100));
    setError(''); setSavedId(null); setModalOpen(true);
  };

  const save = async () => {
    if (!setTitle.trim()) return setError('Hãy nhập tên học phần.');
    setSaving(true); setError('');
    try {
      const cards = vocab
        .filter(v => v.word)
        .map(v => ({
          term: v.word,
          definition: [v.reading, v.meaning_vi].filter(Boolean).join(' — ') || v.word,
        }));
      const r = await api.post('/flashcards/sets', { title: setTitle.trim(), cards });
      setSavedId(r.data?.data?.id || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-10 pt-6 border-t border-outline/30">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="font-display text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-tsubaki-red">translate</span>
          Từ vựng trong bài
        </h2>
        <Button size="sm" onClick={openModal}>
          <span className="material-symbols-outlined text-[18px]">style</span>
          Lưu vào Flashcard
        </Button>
      </div>

      <div className="glass-card rounded-2xl border border-outline/30 divide-y divide-outline/20 overflow-hidden">
        {vocab.map((v, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 ${v.entry_id ? 'cursor-pointer hover:bg-surface-low/60' : ''} transition-colors`}
            onClick={() => v.entry_id && onWordClick(v.entry_id)}
          >
            <div className="w-28 shrink-0">
              <p className="font-semibold text-on-surface">{v.word}</p>
              {v.reading && <p className="text-xs text-on-muted">{v.reading}</p>}
            </div>
            <p className="flex-1 text-sm text-on-surface-variant">{v.meaning_vi || '—'}</p>
            {v.jlpt_level && (
              <span className="shrink-0 text-[10px] font-bold text-on-muted">{v.jlpt_level}</span>
            )}
            {v.entry_id && <span className="material-symbols-outlined text-on-muted/50 text-lg shrink-0">chevron_right</span>}
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Lưu từ vựng vào Flashcard"
        footer={savedId ? (
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Đóng</Button>
            <Button onClick={() => navigate(`/flashcards/${savedId}`)}>Mở học phần</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button loading={saving} onClick={save}>Tạo học phần</Button>
          </>
        )}
      >
        {savedId ? (
          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-200 text-sm text-green-800">
            <span className="material-symbols-outlined text-green-600 shrink-0">check_circle</span>
            <p>Đã tạo học phần với <strong>{vocab.length}</strong> thẻ từ vựng.</p>
          </div>
        ) : (
          <>
            {error && <Alert type="error">{error}</Alert>}
            <Input
              label="Tên học phần"
              value={setTitle}
              onChange={e => setSetTitle(e.target.value)}
              placeholder="Tên học phần flashcard..."
            />
            <p className="text-xs text-on-muted mt-2">
              Sẽ tạo <strong>{vocab.length}</strong> thẻ (mặt trước: từ, mặt sau: cách đọc + nghĩa).
            </p>
          </>
        )}
      </Modal>
    </section>
  );
}

// ── Ngữ pháp trong bài ────────────────────────────────────────────────────────
function GrammarSection({ grammar }) {
  return (
    <section className="mt-10 pt-6 border-t border-outline/30">
      <h2 className="font-display text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-tsubaki-red">school</span>
        Ngữ pháp trong bài
      </h2>
      <div className="space-y-3">
        {grammar.map((g, i) => (
          <div key={i} className="glass-card rounded-2xl border border-outline/30 p-4">
            <p className="font-display font-bold text-tsubaki-red mb-1">{g.pattern}</p>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-2">{g.explanation_vi}</p>
            {g.example_jp && (
              <p className="text-sm text-on-surface bg-surface-low rounded-xl px-3 py-2 leading-relaxed">
                {g.example_jp}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
