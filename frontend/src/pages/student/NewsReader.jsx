import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import FuriganaText from '../../components/ui/FuriganaText';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const FONT_STEPS = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

const LEVEL_DOT = {
  N5: 'bg-green-500', N4: 'bg-blue-500', N3: 'bg-yellow-500', N2: 'bg-orange-500', N1: 'bg-red-600',
};

export default function NewsReader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Toolbar state
  const [furiganaOn, setFuriganaOn]       = useState(true);
  const [translationOn, setTranslationOn] = useState(false);
  const [fontIdx, setFontIdx]             = useState(1);
  const [chatOpen, setChatOpen]           = useState(false);   // chỉ dùng cho drawer mobile

  const chat = useArticleChat(article);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/news/${id}`)
      .then(r => { if (active) setArticle(r.data); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

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

      {loading ? (
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

            {/* Reading area */}
            {segments.length === 0 ? (
              <p className={`${fontClass} leading-loose whitespace-pre-line text-on-surface`}>
                {article.content || 'Bài đọc chưa có nội dung.'}
              </p>
            ) : (
              <div className="space-y-5 pb-16">
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
