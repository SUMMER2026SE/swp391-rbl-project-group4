import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import api from '../../lib/api';
import { TOPICS, TOPIC_ICONS } from '../../lib/studyListTopics';

const TYPE_TO_IMPORT = { vocabulary: 'vocab', kanji: 'kanji', grammar: 'grammar' };

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];
const TYPE_ICON = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };
const ITEM_UNIT = { vocabulary: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LEVEL_BG = {
  N5: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  N4: 'bg-gradient-to-br from-sky-400 to-sky-600',
  N3: 'bg-gradient-to-br from-violet-400 to-violet-600',
  N2: 'bg-gradient-to-br from-orange-400 to-orange-600',
  N1: 'bg-gradient-to-br from-red-400 to-red-600',
};
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

function PostPreviewCard({ type, form, base }) {
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

function VocabPreviewEditor({ items, idx, setIdx, onItemSaved }) {
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

function VocabImageEdit({ item, onUpdated }) {
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

function ItemPickerContent({ post, listType, onChanged }) {
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

export default function TeacherStudyLists() {
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Modal — chỉ dùng cho tạo mới
  const [modal, setModal]     = useState(false);
  const [editTab, setEditTab] = useState('info');
  const [form, setForm]       = useState({ title: '', description: '', level: '', topic: '' });
  const [editId, setEditId]   = useState(null);
  const [editPost, setEditPost] = useState(null);
  const [previewBase, setPreviewBase]   = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewIdx, setPreviewIdx]     = useState(0);
  const [saving, setSaving] = useState(false);

  // Accordion — dùng cho chỉnh sửa
  const [expandedId, setExpandedId]         = useState(null);
  const [accTab, setAccTab]                 = useState('info');
  const [accForm, setAccForm]               = useState({ title: '', description: '', level: '', topic: '' });
  const [accPost, setAccPost]               = useState(null);
  const [accPreviewBase, setAccPreviewBase] = useState(null);
  const [accPreviewItems, setAccPreviewItems] = useState([]);
  const [accPreviewIdx, setAccPreviewIdx]   = useState(0);
  const [accSaving, setAccSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/study-lists?type=${type}&mine=true&limit=100`);
      setItems(r.data.data || []);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  /* ── Tạo mới (modal) ── */
  const openCreate = () => {
    setExpandedId(null);
    setForm({ title: '', description: '', level: '', topic: '' });
    setEditId(null); setEditPost(null); setPreviewBase(null); setPreviewItems([]); setPreviewIdx(0);
    setEditTab('info');
    setModal(true);
  };

  const handlePreviewItemSaved = (itemId, patch) => {
    setPreviewItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (type === 'vocabulary') {
      if (!form.topic) return setAlert({ type: 'error', msg: 'Vui lòng chọn chủ đề.' });
    } else if (!form.level) {
      return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    }
    setSaving(true);
    try {
      const r = await api.post('/study-lists', { list_type: type, title: form.title, description: form.description, level: form.level || null, topic: form.topic || null });
      setEditId(r.data.id);
      setEditPost(r.data);
      setPreviewBase(r.data);
      setEditTab('items');
      await load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  /* ── Chỉnh sửa (accordion) ── */
  const toggleAccordion = async (post) => {
    if (expandedId === post.id) { setExpandedId(null); return; }
    setModal(false);
    setExpandedId(post.id);
    setAccForm({ title: post.title, description: post.description || '', level: post.level || '', topic: post.topic || '' });
    setAccPost(post);
    setAccPreviewBase(post);
    setAccTab('info');
    setAccPreviewIdx(0);
    if (type === 'vocabulary') {
      try {
        const r = await api.get(`/study-lists/${post.id}`);
        setAccPreviewItems(r.data.items || []);
      } catch { setAccPreviewItems([]); }
    } else {
      setAccPreviewItems([]);
    }
  };

  const handleAccPreviewItemSaved = (itemId, patch) => {
    setAccPreviewItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it));
  };

  const handleAccSave = async () => {
    if (!accForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (type === 'vocabulary') {
      if (!accForm.topic) return setAlert({ type: 'error', msg: 'Vui lòng chọn chủ đề.' });
    } else if (!accForm.level) {
      return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    }
    setAccSaving(true);
    try {
      await api.put(`/study-lists/${accPost.id}`, { title: accForm.title, description: accForm.description, level: accForm.level || null, topic: accForm.topic || null });
      setExpandedId(null);
      await load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setAccSaving(false); }
  };

  /* ── Xoá ── */
  const handleDelete = async (post) => {
    if (!confirm(`Xóa bài đăng "${post.title}"?`)) return;
    try { await api.delete(`/study-lists/${post.id}`); load(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  return (
    <TeacherLayout title="Bài đăng danh sách">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng danh sách</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {TYPES.map(([key, icon, label]) => (
            <button key={key} onClick={() => { setType(key); setExpandedId(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${type === key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Tạo bài đăng</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">library_books</span>
          <p className="text-lg font-semibold text-charcoal mb-1">Bạn chưa tạo bài đăng nào cho mục này</p>
          <p className="text-sm">Bấm "Tạo bài đăng" để bắt đầu</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-outline/40">
          {items.map(post => {
            const isOpen = expandedId === post.id;
            return (
              <div key={post.id}>
                {/* ── Accordion header ── */}
                <div
                  onClick={() => toggleAccordion(post)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer select-none transition-colors ${isOpen ? 'bg-tsubaki-red/5' : 'hover:bg-surface-low/50'}`}
                >
                  {/* Level color bar */}
                  <div className={`w-1 h-11 rounded-full shrink-0 ${LEVEL_BG[post.level] || 'bg-gradient-to-b from-slate-300 to-slate-400'}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-charcoal text-sm truncate flex items-center gap-1.5">
                      {post.title}
                      {post.is_locked && (
                        <span title={post.lock_note ? `Quản trị viên yêu cầu sửa: ${post.lock_note}` : 'Quản trị viên đã khóa bài đăng này'} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-error text-[10px] font-bold shrink-0">
                          <span className="material-symbols-outlined text-[12px]">lock</span>CẦN SỬA
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
                      {post.topic && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{post.topic}</span>}
                      <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
                      <span className="flex items-center gap-0.5 text-xs text-on-muted">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>{post.view_count}
                      </span>
                    </div>
                    {post.is_locked && post.lock_note && (
                      <p className="text-xs text-error truncate mt-1">Lý do: {post.lock_note}</p>
                    )}
                  </div>

                  {/* Actions — stopPropagation để không toggle accordion */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Link to={`/study-lists/${type}/${post.id}`} title="Xem trang"
                      className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                      <span className="material-symbols-outlined text-lg">visibility</span>
                    </Link>
                    <button onClick={() => handleDelete(post)} title="Xóa"
                      className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>

                  {/* Chevron */}
                  <span className={`material-symbols-outlined text-on-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>

                {/* ── Accordion body ── */}
                {isOpen && (
                  <div className="border-t border-outline/40 bg-surface-low/20 px-6 py-5">
                    {/* Tabs */}
                    <div className="flex border-b border-outline/40 mb-5">
                      {[['info', 'Thông tin'], ['items', 'Quản lý mục']].map(([tab, label]) => (
                        <button key={tab} onClick={() => setAccTab(tab)}
                          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${accTab === tab ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Thông tin */}
                    {accTab === 'info' && (
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1 space-y-4 min-w-0">
                          <Input label="Tiêu đề *" value={accForm.title} onChange={e => setAccForm({ ...accForm, title: e.target.value })}
                            placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
                          <div className="flex flex-col gap-4">
                            <div className={type === 'vocabulary' ? 'order-2' : 'order-1'}>
                              <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{type === 'vocabulary' ? '' : ' *'}</label>
                              <select value={accForm.level} onChange={e => setAccForm({ ...accForm, level: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                                <option value="">-- Chọn cấp độ --</option>
                                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                              {type === 'vocabulary' && (
                                <p className="text-xs text-on-muted mt-1">Không bắt buộc — 1 chủ đề thường có từ ở nhiều cấp độ, cấp độ sẽ lọc bên trong khi xem từng từ.</p>
                              )}
                            </div>
                            <div className={type === 'vocabulary' ? 'order-1' : 'order-2'}>
                              <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{type === 'vocabulary' ? ' *' : ''}</label>
                              <select value={accForm.topic} onChange={e => setAccForm({ ...accForm, topic: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                                <option value="">-- Không chọn --</option>
                                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          </div>
                          <Input label="Mô tả" value={accForm.description} onChange={e => setAccForm({ ...accForm, description: e.target.value })} />
                        </div>
                        <div className="shrink-0 sm:w-80 sm:pl-6 sm:border-l border-outline/30 flex flex-col">
                          <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-4">
                            {type === 'vocabulary' && accPreviewItems.length > 0 ? 'Xem trước — sửa trực tiếp từng từ' : 'Xem trước'}
                          </p>
                          {type === 'vocabulary' && accPreviewItems.length > 0 ? (
                            <VocabPreviewEditor items={accPreviewItems} idx={accPreviewIdx} setIdx={setAccPreviewIdx} onItemSaved={handleAccPreviewItemSaved} />
                          ) : (
                            <div className="flex justify-center">
                              <PostPreviewCard type={type} form={accForm} base={accPreviewBase} />
                            </div>
                          )}
                          {!(type === 'vocabulary' && accPreviewItems.length > 0) && (
                            <p className="text-xs text-on-muted/60 text-center mt-3">Cập nhật theo thời gian thực</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab: Quản lý mục */}
                    {accTab === 'items' && accPost && (
                      <ItemPickerContent post={accPost} listType={type} onChanged={load} />
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline/20">
                      {accTab === 'info' ? (
                        <>
                          <Button variant="secondary" onClick={() => setExpandedId(null)}>Huỷ</Button>
                          <Button loading={accSaving} onClick={handleAccSave}>Lưu</Button>
                        </>
                      ) : (
                        <Button variant="secondary" onClick={() => setExpandedId(null)}>Đóng</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal tạo mới ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Tạo bài đăng" size="xl"
        footer={
          editTab === 'items'
            ? <Button variant="secondary" onClick={() => setModal(false)}>Đóng</Button>
            : <><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Tạo</Button></>
        }>

        {editId && (
          <div className="flex border-b border-outline/40 mb-5">
            {[['info', 'Thông tin'], ['items', 'Quản lý mục']].map(([tab, label]) => (
              <button key={tab} onClick={() => setEditTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${editTab === tab ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {editTab === 'info' && (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-4 min-w-0">
              <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
              <div className="flex flex-col gap-4">
                <div className={type === 'vocabulary' ? 'order-2' : 'order-1'}>
                  <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{type === 'vocabulary' ? '' : ' *'}</label>
                  <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                    <option value="">-- Chọn cấp độ --</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {type === 'vocabulary' && (
                    <p className="text-xs text-on-muted mt-1">Không bắt buộc — 1 chủ đề thường có từ ở nhiều cấp độ, cấp độ sẽ lọc bên trong khi xem từng từ.</p>
                  )}
                </div>
                <div className={type === 'vocabulary' ? 'order-1' : 'order-2'}>
                  <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{type === 'vocabulary' ? ' *' : ''}</label>
                  <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                    <option value="">-- Không chọn --</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <Input label="Mô tả" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="shrink-0 sm:w-80 sm:pl-6 sm:border-l border-outline/30 flex flex-col">
              <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-4">Xem trước</p>
              <div className="flex justify-center">
                <PostPreviewCard type={type} form={form} base={previewBase} />
              </div>
              <p className="text-xs text-on-muted/60 text-center mt-3">Cập nhật theo thời gian thực</p>
            </div>
          </div>
        )}

        {editTab === 'items' && editPost && (
          <ItemPickerContent post={editPost} listType={type} onChanged={load} />
        )}
      </Modal>
    </TeacherLayout>
  );
}
