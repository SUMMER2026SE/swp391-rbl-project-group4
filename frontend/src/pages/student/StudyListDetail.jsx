import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import FuriganaText from '../../components/ui/FuriganaText';
import KanjiCanvas from '../../components/kanji/KanjiCanvas';
import WorksheetPreview from '../../components/kanji/WorksheetPreview';
import ImportFileModal from '../../components/admin/ImportFileModal';
import CollapsibleSection from '../../components/shared/CollapsibleSection';
import GrammarItemCard, { NumberBadge, RemoveBadge } from '../../components/shared/GrammarItemCard';
import VocabWordViewer from '../../components/shared/VocabWordViewer';
import { downloadWorksheetPDF } from '../../lib/kanjiWorksheet';
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
      editable={editable} onRemove={onRemove} />
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
  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

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
  const scoreColor = (s) => s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#ae2826';
  const scoreBg    = (s) => s >= 80 ? '#f0fdf4' : s >= 50 ? '#fffbeb' : '#fdf2f2';

  const canvasRef = useRef(null);
  const [writingOpen,  setWritingOpen]  = useState(false);
  const [writeQueue,   setWriteQueue]   = useState([]);
  const [writeIdx,     setWriteIdx]     = useState(0);
  const [showGuide,    setShowGuide]    = useState(true);
  const [brush,        setBrush]        = useState(14);
  const [strokeCount,  setStrokeCount]  = useState(0);
  const [scoring,      setScoring]      = useState(false);
  const [scoreResult,  setScoreResult]  = useState(null);
  const [scoreErr,     setScoreErr]     = useState('');

  const openWriting = () => {
    setWriteQueue((post?.items || []).map(item => ({
      char: item.character,
      reading_on:  item.reading_on  || [],
      reading_kun: item.reading_kun || [],
      meaning_vi:  item.meaning_vi  || '',
    })));
    setWriteIdx(0);
    setScoreResult(null);
    setScoreErr('');
    setStrokeCount(0);
    setWritingOpen(true);
  };

  const removeFromQueue = (i) => {
    setScoreResult(null);
    setScoreErr('');
    setWriteQueue(q => {
      const next = q.filter((_, j) => j !== i);
      setWriteIdx(idx => i < idx ? idx - 1 : i === idx ? Math.min(idx, next.length - 1) : idx);
      return next;
    });
  };

  const handleWriteCount = useCallback((c) => {
    setStrokeCount(c);
    setScoreResult(null);
    setScoreErr('');
  }, []);

  const handleWriteScore = async () => {
    const img = canvasRef.current?.getImage();
    if (!img || !writeQueue[writeIdx]) return;
    setScoring(true); setScoreErr(''); setScoreResult(null);
    try {
      const r = await api.post('/kanji/score-writing', { image: img, character: writeQueue[writeIdx].char });
      setScoreResult(r.data);
    } catch (e) { setScoreErr(e.response?.data?.error || 'Không chấm được, thử lại.'); }
    finally { setScoring(false); }
  };

  const handleItemRemoved = async (itemId) => {
    if (!confirm('Xóa mục này khỏi bài đăng?')) return;
    try {
      await api.delete(`/study-lists/${id}/items/${itemId}`);
      setPost(p => ({ ...p, items: p.items.filter(it => it.id !== itemId) }));
    } catch (e) { setError(e.message); }
  };

  const [showPdf, setShowPdf]       = useState(false);
  const [pdfList, setPdfList]       = useState([]);
  const [boxSize, setBoxSize]       = useState(68);
  const [guideCount, setGuideCount] = useState(3);
  const [downloading, setDownloading] = useState(false);

  const openPdf = (items) => {
    setPdfList(items.map(item => ({
      char: item.character,
      reading_on:  item.reading_on  || [],
      reading_kun: item.reading_kun || [],
      meaning_vi:  item.meaning_vi  || '',
      han_viet:    item.han_viet    || '',
    })));
    setShowPdf(true);
  };

  useEffect(() => {
    setLoading(true);
    loadPost().catch(e => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
            />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {post.items.map((item, i) => (
                  <ItemCard key={item.id} item={item} listType={post.list_type} index={i} type={type} postId={id}
                    editable={canEdit} onRemove={() => handleItemRemoved(item.id)} />
                ))}
              </div>

              {type === 'kanji' && (
                <div className="mt-8 flex justify-center gap-3">
                  <Button variant="secondary" onClick={openWriting}>
                    <span className="material-symbols-outlined text-lg">draw</span>
                    Luyện viết
                  </Button>
                  <Button onClick={() => openPdf(post.items)}>
                    <span className="material-symbols-outlined text-lg">article</span>
                    Tạo PDF luyện viết
                  </Button>
                </div>
              )}

              {type === 'kanji' && showPdf && (
                <div className="mt-6 glass-card rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-base">Bộ luyện viết PDF</h2>
                    <button onClick={() => setShowPdf(false)} className="text-on-muted hover:text-charcoal">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Danh sách kanji — X để xóa khỏi PDF */}
                  <div className="flex flex-wrap gap-1.5">
                    {pdfList.map((k, i) => (
                      <div key={i} className="relative group">
                        <div className="w-10 h-10 rounded-lg border border-outline bg-surface text-xl flex items-center justify-center">
                          {k.char}
                        </div>
                        <button
                          onClick={() => setPdfList(l => l.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {pdfList.length === 0 ? (
                    <p className="text-sm text-on-muted text-center py-4">Không còn kanji nào — thêm lại bằng cách nhấn "Tạo PDF luyện viết".</p>
                  ) : (
                    <>
                      {/* Cài đặt */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <label className="flex items-center gap-2 text-sm">Cỡ ô
                          <select value={boxSize} onChange={e => setBoxSize(Number(e.target.value))}
                            className="px-2 py-1 border border-outline rounded-lg text-sm">
                            <option value={56}>Nhỏ</option>
                            <option value={68}>Vừa</option>
                            <option value={84}>Lớn</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-sm">Ô chữ mờ
                          <select value={guideCount} onChange={e => setGuideCount(Number(e.target.value))}
                            className="px-2 py-1 border border-outline rounded-lg text-sm">
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={0}>Không</option>
                          </select>
                        </label>
                        <div className="ml-auto">
                          <Button
                            loading={downloading}
                            onClick={async () => {
                              setDownloading(true);
                              try {
                                await downloadWorksheetPDF('ws-print', `luyen-viet-${post.title}.pdf`);
                              } finally { setDownloading(false); }
                            }}>
                            <span className="material-symbols-outlined text-lg">download</span> Tải PDF
                          </Button>
                        </div>
                      </div>

                      {/* Preview */}
                      <WorksheetPreview list={pdfList} boxSize={boxSize} guideCount={guideCount} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      {/* ── Modal luyện viết Kanji ──────────────────────────────────────────── */}
      {writingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline/40 shrink-0">
              <h2 className="font-display font-bold text-lg">Luyện viết Kanji</h2>
              <button onClick={() => setWritingOpen(false)} className="text-on-muted hover:text-charcoal">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Queue chips */}
              {writeQueue.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {writeQueue.map((k, i) => (
                    <div key={i} className="relative group">
                      <button
                        onClick={() => { setWriteIdx(i); setScoreResult(null); setScoreErr(''); }}
                        className={`w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-all ${i === writeIdx ? 'border-tsubaki-red bg-tsubaki-red/10 text-tsubaki-red ring-2 ring-tsubaki-red/20' : 'border-outline hover:bg-surface-low'}`}>
                        {k.char}
                      </button>
                      <button
                        onClick={() => removeFromQueue(i)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {writeQueue.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">check_circle</span>
                  <p className="font-semibold mb-1">Đã bỏ qua hết!</p>
                  <p className="text-on-muted text-sm">Không còn kanji nào trong danh sách.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-on-muted flex flex-wrap justify-center gap-x-3 min-h-[1rem]">
                    {writeQueue[writeIdx]?.reading_on?.length > 0 && <span>On: <b className="text-charcoal">{writeQueue[writeIdx].reading_on.join('、')}</b></span>}
                    {writeQueue[writeIdx]?.reading_kun?.length > 0 && <span>Kun: <b className="text-charcoal">{writeQueue[writeIdx].reading_kun.join('、')}</b></span>}
                    {writeQueue[writeIdx]?.meaning_vi && <span>Nghĩa: <b className="text-charcoal">{writeQueue[writeIdx].meaning_vi}</b></span>}
                  </p>

                  <div className="flex justify-center">
                    <KanjiCanvas ref={canvasRef} char={writeQueue[writeIdx]?.char} showGuide={showGuide} brush={brush} onCount={handleWriteCount} />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={showGuide} onChange={e => setShowGuide(e.target.checked)} className="accent-tsubaki-red" /> Chữ mờ
                    </label>
                    <label className="flex items-center gap-2 text-sm">Cỡ nét
                      <input type="range" min="6" max="28" value={brush} onChange={e => setBrush(Number(e.target.value))} className="accent-tsubaki-red w-24" />
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <Button onClick={handleWriteScore} loading={scoring} disabled={strokeCount === 0}>
                      <span className="material-symbols-outlined text-lg">auto_awesome</span> Chấm điểm AI
                    </Button>
                    {strokeCount === 0 && !scoreResult && <p className="text-xs text-on-muted">Vẽ chữ trước rồi bấm chấm điểm.</p>}
                  </div>

                  {scoreErr && <p className="text-sm text-tsubaki-red text-center">{scoreErr}</p>}

                  {scoreResult && (
                    <div className="rounded-2xl border p-4"
                      style={{ borderColor: scoreResult.similarity != null ? scoreColor(scoreResult.similarity) + '44' : '#e5e7eb', background: scoreResult.similarity != null ? scoreBg(scoreResult.similarity) : '#f9fafb' }}>
                      {scoreResult.similarity != null && (
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className="text-sm text-on-muted">Độ giống</span>
                          <span className="text-4xl font-display font-bold" style={{ color: scoreColor(scoreResult.similarity) }}>{scoreResult.similarity}%</span>
                        </div>
                      )}
                      {scoreResult.comment && <p className="text-sm text-center text-charcoal mb-2">{scoreResult.comment}</p>}
                      {scoreResult.errors?.length > 0 && (
                        <ul className="space-y-1 mt-1">
                          {scoreResult.errors.map((e, i) => (
                            <li key={i} className="text-sm text-charcoal flex gap-1.5">
                              <span className="material-symbols-outlined text-base text-tsubaki-red shrink-0">close</span>{e}
                            </li>
                          ))}
                        </ul>
                      )}
                      {scoreResult.similarity != null && !scoreResult.errors?.length && (
                        <p className="text-sm text-center text-emerald-600 flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-lg">check_circle</span> Viết tốt, không có lỗi!
                        </p>
                      )}
                    </div>
                  )}

                  {writeQueue.length > 1 && (
                    <div className="flex items-center justify-center gap-4">
                      <Button variant="secondary" onClick={() => { setWriteIdx(i => Math.max(0, i - 1)); setScoreResult(null); setScoreErr(''); }} disabled={writeIdx === 0}>← Trước</Button>
                      <span className="text-sm text-on-muted">{writeIdx + 1}/{writeQueue.length}</span>
                      <Button variant="secondary" onClick={() => { setWriteIdx(i => Math.min(writeQueue.length - 1, i + 1)); setScoreResult(null); setScoreErr(''); }} disabled={writeIdx === writeQueue.length - 1}>Sau →</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
