import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Preview renderer (HTML with <ruby> passthrough) ───────────────────────────
function renderPreview(text) {
  if (!text) return '';
  // Don't escape < > so that <ruby> tags render
  return text
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-base font-bold text-tsubaki-red mt-4 mb-1">$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-lg font-bold text-on-surface mt-5 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr class="border-outline/20 my-4"/>')
    .replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-tsubaki-red/40 pl-4 my-2 text-on-muted italic">$1</blockquote>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br/>');
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonReading() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]   = useState(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [tab, setTab]         = useState('edit'); // 'edit' | 'split' | 'preview'
  const [furiModal, setFuriModal] = useState(false);
  const [furiForm, setFuriForm]   = useState({ kanji: '', reading: '' });
  const textareaRef = useRef(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`${apiBase}/lessons/${lessonId}`);
        setLesson(r.data);
        // content field stores: JSON { text, imageUrl } OR plain string (legacy)
        const raw = r.data.content || '';
        try {
          const parsed = JSON.parse(raw);
          setContent(parsed.text || '');
          setImageUrl(parsed.imageUrl || '');
        } catch {
          setContent(raw);
          setImageUrl('');
        }
      } catch (e) {
        setAlert({ type: 'error', msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lessonId]);

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = JSON.stringify({ text: content, imageUrl: imageUrl.trim() || null });
      await api.put(`${apiBase}/lessons/${lessonId}`, { content: payload });
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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [content, imageUrl]);

  // ── Cursor helpers ──────────────────────────────────────────────────────────

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

  const insertFurigana = () => {
    const { kanji, reading } = furiForm;
    if (!kanji.trim() || !reading.trim()) return;
    insertAtCursor(`<ruby>${kanji.trim()}<rt>${reading.trim()}</rt></ruby>`);
    setFuriModal(false);
    setFuriForm({ kanji: '', reading: '' });
  };

  const TOOLBAR = [
    { icon: 'format_h2',          title: 'Tiêu đề lớn',  action: () => insertAtCursor('## ') },
    { icon: 'format_h3',          title: 'Tiêu đề nhỏ',  action: () => insertAtCursor('### ') },
    { icon: 'format_bold',        title: 'In đậm',       action: () => insertAtCursor('**', '**') },
    { icon: 'format_italic',      title: 'In nghiêng',   action: () => insertAtCursor('*', '*') },
    { icon: 'format_quote',       title: 'Trích dẫn',    action: () => insertAtCursor('> ') },
    { icon: 'horizontal_rule',    title: 'Đường kẻ',     action: () => insertAtCursor('\n---\n') },
  ];

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  // ── Render preview ──────────────────────────────────────────────────────────

  const PreviewPane = () => (
    <div className="p-6 overflow-y-auto" style={{ minHeight: tab === 'split' ? '60vh' : '65vh' }}>
      {content || imageUrl ? (
        <>
          {/* Lesson header preview */}
          <div className="mb-6 pb-4 border-b border-outline/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                {lesson?.level ? `${lesson.level} Reading` : 'Reading Lesson'}
              </span>
            </div>
            <h1 className="text-lg font-bold text-on-surface">{lesson?.title}</h1>
            {lesson?.title_ja && <p className="text-sm text-on-muted">{lesson.title_ja}</p>}
          </div>

          {/* Image */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Ảnh bài đọc"
              className="w-full rounded-xl mb-6 object-cover max-h-60 border border-outline/10"
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}

          {/* Text with furigana */}
          <div
            className="prose prose-sm max-w-none text-on-surface leading-loose text-[16px]"
            style={{ fontFamily: "'Noto Sans JP', 'Plus Jakarta Sans', sans-serif", lineHeight: 2.2 }}
            dangerouslySetInnerHTML={{ __html: `<p class="mb-4">${renderPreview(content)}</p>` }}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-on-muted text-center py-16">
          <span className="material-symbols-outlined text-5xl mb-3 opacity-20">description</span>
          <p className="text-sm">Bắt đầu soạn thảo để xem trước nội dung</p>
        </div>
      )}
    </div>
  );

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout title="Soạn thảo bài đọc">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Soạn thảo bài đọc">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-2">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại Course Builder
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/10 text-primary px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">description</span>
              Reading
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">
            {lesson?.title || 'Bài học đọc'}
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

      {/* Image URL */}
      <div className="mb-4 flex items-center gap-3 bg-white rounded-2xl border border-outline/20 px-4 py-3 shadow-sm">
        <span className="material-symbols-outlined text-on-muted text-xl shrink-0">image</span>
        <div className="flex-1">
          <label className="block text-xs font-medium text-on-muted mb-0.5">URL hình ảnh (không bắt buộc)</label>
          <input
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://... hoặc để trống"
            className="w-full text-sm outline-none text-on-surface bg-transparent placeholder:text-on-muted/40"
          />
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="w-12 h-12 rounded-xl object-cover border border-outline/20 shrink-0"
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
      </div>

      {/* Furigana toolbar button */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-on-muted font-medium">Công cụ:</span>
        <button
          onClick={() => setFuriModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline/30 text-xs text-on-muted hover:border-tsubaki-red/50 hover:text-tsubaki-red transition-colors"
        >
          <span className="material-symbols-outlined text-sm">translate</span>
          Thêm Furigana
        </button>
        <span className="text-xs text-on-muted/60 ml-1">
          Hoặc gõ trực tiếp: <code className="bg-surface-container px-1 rounded font-mono">&lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt;</code>
        </span>
      </div>

      {/* Editor area */}
      <div className="bg-white rounded-2xl border border-outline/20 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-outline/20 px-4 py-2 bg-surface-stone/30">
          <div className="flex gap-1">
            {[
              { id: 'edit',    icon: 'edit',        label: 'Soạn thảo' },
              { id: 'split',   icon: 'view_column', label: 'Split view' },
              { id: 'preview', icon: 'visibility',  label: 'Xem trước' },
            ].map(t => (
              <button
                key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${tab === t.id ? 'bg-tsubaki-red/10 text-tsubaki-red' : 'text-on-muted hover:bg-surface-container-low'}`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {tab !== 'preview' && (
            <div className="flex gap-0.5">
              {TOOLBAR.map(btn => (
                <button
                  key={btn.icon} onClick={btn.action} title={btn.title}
                  className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">{btn.icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panels */}
        <div className={tab === 'split' ? 'grid grid-cols-2 divide-x divide-outline/20' : ''}>
          {/* Editor */}
          {tab !== 'preview' && (
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={'## Kintsugi: Vẻ đẹp của sự không hoàn hảo\n\n<ruby>金継<rt>きんつ</rt></ruby>ぎは、<ruby>壊<rt>こわ</rt></ruby>れた<ruby>陶磁器<rt>とうじき</rt></ruby>を...\n\n---\n\n> Viết nội dung bài đọc với furigana HTML hoặc dùng nút "Thêm Furigana" ở trên.'}
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
          {tab !== 'edit' && <PreviewPane />}
        </div>
      </div>

      {/* Furigana helper */}
      <div className="mt-4 p-4 bg-white/60 rounded-xl border border-outline/20">
        <p className="text-xs font-bold text-on-muted uppercase tracking-wider mb-2">Cú pháp Furigana</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-on-muted">
          <span><code className="bg-surface-container px-1 py-0.5 rounded font-mono text-tsubaki-red">&lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt;</code> → Furigana cơ bản</span>
          <span><code className="bg-surface-container px-1 py-0.5 rounded font-mono text-tsubaki-red">**chữ**</code> → <strong>In đậm</strong></span>
          <span><code className="bg-surface-container px-1 py-0.5 rounded font-mono text-tsubaki-red">*chữ*</code> → <em>In nghiêng</em></span>
          <span><code className="bg-surface-container px-1 py-0.5 rounded font-mono text-tsubaki-red">&gt; văn bản</code> → Trích dẫn</span>
          <span><code className="bg-surface-container px-1 py-0.5 rounded font-mono text-tsubaki-red">---</code> → Đường kẻ</span>
        </div>
      </div>

      {/* Furigana Insert Modal */}
      {furiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-tsubaki-red">translate</span>
              Thêm Furigana
            </h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-sm font-medium text-on-muted mb-1">Chữ Kanji / Kana</label>
                <input
                  autoFocus
                  value={furiForm.kanji}
                  onChange={e => setFuriForm(f => ({ ...f, kanji: e.target.value }))}
                  placeholder="例: 漢字"
                  className="w-full px-4 py-3 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-muted mb-1">Cách đọc (Furigana)</label>
                <input
                  value={furiForm.reading}
                  onChange={e => setFuriForm(f => ({ ...f, reading: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && insertFurigana()}
                  placeholder="例: かんじ"
                  className="w-full px-4 py-3 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red transition-colors"
                />
              </div>
            </div>
            {furiForm.kanji && furiForm.reading && (
              <div className="mb-4 p-3 bg-surface-stone rounded-xl text-center">
                <ruby className="text-xl">{furiForm.kanji}<rt className="text-xs text-tsubaki-red">{furiForm.reading}</rt></ruby>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setFuriModal(false)} className="flex-1 py-2.5 border border-outline rounded-xl text-sm font-medium text-on-muted hover:bg-surface-low transition-colors">
                Hủy
              </button>
              <button
                onClick={insertFurigana}
                disabled={!furiForm.kanji.trim() || !furiForm.reading.trim()}
                className="flex-1 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                Chèn vào văn bản
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
