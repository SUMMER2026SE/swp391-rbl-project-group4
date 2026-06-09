import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/layout/AdminLayout';
import TeacherLayout from '../components/layout/TeacherLayout';
import StudentLayout from '../components/layout/StudentLayout';
import FuriganaText from '../components/ui/FuriganaText';
import api from '../lib/api';

// ── constants ──────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  '水 (みず) có nghĩa là gì?',
  'Phân biệt は và が trong tiếng Nhật',
  'Giải thích kanji 愛 cho tôi',
  'Từ vựng JLPT N5 về gia đình',
];

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};
const TYPE_COLORS = {
  'DANH TỪ': 'bg-blue-100 text-blue-700',
  'ĐỘNG TỪ': 'bg-green-100 text-green-700',
  'TÍNH TỪ': 'bg-amber-100 text-amber-700',
  'PHÓ TỪ':  'bg-purple-100 text-purple-700',
  'LIÊN TỪ': 'bg-rose-100 text-rose-700',
};

const joinArr = (v) => Array.isArray(v) ? v.join('、') : (v || '—');

// ── detail modals ──────────────────────────────────────────────────────────
function DetailOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-muted hover:bg-surface-low transition-colors">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
        {children}
      </div>
    </div>
  );
}

function VocabDetail({ vocab, onClose }) {
  const [furigana, setFurigana] = useState(false);
  return (
    <DetailOverlay onClose={onClose}>
      <div className="px-8 pt-8 pb-4 text-center">
        <div className="flex justify-center mb-2">
          <FuriganaText text={vocab.kanji || vocab.reading} enabled={furigana} textClassName="text-6xl font-bold text-tsubaki-red leading-none" />
        </div>
        {vocab.kanji && <p className="text-lg text-on-muted mt-1">{vocab.reading}</p>}
        <div className="flex flex-wrap gap-2 justify-center mt-3">
          {vocab.level && <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[vocab.level] || 'bg-surface-low text-on-muted'}`}>{vocab.level}</span>}
          {vocab.type  && <span className={`px-3 py-1 rounded-full text-xs font-bold ${TYPE_COLORS[vocab.type]   || 'bg-surface-low text-on-muted'}`}>{vocab.type}</span>}
          <button
            type="button"
            onClick={() => setFurigana(v => !v)}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all select-none ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'}`}>
            <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
            ふりがな
          </button>
        </div>
      </div>
      <div className="mx-8 border-t border-outline/30" />
      <div className="px-8 py-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa tiếng Việt</p>
          <p className="text-lg font-bold text-charcoal">{vocab.meaning_vi}</p>
        </div>
        {vocab.meaning_ja && (
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Giải thích tiếng Nhật</p>
            <FuriganaText text={vocab.meaning_ja} enabled={furigana} textClassName="text-sm text-charcoal" block />
          </div>
        )}
        {vocab.example_sentence && (
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Câu ví dụ</p>
            <div className="text-sm text-charcoal italic bg-surface-low rounded-xl px-4 py-3">
              「<FuriganaText text={vocab.example_sentence} enabled={furigana} textClassName="text-sm text-charcoal italic" />」
            </div>
          </div>
        )}
      </div>
    </DetailOverlay>
  );
}

