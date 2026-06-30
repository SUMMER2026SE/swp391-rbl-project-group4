import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Simple Markdown-to-HTML preview ──────────────────────────────────────────
function renderPreview(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-base font-bold text-tsubaki-red mt-4 mb-1">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-lg font-bold text-on-surface mt-5 mb-2">$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1 class="text-xl font-bold text-on-surface mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono text-tsubaki-red">$1</code>')
    .replace(/^---$/gm, '<hr class="border-outline/20 my-4"/>')
    .replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-sumire-purple/40 pl-4 my-2 text-on-muted italic">$1</blockquote>')
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-on-surface">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class="my-2 space-y-1">${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br/>');
}

// ── Grammar Structure Block ───────────────────────────────────────────────────

const STRUCTURE_TEMPLATES = [
  {
    label: 'Cấu trúc cơ bản',
    icon: 'format_h1',
    text: '## Cấu trúc (Formula)\n\nV (普通形) + **〜ndesu**\n\n---\n\n## Cách dùng (Usage)\n\n1. **Giải thích lý do** — Dùng khi muốn giải thích một sự việc.\n2. **Yêu cầu giải thích** — Dùng khi muốn người nghe giải thích rõ hơn.\n\n---\n\n## Ví dụ (Examples)\n\n> A: どうして遅れたんですか。\n> B: バスが来なかったんです。\n\n*Tại sao bạn đến muộn? — Vì xe bus không tới.*\n\n---\n\n## Lưu ý\n\n⚠️ Đừng lạm dụng cấu trúc này. Nó mang sắc thái giải thích mạnh mẽ.',
  },
  {
    label: 'Cấu trúc so sánh',
    icon: 'compare',
    text: '## Cấu trúc (Formula)\n\nA より B の方が〜\n\n---\n\n## Ý nghĩa\n\nSo sánh A và B, nhấn mạnh B có tính chất hơn.\n\n---\n\n## Ví dụ\n\n> 電車よりバスの方が安いです。\n\n*Xe bus rẻ hơn tàu điện.*',
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonGrammar() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]     = useState(null);
  const [content, setContent]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [alert, setAlert]       = useState({ type: '', msg: '' });
  const [tab, setTab]           = useState('edit'); // 'edit' | 'preview' | 'split'
  const textareaRef             = useRef(null);

  // ── Load lesson ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`${apiBase}/lessons/${lessonId}`);
        setLesson(r.data);
        setContent(r.data.grammar_notes || '');
      } catch (e) {
        setAlert({ type: 'error', msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lessonId]);

  // ── Auto-save indicator ─────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${apiBase}/lessons/${lessonId}`, { grammar_notes: content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd + S shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [content]);

  // ── Toolbar helpers ─────────────────────────────────────────────────────────

  const insertAtCursor = (before, after = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const selected = content.slice(start, end);
    const newText = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newText);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd   = start + before.length + selected.length;
    }, 0);
  };

  const TOOLBAR = [
    { icon: 'format_h2', title: 'Tiêu đề', action: () => insertAtCursor('## ') },
    { icon: 'format_h3', title: 'Tiêu đề nhỏ', action: () => insertAtCursor('### ') },
    { icon: 'format_bold', title: 'In đậm', action: () => insertAtCursor('**', '**') },
    { icon: 'format_italic', title: 'In nghiêng', action: () => insertAtCursor('*', '*') },
    { icon: 'code', title: 'Code inline', action: () => insertAtCursor('`', '`') },
    { icon: 'format_quote', title: 'Trích dẫn', action: () => insertAtCursor('> ') },
    { icon: 'format_list_bulleted', title: 'Danh sách', action: () => insertAtCursor('- ') },
    { icon: 'horizontal_rule', title: 'Đường kẻ', action: () => insertAtCursor('\n---\n') },
  ];

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout title="Soạn thảo ngữ pháp">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-2"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại Course Builder
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-100 text-amber-700 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">spellcheck</span>
              Grammar
            </span>
          </div>

          <h1 className="font-display text-xl font-bold text-on-surface">
            {loading ? 'Đang tải...' : lesson?.title || 'Bài học ngữ pháp'}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Đã lưu
            </span>
          )}
          <span className="text-xs text-on-muted hidden sm:block">Ctrl+S để lưu nhanh</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Đang lưu...' : 'Lưu nội dung'}
          </button>
        </div>
      </section>

      {/* Quick templates */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-xs text-on-muted self-center font-medium">Template:</span>
        {STRUCTURE_TEMPLATES.map(tpl => (
          <button
            key={tpl.label}
            onClick={() => setContent(tpl.text)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline/30 text-xs text-on-muted hover:border-sumire-purple/50 hover:text-sumire-purple transition-colors"
          >
            <span className="material-symbols-outlined text-sm">{tpl.icon}</span>
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="bg-white rounded-2xl border border-outline/20 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-outline/20 px-4 py-2 bg-surface-stone/30">
          <div className="flex gap-1">
            {[
              { id: 'edit', icon: 'edit', label: 'Soạn thảo' },
              { id: 'split', icon: 'view_column', label: 'Split view' },
              { id: 'preview', icon: 'visibility', label: 'Xem trước' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${tab === t.id
                    ? 'bg-tsubaki-red/10 text-tsubaki-red'
                    : 'text-on-muted hover:bg-surface-container-low'}`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          {tab !== 'preview' && (
            <div className="flex gap-0.5">
              {TOOLBAR.map(btn => (
                <button
                  key={btn.icon}
                  onClick={btn.action}
                  title={btn.title}
                  className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">{btn.icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content panels */}
        <div className={`${tab === 'split' ? 'grid grid-cols-2 divide-x divide-outline/20' : ''}`}>
          {/* Editor */}
          {tab !== 'preview' && (
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={'## Cấu trúc (Formula)\n\nV + 〜て + ください\n\n---\n\n## Cách dùng\n\nSử dụng khi...\n\n---\n\n## Ví dụ\n\n> 窓を開けてください。\n\n*Làm ơn hãy mở cửa sổ.*'}
                className="w-full p-5 text-sm font-mono text-on-surface outline-none resize-none leading-relaxed"
                style={{ minHeight: tab === 'split' ? '60vh' : '65vh' }}
              />
              {content && (
                <div className="absolute bottom-3 right-4 text-xs text-on-muted opacity-50">
                  {content.length} ký tự
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {tab !== 'edit' && (
            <div className="p-6 overflow-y-auto" style={{ minHeight: tab === 'split' ? '60vh' : '65vh' }}>
              {content ? (
                <>
                  {/* Grammar lesson header preview */}
                  <div className="mb-6 pb-4 border-b border-outline/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-tsubaki-red/10 text-tsubaki-red rounded-full text-xs font-semibold">
                        {lesson?.level ? `${lesson.level} Lesson` : 'Grammar Lesson'}
                      </span>
                    </div>
                    <h1 className="text-lg font-bold text-on-surface">{lesson?.title}</h1>
                    {lesson?.title_ja && <p className="text-sm text-on-muted">{lesson.title_ja}</p>}
                  </div>

                  <div
                    className="prose prose-sm max-w-none text-on-surface leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: `<p class="mb-3">${renderPreview(content)}</p>` }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-on-muted text-center py-16">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-20">preview</span>
                  <p className="text-sm">Bắt đầu soạn thảo để xem trước nội dung</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Markdown cheatsheet */}
      <div className="mt-4 p-4 bg-white/60 rounded-xl border border-outline/20">
        <p className="text-xs font-bold text-on-muted uppercase tracking-wider mb-2">Markdown nhanh</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {[
            ['## Tiêu đề', 'H2'], ['**chữ**', 'In đậm'], ['*chữ*', 'In nghiêng'],
            ['`code`', 'Code'], ['> trích dẫn', 'Quote'], ['- mục', 'Danh sách'], ['---', 'Đường kẻ'],
          ].map(([syntax, label]) => (
            <span key={label} className="text-xs text-on-muted">
              <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-tsubaki-red">{syntax}</code>
              {' → '}{label}
            </span>
          ))}
        </div>
      </div>
    </Layout>
  );
}
