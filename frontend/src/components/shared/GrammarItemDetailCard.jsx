import { useEffect, useState } from 'react';
import FuriganaText from '../ui/FuriganaText';
import FuriganaToggle from '../ui/FuriganaToggle';

// Dữ liệu nhập từ Mazii đôi khi chứa <br/> (xuống dòng) và <s>...</s> (đánh dấu
// phần biến cách tùy chọn) — chỉ cho qua 2 thẻ này, strip mọi thứ khác để tránh
// XSS, rồi render bằng dangerouslySetInnerHTML thay vì hiện thẻ thô dạng text.
function sanitizeStructureHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(?!\/?(?:br|s)\b)[^>]*>/gi, '')
    .replace(/<(br|s)\b[^>]*>/gi, '<$1>');
}
const hasStructureTags = (t) => /<(br|s)\b/i.test(t || '');

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

// Thẻ chi tiết 1 mẫu ngữ pháp có prev/next — tách từ StudyListItemDetail để
// dùng chung cho bài đăng và Mục ngữ pháp của khóa học. Caller lo data + điều hướng.
// editable=true (chủ bài đăng/admin) cho sửa tiêu đề/nghĩa/giải thích/ví dụ ngay
// trên thẻ, theo cùng kiểu onBlur-lưu như VocabWordViewer.
export default function GrammarItemDetailCard({ item, index, total, onPrev, onNext, editable = false, onSave }) {
  const [title, setTitle]             = useState(item.title || '');
  const [titleJa, setTitleJa]         = useState(item.title_ja || '');
  const [meaning, setMeaning]         = useState(item.meaning_vi || '');
  const [explanation, setExplanation] = useState(item.explanation || '');
  const [example, setExample]         = useState(item.example_sentence || '');
  const [saving, setSaving]           = useState(false);
  const [furigana, setFurigana]       = useState(false);

  useEffect(() => {
    setTitle(item.title || '');
    setTitleJa(item.title_ja || '');
    setMeaning(item.meaning_vi || '');
    setExplanation(item.explanation || '');
    setExample(item.example_sentence || '');
  }, [item.id]);

  const save = async (patch) => {
    setSaving(true);
    try { await onSave(patch); } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="glass-card rounded-3xl overflow-hidden w-full max-w-3xl mx-auto">
      <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />

      <div className="px-8 pt-8 pb-2">
        <div className="flex items-center gap-2 mb-3">
          {item.level && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>
              {item.level}
            </span>
          )}
          <span className="text-xs text-on-muted">Mục {index + 1}/{total}</span>
          {editable && saving && <span className="text-xs text-on-muted">Đang lưu…</span>}
        </div>

        {editable ? (
          <>
            <input value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => title !== (item.title || '') && title.trim() && save({ title: title.trim() })}
              placeholder="Mẫu ngữ pháp" className="w-full text-3xl font-bold text-tsubaki-red leading-tight bg-transparent border-b border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors" />
            <input value={titleJa} onChange={e => setTitleJa(e.target.value)}
              onBlur={() => titleJa !== (item.title_ja || '') && save({ title_ja: titleJa || null })}
              placeholder="Dạng tiếng Nhật (nếu có)" className="w-full text-on-muted mt-1 bg-transparent border-b border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors" />
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-tsubaki-red leading-tight">{item.title}</h1>
            {item.title_ja && (
              hasStructureTags(item.title_ja)
                ? <p className="text-on-muted mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeStructureHtml(item.title_ja) }} />
                : <p className="text-on-muted mt-1">{item.title_ja}</p>
            )}
          </>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa</p>
            <div className="bg-surface-low rounded-xl px-4 py-3">
              {editable ? (
                <input value={meaning} onChange={e => setMeaning(e.target.value)}
                  onBlur={() => meaning !== (item.meaning_vi || '') && save({ meaning_vi: meaning })}
                  placeholder="Nghĩa tiếng Việt" className="w-full text-lg font-bold text-charcoal bg-transparent outline-none" />
              ) : (
                <p className="text-lg font-bold text-charcoal">{item.meaning_vi || '—'}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Cấu trúc / Cách dùng</p>
            <div className="bg-surface-low rounded-xl px-4 py-3">
              {editable ? (
                <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
                  onBlur={() => explanation !== (item.explanation || '') && save({ explanation: explanation || null })}
                  placeholder="Giải thích cấu trúc / cách dùng..." rows={3}
                  className="w-full text-charcoal leading-relaxed bg-transparent outline-none resize-none" />
              ) : item.explanation ? (
                hasStructureTags(item.explanation)
                  ? <p className="text-charcoal leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeStructureHtml(item.explanation) }} />
                  : <p className="text-charcoal whitespace-pre-wrap leading-relaxed">{item.explanation}</p>
              ) : (
                <p className="text-on-muted">—</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-on-muted uppercase tracking-wide">Ví dụ</p>
              {!editable && item.example_sentence && (
                <FuriganaToggle active={furigana} onToggle={() => setFurigana(v => !v)} />
              )}
            </div>
            <div className="bg-surface-low rounded-xl px-4 py-3">
              {editable ? (
                <textarea value={example} onChange={e => setExample(e.target.value)}
                  onBlur={() => example !== (item.example_sentence || '') && save({ example_sentence: example || null })}
                  placeholder="Câu ví dụ..." rows={2}
                  className="w-full text-charcoal italic bg-transparent outline-none resize-none" />
              ) : item.example_sentence ? (
                <p className="text-charcoal italic">「<FuriganaText text={item.example_sentence} enabled={furigana} textClassName="italic" />」</p>
              ) : (
                <p className="text-on-muted">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 pt-6 flex gap-2 border-t border-outline/30 mt-4">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
        </button>
        <button
          onClick={onNext}
          disabled={index === total - 1}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
        >
          Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