function KanjiDetail({ kanji, onClose }) {
  const [furigana, setFurigana] = useState(false);
  return (
    <DetailOverlay onClose={onClose}>
      <div className="px-8 pt-8 pb-6 text-center">
        <div className="flex justify-center mb-3">
          <FuriganaText text={kanji.character} enabled={furigana} textClassName="text-8xl font-bold text-tsubaki-red leading-none" />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {kanji.level && <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[kanji.level] || 'bg-surface-low text-on-muted'}`}>{kanji.level}</span>}
          <button
            type="button"
            onClick={() => setFurigana(v => !v)}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all select-none ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'}`}>
            <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
            ふりがな
          </button>
        </div>
      </div>
      <div className="mx-8 border-t border-outline/30" />
      <div className="px-8 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">On-yomi</p>
            <p className="text-sm font-bold text-charcoal">{joinArr(kanji.reading_on)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Kun-yomi</p>
            <p className="text-sm font-bold text-charcoal">{joinArr(kanji.reading_kun)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa</p>
          <p className="text-lg font-bold text-charcoal">{kanji.meaning_vi}</p>
        </div>
        {kanji.stroke_count && (
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Số nét</p>
            <p className="text-sm text-charcoal">{kanji.stroke_count} nét</p>
          </div>
        )}
      </div>
    </DetailOverlay>
  );
}

// ── context chips ──────────────────────────────────────────────────────────
function ContextChips({ contextItems, onSelect }) {
  if (!contextItems) return null;
  const { vocabs = [], kanjis = [] } = contextItems;
  if (!vocabs.length && !kanjis.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {vocabs.map(v => (
        <button key={`v-${v.id}`} onClick={() => onSelect({ type: 'vocab', data: v })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium hover:bg-violet-100 hover:border-violet-300 transition-colors">
          <span className="font-bold">{v.kanji || v.reading}</span>
          {v.kanji && <span className="text-violet-400">{v.reading}</span>}
          <span className="text-violet-500">·</span>
          <span>{v.meaning_vi}</span>
          <span className="material-symbols-outlined text-[14px] text-violet-400">open_in_new</span>
        </button>
      ))}
      {kanjis.map(k => (
        <button key={`k-${k.id}`} onClick={() => onSelect({ type: 'kanji', data: k })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 hover:border-amber-300 transition-colors">
          <span className="text-base font-bold leading-none">{k.character}</span>
          <span className="text-amber-500">·</span>
          <span>{k.meaning_vi}</span>
          <span className="material-symbols-outlined text-[14px] text-amber-400">open_in_new</span>
        </button>
      ))}
    </div>
  );
}

// ── markdown renderer ──────────────────────────────────────────────────────
const LATEX_MAP = {
  '\\rightarrow': '→', '\\Rightarrow': '⇒', '\\leftarrow': '←',
  '\\Leftarrow': '⇐', '\\leftrightarrow': '↔', '\\cdot': '·',
  '\\times': '×', '\\div': '÷', '\\neq': '≠', '\\leq': '≤',
  '\\geq': '≥', '\\approx': '≈', '\\infty': '∞',
};
function stripLatex(text) {
  return text.replace(/\$([^$]+)\$/g, (_, inner) => {
    let result = inner.trim();
    for (const [key, val] of Object.entries(LATEX_MAP))
      result = result.replace(new RegExp(key.replace(/\\/g, '\\\\'), 'g'), val);
    return result.replace(/\\[a-zA-Z]+/g, '');
  });
}
function parseInline(text, keyPrefix = '') {
  const clean = stripLatex(text);
  const parts = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/g;
  let last = 0, m, idx = 0;
  while ((m = re.exec(clean)) !== null) {
    if (m.index > last) parts.push(clean.slice(last, m.index));
    if (m[0].startsWith('**'))     parts.push(<strong key={`${keyPrefix}-b${idx++}`}>{m[2]}</strong>);
    else if (m[0].startsWith('*')) parts.push(<em key={`${keyPrefix}-i${idx++}`}>{m[3]}</em>);
    else if (m[0].startsWith('`')) parts.push(<code key={`${keyPrefix}-c${idx++}`} className="bg-surface-low px-1.5 py-0.5 rounded text-[11px] font-mono">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < clean.length) parts.push(clean.slice(last));
  return parts;
}
function MarkdownContent({ text }) {
  const lines = text.split('\n');
  const elements = [];
  let listBuf = [];
  let keyIdx = 0;
  const flushList = () => {
    if (!listBuf.length) return;
    elements.push(
      <ul key={`ul-${keyIdx++}`} className="space-y-0.5 my-1 ml-2">
        {listBuf.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-on-muted mt-0.5 flex-shrink-0">•</span>
            <span>{parseInline(item, `li-${keyIdx}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    listBuf = [];
  };
  for (const line of lines) {
    const stripped = stripLatex(line);
    const headingMatch = stripped.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushList();
      elements.push(<p key={keyIdx++} className="font-bold text-[13px] mt-2 mb-0.5">{parseInline(headingMatch[2], `h-${keyIdx}`)}</p>);
      continue;
    }
    const listMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)/);
    if (listMatch) { listBuf.push(listMatch[1]); continue; }
    flushList();
    if (line.trim() === '') { elements.push(<div key={keyIdx++} className="h-1.5" />); continue; }
    elements.push(<span key={keyIdx++} className="block leading-relaxed">{parseInline(line, `p-${keyIdx}`)}</span>);
  }
  flushList();
  return <div className="space-y-0.5 text-sm">{elements}</div>;
}

// ── image resize helper ────────────────────────────────────────────────────
function resizeImage(file, maxPx = 1120) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ dataUrl, base64: dataUrl.split(',')[1], type: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── typing animation ───────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center px-1 py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

// ── single message bubble ──────────────────────────────────────────────────
function MessageBubble({ item, onSelectDetail }) {
  const isUser = item.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-tsubaki-red' : 'bg-violet-100'
      }`}>
        <span className={`material-symbols-outlined text-[18px] ${isUser ? 'text-white' : 'text-violet-600'}`}
          style={{ fontVariationSettings: "'FILL' 1" }}>
          {isUser ? 'person' : 'smart_toy'}
        </span>
      </div>
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
        <div className={`rounded-2xl break-words overflow-hidden ${
          isUser
            ? 'bg-tsubaki-red text-white rounded-tr-sm shadow-sm'
            : 'bg-white border border-outline/60 rounded-tl-sm shadow-sm'
        }`}>
          {item.imageDataUrl && (
            <img src={item.imageDataUrl} alt="ảnh đính kèm"
              className="max-w-[260px] w-full object-cover block" />
          )}
          {item.content && (
            <div className={`px-4 py-3 text-sm leading-relaxed ${isUser ? 'whitespace-pre-wrap' : ''}`}>
              {isUser ? item.content : <MarkdownContent text={item.content} />}
            </div>
          )}
        </div>
        {!isUser && <ContextChips contextItems={item.contextItems} onSelect={onSelectDetail} />}
      </div>
    </div>
  );
}

// ── sessions sidebar ───────────────────────────────────────────────────────
function SessionSidebar({ sessions, activeId, onSelect, onDelete, onNew, loading }) {
  const fmtDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000)     return 'Vừa xong';
    if (diff < 3600000)   return Math.floor(diff / 60000) + ' phút trước';
    if (diff < 86400000)  return Math.floor(diff / 3600000) + ' giờ trước';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' ngày trước';
    return d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="flex flex-col w-64 flex-shrink-0 border-r border-outline/30 bg-white/60 h-full overflow-hidden">
      <div className="p-3 border-b border-outline/20 flex-shrink-0">
        <button onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors">
          <span className="material-symbols-outlined text-lg">add</span>
          Cuộc trò chuyện mới
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col gap-2 p-3">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-surface-low animate-pulse" />)}
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <p className="text-xs text-on-muted text-center py-8 px-4">Chưa có cuộc trò chuyện nào</p>
        )}
        {!loading && sessions.map(s => (
          <div key={s.id}
            className={`group relative flex items-start gap-2 px-3 py-2.5 mx-2 my-1 rounded-xl cursor-pointer transition-colors ${
              s.id === activeId ? 'bg-violet-50 border border-violet-200' : 'hover:bg-surface-low border border-transparent'
            }`}
            onClick={() => onSelect(s.id)}>
            <span className={`material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0 ${
              s.id === activeId ? 'text-violet-600' : 'text-on-muted'
            }`}>chat</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate leading-snug ${
                s.id === activeId ? 'text-violet-700' : 'text-charcoal'
              }`}>{s.title}</p>
              <p className="text-[10px] text-on-muted mt-0.5">{fmtDate(s.updated_at)}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(s.id); }}
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-100 hover:text-error transition-all text-on-muted">
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, isAdmin, isTeacher } = useAuth();
  const Layout = isAdmin() ? AdminLayout : isTeacher() ? TeacherLayout : StudentLayout;

  // sessions
  const [sessions, setSessions]         = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // chat state
  const [apiMessages, setApiMessages]   = useState([]);
  const [displayItems, setDisplayItems] = useState([]);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [detailItem, setDetailItem]     = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading]   = useState(false);

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset toàn bộ state khi đổi tài khoản
  const userId = user?.id;
  useEffect(() => {
    setSessions([]);
    setSessionsLoading(true);
    setActiveSessionId(null);
    setApiMessages([]);
    setDisplayItems([]);
    setInput('');
    setError('');
    setSelectedImage(null);
  }, [userId]);

  // ── load sessions list ───────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await api.get('/ai/sessions');
      setSessions(r.data.sessions || []);
    } catch (_) {}
    finally { setSessionsLoading(false); }
  }, [userId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayItems, loading]);

  // ── load a session ───────────────────────────────────────────────────────
  const loadSession = useCallback(async (id) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    setError('');
    setDisplayItems([]);
    setApiMessages([]);
    try {
      const r = await api.get('/ai/sessions/' + id);
      const msgs = r.data.messages || [];
      const display = msgs.map(m => ({
        role: m.role,
        content: m.content,
        contextItems: m.context_items || undefined,
      }));
      const apiMsgs = msgs.map(m => ({ role: m.role, content: m.content }));
      setDisplayItems(display);
      setApiMessages(apiMsgs);
    } catch (e) {
      setError('Không thể tải lịch sử: ' + (e.response?.data?.error || e.message));
    }
  }, [activeSessionId]);

  // ── image picker ─────────────────────────────────────────────────────────
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Hình ảnh quá lớn (tối đa 10MB).'); return; }
    setImageLoading(true);
    try {
      const resized = await resizeImage(file);
      setSelectedImage(resized);
      setError('');
    } catch { setError('Không thể đọc hình ảnh.'); }
    finally { setImageLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  // ── new conversation ─────────────────────────────────────────────────────
  const newChat = () => {
    setActiveSessionId(null);
    setApiMessages([]);
    setDisplayItems([]);
    setInput('');
    setError('');
    setSelectedImage(null);
  };

  // ── delete session ───────────────────────────────────────────────────────
  const deleteSession = async (id) => {
    try {
      await api.delete('/ai/sessions/' + id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) newChat();
    } catch (_) {}
  };

  // ── auto-resize textarea ─────────────────────────────────────────────────
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ── send message ─────────────────────────────────────────────────────────
  const send = async (text) => {
    const content = (text ?? input).trim();
    if ((!content && !selectedImage) || loading) return;

    const imageSnapshot = selectedImage;
    const userMsg  = { role: 'user', content: content || '' };
    const newApi   = [...apiMessages, userMsg];

    setApiMessages(newApi);
    setDisplayItems(prev => [...prev, { ...userMsg, imageDataUrl: imageSnapshot?.dataUrl }]);
    setInput('');
    setSelectedImage(null);
    setError('');
    setTimeout(autoResize, 0);
    setLoading(true);

    try {
      const r = await api.post('/ai/chat', {
        messages: newApi,
        sessionId: activeSessionId,
        imageBase64: imageSnapshot?.base64,
        imageType:   imageSnapshot?.type,
      });

      const { reply, contextItems, sessionId } = r.data;
      const assistantMsg = { role: 'assistant', content: reply };

      setApiMessages(prev => [...prev, assistantMsg]);
      setDisplayItems(prev => [...prev, { ...assistantMsg, contextItems }]);

      // if new session was created, register it
      if (sessionId && !activeSessionId) {
        setActiveSessionId(sessionId);
        // prepend to sessions list
        const title = content.slice(0, 60) || 'Cuộc trò chuyện mới';
        setSessions(prev => [
          { id: sessionId, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ...prev,
        ]);
      } else if (sessionId) {
        // bump updated_at
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, updated_at: new Date().toISOString() } : s
        ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
      }
    } catch (e) {
      setApiMessages(prev => prev.slice(0, -1));
      setDisplayItems(prev => prev.slice(0, -1));
      setError(e.response?.data?.error || e.message || 'Lỗi kết nối AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Layout title="Trợ lý AI">
      <div className="flex max-w-5xl mx-auto rounded-2xl overflow-hidden border border-outline/30 shadow-sm bg-white/40"
        style={{ height: 'calc(100vh - 8rem)' }}>

        {/* Sessions sidebar */}
        <SessionSidebar
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={loadSession}
          onDelete={deleteSession}
          onNew={newChat}
          loading={sessionsLoading}
        />

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-outline/20 flex-shrink-0 bg-white/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-violet-600 text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div>
                <p className="font-display text-sm font-bold leading-tight">Kizuna AI</p>
                <p className="text-[10px] text-on-muted">Trợ lý học tiếng Nhật</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4">
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-violet-300"
                    style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
                <div>
                  <p className="font-display text-base font-bold">Xin chào! Tôi là Kizuna AI</p>
                  <p className="text-sm text-on-muted mt-1">Hỏi tôi bất cứ điều gì về tiếng Nhật nhé 🇯🇵</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-left p-3 rounded-xl border border-outline bg-white hover:bg-violet-50 hover:border-violet-200 text-xs text-charcoal transition-colors shadow-sm">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {displayItems.map((item, i) => (
                  <MessageBubble key={i} item={item} onSelectDetail={setDetailItem} />
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-violet-600"
                        style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-white border border-outline/60 shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex-shrink-0 flex items-center gap-2 mx-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-error mb-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-outline/20 bg-white/80">
            {/* Image preview */}
            {selectedImage && (
              <div className="relative inline-block mb-2">
                <img src={selectedImage.dataUrl} alt="preview"
                  className="h-20 w-auto rounded-xl border border-outline object-cover" />
                <button onClick={() => setSelectedImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-charcoal text-white flex items-center justify-center hover:bg-error transition-colors">
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              {/* Image button */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={handleImageSelect} />
              <button onClick={() => fileInputRef.current?.click()} disabled={loading || imageLoading}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedImage
                    ? 'bg-violet-100 border-violet-300 text-violet-600'
                    : 'border-outline text-on-muted hover:bg-surface-low hover:text-charcoal'
                } disabled:opacity-40`}>
                {imageLoading
                  ? <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  : <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                }
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKey}
                disabled={loading}
                placeholder={selectedImage ? 'Hỏi về hình ảnh này... (Enter gửi)' : 'Hỏi về từ vựng, kanji, ngữ pháp... (Enter gửi · Shift+Enter xuống dòng)'}
                rows={1}
                className="flex-1 px-4 py-2.5 bg-surface-low border border-outline rounded-2xl text-sm outline-none focus:border-violet-400 focus:bg-white resize-none leading-relaxed transition-colors disabled:opacity-60"
                style={{ maxHeight: '120px' }}
              />
              <button onClick={() => send()} disabled={(!input.trim() && !selectedImage) || loading}
                className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-outline disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0">
                <span className="material-symbols-outlined text-white text-[20px]">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail modals */}
      {detailItem?.type === 'vocab' && <VocabDetail vocab={detailItem.data} onClose={() => setDetailItem(null)} />}
      {detailItem?.type === 'kanji' && <KanjiDetail kanji={detailItem.data} onClose={() => setDetailItem(null)} />}
    </Layout>
  );
}
