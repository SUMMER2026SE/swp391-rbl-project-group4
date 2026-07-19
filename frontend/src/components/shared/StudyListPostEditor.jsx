import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import ImportFileModal from '../admin/ImportFileModal';
import api from '../../lib/api';
import { TOPIC_ICONS } from '../../lib/studyListTopics';

// Các mảnh dùng chung cho form tạo/sửa bài đăng danh sách (từ vựng/kanji/ngữ
// pháp) — dùng ở cả trang giáo viên và trang admin (admin quản lý bài của
// chính mình, giống hệt luồng giáo viên).

export const TYPE_TO_IMPORT = { vocabulary: 'vocab', kanji: 'kanji', grammar: 'grammar' };
export const TYPE_ICON = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };
export const ITEM_UNIT = { vocabulary: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };
export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const LEVEL_BG = {
  N5: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  N4: 'bg-gradient-to-br from-sky-400 to-sky-600',
  N3: 'bg-gradient-to-br from-violet-400 to-violet-600',
  N2: 'bg-gradient-to-br from-orange-400 to-orange-600',
  N1: 'bg-gradient-to-br from-red-400 to-red-600',
};
export const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

export function PostPreviewCard({ type, form, base }) {
  const post = {
    title: form.title || '(Chưa có tiêu đề)',
    level: form.level,
    topic: form.topic,
    item_count: base?.item_count ?? 0,
    view_count: base?.view_count ?? 0,
    creator_name: base?.creator_name || 'Bạn',
  };
  const headerIcon = post.topic ? (TOPIC_ICONS[post.topic] || TYPE_ICON[type]) : TYPE_ICON[type];
  return (
    <div className="rounded-2xl overflow-hidden glass-card border border-outline/30 w-56 shadow-lg">
      <div className={`h-28 flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
        <span className="material-symbols-outlined text-5xl text-white/90">{headerIcon}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-charcoal text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{post.title}</h3>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
          {post.topic && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.topic}</span>}
          <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-on-muted">
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-sm">person</span>{post.creator_name}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm">visibility</span>{post.view_count}
          </span>
        </div>
      </div>
    </div>
  );
}

export function VocabPreviewEditor({ items, idx, setIdx, onItemSaved }) {
  const item = items[idx];
  const [kanji, setKanji]     = useState(item.kanji || '');
  const [reading, setReading] = useState(item.reading || '');
  const [meaning, setMeaning] = useState(item.meaning_vi || '');
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setKanji(item.kanji || '');
    setReading(item.reading || '');
    setMeaning(item.meaning_vi || '');
  }, [item.id]);

  const save = async (patch) => {
    setSaving(true);
    try {
      await api.put(`/teacher/vocabulary/${item.id}`, patch);
      onItemSaved(item.id, patch);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const up = await api.post('/teacher/vocabulary/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await save({ image_url: up.data.url });
    } catch (e2) { alert(e2.message); setSaving(false); }
  };

  const fieldClass = 'w-full text-center bg-transparent border-b border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors';

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="rounded-2xl overflow-hidden glass-card border border-outline/30">
        <div className="h-56 relative flex items-center justify-center bg-gradient-to-br from-tsubaki-red/80 to-sumire-purple/80 group">
          {item.image_url && <img src={item.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <button onClick={() => fileRef.current?.click()}
            className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-base">add_photo_alternate</span> Đổi ảnh
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        <div className="p-6 space-y-3">
          <input value={kanji} onChange={e => setKanji(e.target.value)} onBlur={() => kanji !== (item.kanji || '') && save({ kanji })}
            placeholder="Kanji (nếu có)" className={`${fieldClass} text-3xl font-bold text-charcoal py-1`} />
          <input value={reading} onChange={e => setReading(e.target.value)} onBlur={() => reading !== (item.reading || '') && save({ reading })}
            placeholder="Cách đọc" className={`${fieldClass} text-lg text-on-muted py-1`} />
          <input value={meaning} onChange={e => setMeaning(e.target.value)} onBlur={() => meaning !== (item.meaning_vi || '') && save({ meaning_vi: meaning })}
            placeholder="Nghĩa tiếng Việt" className={`${fieldClass} text-lg font-medium text-tsubaki-red py-1`} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-on-muted hover:bg-surface-low disabled:opacity-30 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
        </button>
        <span className="text-sm text-on-muted">{idx + 1} / {items.length}{saving ? ' · đang lưu…' : ''}</span>
        <button onClick={() => setIdx(i => Math.min(items.length - 1, i + 1))} disabled={idx === items.length - 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-on-muted hover:bg-surface-low disabled:opacity-30 transition-colors">
          Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

const SEARCH_ENDPOINT = { vocabulary: '/vocabulary', kanji: '/kanji', grammar: '/grammar-points' };
const ITEM_LABEL = (type, item) => type === 'kanji' ? item.character : type === 'grammar' ? item.title : (item.kanji || item.reading);
const ITEM_SUB   = (type, item) => type === 'grammar' ? item.meaning_vi : item.meaning_vi;

export function VocabImageEdit({ item, onUpdated }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const up = await api.post('/teacher/vocabulary/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.put(`/teacher/vocabulary/${item.id}`, { image_url: up.data.url });
      onUpdated();
    } catch (e2) { alert(e2.message); }
    finally { setUploading(false); }
  };

  return (
    <>
      <button onClick={() => inputRef.current?.click()} disabled={uploading} title="Đổi ảnh minh họa"
        className="p-1 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors disabled:opacity-40">
        {item.image_url
          ? <img src={item.image_url} alt="" className="w-6 h-6 rounded object-cover" />
          : <span className="material-symbols-outlined text-lg">add_photo_alternate</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </>
  );
}

export function ItemPickerContent({ post, listType, onChanged }) {
  const [detail, setDetail]     = useState(null);
  const [search, setSearch]     = useState('');
  const [results, setResults]   = useState([]);
  const [alert, setAlert]       = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!post) return;
    const r = await api.get(`/study-lists/${post.id}`);
    setDetail(r.data);
  }, [post]);

  useEffect(() => {
    loadDetail();
    setSearch('');
    setResults([]);
    setAlert('');
  }, [loadDetail]);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    const r = await api.get(`${SEARCH_ENDPOINT[listType]}?search=${encodeURIComponent(search)}&limit=10`);
    setResults(r.data.data || []);
  };

  const addItem = async (item_id) => {
    try {
      await api.post(`/study-lists/${post.id}/items`, { item_id });
      await loadDetail();
      onChanged();
    } catch (e) { setAlert(e.message); }
  };

  const removeItem = async (item_id) => {
    try {
      await api.delete(`/study-lists/${post.id}/items/${item_id}`);
      await loadDetail();
      onChanged();
    } catch (e) { setAlert(e.message); }
  };

  const currentIds = new Set((detail?.items || []).map(i => i.id));

  return (
    <>
      <div className="space-y-4">
        {alert && <Alert type="error" onClose={() => setAlert('')}>{alert}</Alert>}

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span>
            Nhập file / JSON
          </Button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm để thêm vào danh sách..."
            className="flex-1 px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
          <Button type="submit" size="sm">Tìm</Button>
        </form>

        {results.length > 0 && (
          <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-40 overflow-y-auto">
            {results.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><strong>{ITEM_LABEL(listType, item)}</strong> — {ITEM_SUB(listType, item)}</span>
                {currentIds.has(item.id) ? (
                  <span className="text-xs text-on-muted">Đã thêm</span>
                ) : (
                  <button onClick={() => addItem(item.id)} className="text-tsubaki-red text-xs font-semibold hover:underline">+ Thêm</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-on-muted mb-2">Đang có {detail?.items?.length || 0} mục:</p>
          {!detail?.items?.length ? (
            <p className="text-sm text-on-muted">Chưa có mục nào — tìm và thêm ở trên.</p>
          ) : (
            <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-56 overflow-y-auto">
              {detail.items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span><strong>{ITEM_LABEL(listType, item)}</strong> — {ITEM_SUB(listType, item)}</span>
                  <div className="flex items-center gap-1">
                    {listType === 'vocabulary' && <VocabImageEdit item={item} onUpdated={loadDetail} />}
                    <button onClick={() => removeItem(item.id)} className="text-on-muted hover:text-error p-1">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type={TYPE_TO_IMPORT[listType]}
        studyListId={post?.id}
        onImported={async () => {
          await loadDetail();
          onChanged();
          setImportOpen(false);
        }}
      />
    </>
  );
}
