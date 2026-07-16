import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import FuriganaText from '../../components/ui/FuriganaText';
import KanjiWritingPracticeModal from '../../components/kanji/KanjiWritingPracticeModal';
import KanjiPdfPanel from '../../components/kanji/KanjiPdfPanel';
import AddCardsToFlashcardModal from '../../components/reading/AddCardsToFlashcardModal';
import ImportFileModal from '../../components/admin/ImportFileModal';
import CollapsibleSection from '../../components/shared/CollapsibleSection';
import GrammarItemCard, { NumberBadge, RemoveBadge } from '../../components/shared/GrammarItemCard';
import VocabWordViewer from '../../components/shared/VocabWordViewer';
import { TOPICS, TOPIC_ICONS } from '../../lib/studyListTopics';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};
const TYPE_TO_IMPORT = { vocabulary: 'vocab', kanji: 'kanji', grammar: 'grammar' };
const SEARCH_ENDPOINT = { vocabulary: '/vocabulary', kanji: '/kanji', grammar: '/grammar-points' };
const ITEM_LABEL = (listType, item) => listType === 'kanji' ? item.character : listType === 'grammar' ? item.title : (item.kanji || item.reading);
const ITEM_SUB   = (item) => item.meaning_vi;

function ItemCard({ item, listType, index, type, postId, editable, onRemove }) {
  if (listType === 'vocabulary') {
    return (
      <div className="relative glass-card rounded-2xl p-5 pt-8 text-center">
        <NumberBadge n={index + 1} />
        {editable && <RemoveBadge onRemove={onRemove} />}
        <FuriganaText text={item.kanji || item.reading} textClassName="text-2xl font-bold text-tsubaki-red mb-1" />
        {item.kanji && <p className="text-sm text-on-muted">{item.reading}</p>}
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  if (listType === 'kanji') {
    return (
      <div className="relative glass-card rounded-2xl p-5 pt-8 text-center">
        <NumberBadge n={index + 1} />
        {editable && <RemoveBadge onRemove={onRemove} />}
        <p className="text-4xl font-bold text-tsubaki-red mb-1">{item.character}</p>
        <p className="text-xs text-on-muted">On: {(item.reading_on || []).join('、') || '—'}</p>
        <p className="text-xs text-on-muted">Kun: {(item.reading_kun || []).join('、') || '—'}</p>
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  // grammar — thẻ dùng chung với Mục ngữ pháp của khóa học
  return (
    <GrammarItemCard item={item} index={index} to={`/study-lists/${type}/${postId}/${item.id}`}
      editable={editable} onRemove={onRemove} listRow />
  );
}

// Panel "Thông tin bài đăng" — sửa tiêu đề/chủ đề/cấp độ/mô tả inline, thay
// cho popup riêng (giống panel "Thông tin khóa học" của trang sửa khóa học).
function InfoPanel({ post, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: post.title, topic: post.topic || '', level: post.level || '', description: post.description || '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isVocab = post.list_type === 'vocabulary';

  const openPanel = () => {
    setForm({ title: post.title, topic: post.topic || '', level: post.level || '', description: post.description || '' });
    setErr('');
    setOpen(o => !o);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setErr('Tiêu đề là bắt buộc.');
    if (isVocab ? !form.topic : !form.level) return setErr(isVocab ? 'Vui lòng chọn chủ đề.' : 'Vui lòng chọn cấp độ.');
    setSaving(true);
    setErr('');
    try {
      const r = await api.put(`/study-lists/${post.id}`, { title: form.title, topic: form.topic || null, level: form.level || null, description: form.description });
      onSaved(r.data);
      setOpen(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <CollapsibleSection icon="edit_note" title="Thông tin bài đăng" subtitle="Tiêu đề, chủ đề, cấp độ, mô tả"
      open={open} onToggle={openPanel} className="mb-4">
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{isVocab ? ' *' : ''}</label>
        <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
          <option value="">-- Không chọn --</option>
          {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{isVocab ? '' : ' *'}</label>
        <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
          <option value="">-- Chọn cấp độ --</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả</label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
        <Button loading={saving} onClick={handleSave}>Lưu thông tin</Button>
      </div>
    </CollapsibleSection>
  );
}

// Panel "Quản lý mục" — tìm & thêm mục có sẵn, hoặc nhập file/JSON hàng loạt.
// Xóa mục thì làm ngay trên danh sách/thẻ hiển thị bên dưới (nút X).
function ManagePanel({ post, onChanged }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [err, setErr] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const currentIds = new Set((post.items || []).map(i => i.id));

  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const r = await api.get(`${SEARCH_ENDPOINT[post.list_type]}?search=${encodeURIComponent(search)}&limit=10`);
      setResults(r.data.data || []);
    } catch (e2) { setErr(e2.message); }
  };

  const addItem = async (item_id) => {
    try {
      await api.post(`/study-lists/${post.id}/items`, { item_id });
      await onChanged();
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <>
      <CollapsibleSection icon="playlist_add" title="Quản lý mục" subtitle="Tìm & thêm mục có sẵn, hoặc nhập file/JSON hàng loạt"
        open={open} onToggle={() => setOpen(o => !o)} className="mb-6">
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span> Nhập file / JSON
          </Button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm để thêm vào bài đăng..."
            className="flex-1 px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
          <Button type="submit" size="sm">Tìm</Button>
        </form>

        {results.length > 0 && (
          <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-48 overflow-y-auto">
            {results.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><strong>{ITEM_LABEL(post.list_type, item)}</strong> — {ITEM_SUB(item)}</span>
                {currentIds.has(item.id) ? (
                  <span className="text-xs text-on-muted">Đã có</span>
                ) : (
                  <button onClick={() => addItem(item.id)} className="text-tsubaki-red text-xs font-semibold hover:underline">+ Thêm</button>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type={TYPE_TO_IMPORT[post.list_type]}
        studyListId={post.id}
        onImported={async () => { await onChanged(); setImportOpen(false); }}
      />
    </>
  );
}

export default function StudyListDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isTeacher } = useAuth();
  const [post, setPost]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [grammarQuery, setGrammarQuery] = useState('');

  const canEdit = !!user && !!post && (user.id === post.created_by || isAdmin());

  const loadPost = () => api.get(`/study-lists/${id}`).then(r => { setPost(r.data); return r.data; });

  const handleItemSaved = (itemId, patch) => {
    setPost(p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, ...patch } : it) }));
  };

  // Lưu chỉnh sửa inline từ viewer (chủ bài đăng/admin) — endpoint của bài đăng.
  const saveVocabItem = async (itemId, patch) => {
    await api.put(`/teacher/vocabulary/${itemId}`, patch);
    handleItemSaved(itemId, patch);
  };

  const uploadVocabImage = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const up = await api.post('/teacher/vocabulary/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return up.data.url;
  };

  // ── Luyện viết ──────────────────────────────────────────────────────────────
  const [writingOpen, setWritingOpen] = useState(false);

  const handleItemRemoved = async (itemId) => {
    if (!confirm('Xóa mục này khỏi bài đăng?')) return;
    try {
      await api.delete(`/study-lists/${id}/items/${itemId}`);
      setPost(p => ({ ...p, items: p.items.filter(it => it.id !== itemId) }));
    } catch (e) { setError(e.message); }
  };

  const [showPdf, setShowPdf] = useState(false);

  // ── Thêm vào Flashcard (giống mục Luyện đọc) ─────────────────────────────────
  const [fcSelected, setFcSelected] = useState({});
  const [fcModalOpen, setFcModalOpen] = useState(false);

  useEffect(() => {
    if (post?.list_type === 'vocabulary') {
      setFcSelected(Object.fromEntries(post.items.map(it => [it.id, true])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, post?.items?.length]);

  const allVocabSelected = !!post?.items?.length && post.items.every(it => fcSelected[it.id]);
  const toggleAllVocabSelected = () => setFcSelected(
    allVocabSelected ? {} : Object.fromEntries((post?.items || []).map(it => [it.id, true]))
  );
  const toggleVocabSelected = (id) => setFcSelected(s => ({ ...s, [id]: !s[id] }));
  const vocabFlashcards = (post?.items || [])
    .filter(it => fcSelected[it.id])
    .map(it => ({
      term: it.kanji || it.reading,
      definition: it.kanji ? [it.reading, it.meaning_vi].filter(Boolean).join(' — ') : (it.meaning_vi || ''),
    }))
    .filter(c => c.term && c.definition);

  useEffect(() => {
    setLoading(true);
    loadPost().catch(e => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredGrammar = (() => {
    if (!post) return [];
    const q = grammarQuery.trim().toLowerCase();
    if (!q) return post.items;
    return post.items.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.meaning_vi || '').toLowerCase().includes(q)
    );
  })();

  return (
    <StudentLayout title="Chi tiết bài đăng">
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <button
        onClick={() => navigate(isAdmin() ? '/admin/study-lists' : isTeacher() ? '/teacher/study-lists' : `/${type}`)}
        className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại danh sách
      </button>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : !post ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted">Không tìm thấy bài đăng.</div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold mb-1">{post.title}</h1>
                {post.description && <p className="text-on-muted mb-2">{post.description}</p>}
                <div className="flex items-center gap-4 text-sm text-on-muted flex-wrap">
                  {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[post.level] || 'bg-surface-low text-on-muted'}`}>{post.level}</span>}
                  {post.topic && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.topic}</span>}
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">person</span>{post.creator_name || '—'}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">bookmarks</span>{post.items.length} mục</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">visibility</span>{post.view_count} lượt xem</span>
                </div>
              </div>
              {type === 'kanji' && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" onClick={() => setWritingOpen(true)}>
                    <span className="material-symbols-outlined text-lg">draw</span>
                    Luyện viết
                  </Button>
                  <Button onClick={() => setShowPdf(true)}>
                    <span className="material-symbols-outlined text-lg">article</span>
                    Tải PDF luyện viết
                  </Button>
                </div>
              )}
              {type === 'vocabulary' && post.items.length > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={toggleAllVocabSelected} className="text-xs font-semibold text-on-muted hover:text-tsubaki-red transition-colors">
                    {allVocabSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                  <Button size="sm" disabled={vocabFlashcards.length === 0} onClick={() => setFcModalOpen(true)}>
                    <span className="material-symbols-outlined text-[18px]">style</span>
                    Thêm vào Flashcard ({vocabFlashcards.length})
                  </Button>
                </div>
              )}
            </div>
          </div>

          {canEdit && post.is_locked && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-2xl shrink-0">lock</span>
              <div>
                <p className="font-semibold text-error text-sm">Bài đăng đang bị khóa — đã ẩn khỏi học viên</p>
                <p className="text-sm text-charcoal/80 mt-0.5">
                  {post.lock_note
                    ? <>Quản trị viên yêu cầu chỉnh sửa: <span className="font-medium">{post.lock_note}</span></>
                    : 'Quản trị viên yêu cầu chỉnh sửa nội dung. Bạn vẫn có thể sửa bài đăng bình thường bên dưới; bài sẽ tự hiện lại sau khi quản trị viên mở khóa.'}
                </p>
              </div>
            </div>
          )}

          {canEdit && (
            <>
              <InfoPanel post={post} onSaved={(updated) => setPost(p => ({ ...p, ...updated }))} />
              <ManagePanel post={post} onChanged={loadPost} />
            </>
          )}

          {post.items.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Bài đăng này chưa có mục nào.</div>
          ) : post.list_type === 'vocabulary' ? (
            <VocabWordViewer
              items={post.items}
              icon={(post.topic && TOPIC_ICONS[post.topic]) || 'translate'}
              editable={canEdit}
              saveItem={saveVocabItem}
              uploadImage={uploadVocabImage}
              onRemoveItem={canEdit ? handleItemRemoved : undefined}
              renderItemExtra={(it) => (
                <input type="checkbox" checked={!!fcSelected[it.id]}
                  onChange={() => toggleVocabSelected(it.id)} className="w-4 h-4 accent-tsubaki-red cursor-pointer" />
              )}
            />
          ) : (
            <>
              {post.list_type === 'grammar' ? (
                <div className="glass-card rounded-2xl overflow-hidden divide-y divide-outline">
                  <div className="px-4 py-2.5">
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-low rounded-xl">
                      <span className="material-symbols-outlined text-base text-on-muted">search</span>
                      <input
                        type="text"
                        placeholder="Tìm theo cấu trúc hoặc nghĩa tiếng Việt..."
                        value={grammarQuery}
                        onChange={e => setGrammarQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-on-muted"
                      />
                      {grammarQuery && (
                        <button onClick={() => setGrammarQuery('')} className="text-on-muted hover:text-charcoal">
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredGrammar.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-on-muted">Không tìm thấy kết quả.</p>
                  ) : (
                    filteredGrammar.map((item, i) => (
                      <ItemCard key={item.id} item={item} listType={post.list_type} index={i} type={type} postId={id}
                        editable={canEdit} onRemove={() => handleItemRemoved(item.id)} />
                    ))
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {post.items.map((item, i) => (
                    <ItemCard key={item.id} item={item} listType={post.list_type} index={i} type={type} postId={id}
                      editable={canEdit} onRemove={() => handleItemRemoved(item.id)} />
                  ))}
                </div>
              )}


              {type === 'kanji' && showPdf && (
                <KanjiPdfPanel
                  className="mt-6"
                  list={post.items.map(item => ({
                    char: item.character,
                    reading_on:  item.reading_on  || [],
                    reading_kun: item.reading_kun || [],
                    meaning_vi:  item.meaning_vi  || '',
                    han_viet:    item.han_viet    || '',
                  }))}
                  filename={`luyen-viet-${post.title}.pdf`}
                  onClose={() => setShowPdf(false)}
                />
              )}
            </>
          )}
        </>
      )}
      {/* ── Modal luyện viết Kanji ──────────────────────────────────────────── */}
      {writingOpen && (
        <KanjiWritingPracticeModal items={post?.items || []} onClose={() => setWritingOpen(false)} />
      )}

      {/* ── Modal thêm từ vựng đã chọn vào Flashcard ─────────────────────────── */}
      <AddCardsToFlashcardModal
        open={fcModalOpen}
        onClose={() => setFcModalOpen(false)}
        cards={vocabFlashcards}
        suggestedTitle={`Từ vựng bài đăng "${post?.title || ''}"`.slice(0, 100)}
      />
    </StudentLayout>
  );
}
