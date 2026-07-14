import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import FuriganaText from '../../components/ui/FuriganaText';
import WorksheetPreview from '../../components/kanji/WorksheetPreview';
import ImportFileModal from '../../components/admin/ImportFileModal';
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

function NumberBadge({ n }) {
  return (
    <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-charcoal/80 text-white text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

function RemoveBadge({ onRemove }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
      title="Xóa khỏi bài đăng"
      className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/90 text-on-muted hover:text-error hover:bg-white flex items-center justify-center shadow-sm transition-colors"
    >
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  );
}

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
  // grammar — thẻ gọn, bấm vào mở trang chi tiết riêng (URL thật, back trình duyệt hoạt động đúng)
  return (
    <div className="relative">
      {editable && <RemoveBadge onRemove={onRemove} />}
      <Link
        to={`/study-lists/${type}/${postId}/${item.id}`}
        className="relative glass-card rounded-2xl p-5 pt-8 block hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all"
      >
        <NumberBadge n={index + 1} />
        <p className="text-xl font-bold text-tsubaki-red">{item.title}</p>
        {item.title_ja && <p className="text-sm text-on-muted">{item.title_ja}</p>}
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        <div className="flex items-center justify-between mt-3">
          {item.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
          <span className="flex items-center gap-1 text-xs text-tsubaki-red font-semibold ml-auto">
            Xem chi tiết <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

// Xem từng từ một, giống bố cục thẻ tra từ tham khảo: ảnh/icon minh họa, từ +
// đọc, nghĩa, ví dụ có thể mở rộng, thanh tiến trình và nút Trước/Tiếp theo.
// editable=true (chủ bài đăng hoặc admin) cho phép sửa kanji/đọc/nghĩa/ảnh
// ngay trên chính trang này, không cần qua modal riêng.
function VocabWordViewer({ items, topic, editable, onItemSaved, onItemRemoved }) {
  const [levelFilter, setLevelFilter] = useState('');
  const [idx, setIdx] = useState(0);
  const [showExample, setShowExample] = useState(false);

  // Chỉ hiện các cấp độ thực sự có mặt trong bài — 1 chủ đề thường có từ ở
  // nhiều cấp độ khác nhau, lọc cấp độ nằm ở đây thay vì ngoài trang duyệt.
  const availableLevels = ['N5', 'N4', 'N3', 'N2', 'N1'].filter(l => items.some(it => it.level === l));
  const filtered = levelFilter ? items.filter(it => it.level === levelFilter) : items;

  // Danh sách bên trái luôn sắp N5 → N1 (từ chưa gắn cấp độ xếp cuối) — thứ tự
  // này cũng là thứ tự duyệt Trước/Tiếp theo để nhất quán với danh sách.
  const LEVEL_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
  const sorted = [...filtered].sort((a, b) => (LEVEL_ORDER[a.level] ?? 5) - (LEVEL_ORDER[b.level] ?? 5));

  useEffect(() => { setIdx(0); }, [levelFilter]);
  useEffect(() => { if (idx >= sorted.length) setIdx(Math.max(0, sorted.length - 1)); }, [sorted.length]);

  const item = sorted[idx] || sorted[0];
  const total = sorted.length;
  const icon = (topic && TOPIC_ICONS[topic]) || 'translate';

  const [kanji, setKanji]     = useState(item?.kanji || '');
  const [reading, setReading] = useState(item?.reading || '');
  const [meaning, setMeaning] = useState(item?.meaning_vi || '');
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    setShowExample(false);
    setKanji(item.kanji || '');
    setReading(item.reading || '');
    setMeaning(item.meaning_vi || '');
  }, [idx, item?.id]);

  if (!item) return <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Không còn từ nào ở bộ lọc này.</div>;

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

  const editInputClass = 'w-full text-center bg-transparent border-b border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors';

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
      {/* Danh sách từ vựng bên trái — sắp theo cấp độ N5 → N1, bấm để nhảy tới từ đó */}
      <aside className="lg:w-64 shrink-0">
        <div className="glass-card rounded-2xl p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto scrollbar-thin">
          <p className="px-2 py-1.5 text-xs font-semibold text-on-muted uppercase tracking-wide">Danh sách từ ({total})</p>
          <div className="space-y-0.5">
            {sorted.map((it, i) => (
              <div
                key={it.id}
                className={`flex items-center gap-1 rounded-lg ${i === idx ? 'bg-tsubaki-red/10' : 'hover:bg-surface-low'} transition-colors`}
              >
                <button
                  onClick={() => setIdx(i)}
                  className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 text-sm text-left ${i === idx ? 'text-tsubaki-red font-semibold' : 'text-on-muted'}`}
                >
                  <span className="truncate">{it.kanji || it.reading}</span>
                  {it.level && <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[it.level] || 'bg-surface-low text-on-muted'}`}>{it.level}</span>}
                </button>
                {editable && (
                  <button onClick={() => onItemRemoved(it.id)} title="Xóa khỏi bài đăng"
                    className="shrink-0 w-6 h-6 mr-1 rounded-full flex items-center justify-center text-on-muted hover:text-error hover:bg-error/10 transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 max-w-xl mx-auto lg:mx-0 w-full">
      {availableLevels.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <button onClick={() => setLevelFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!levelFilter ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
            Tất cả
          </button>
          {availableLevels.map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${levelFilter === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className={`h-64 relative flex items-center justify-center overflow-hidden ${item.image_url ? '' : 'bg-gradient-to-br from-tsubaki-red/80 to-sumire-purple/80'} ${editable ? 'group' : ''}`}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.kanji || item.reading} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-7xl text-white/90">{icon}</span>
          )}
          {editable && (
            <>
              <button onClick={() => fileRef.current?.click()}
                className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-base">add_photo_alternate</span> Đổi ảnh
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </>
          )}
        </div>
        <div className="p-6 text-center">
          {editable ? (
            <>
              <input value={kanji} onChange={e => setKanji(e.target.value)} onBlur={() => kanji !== (item.kanji || '') && save({ kanji })}
                placeholder="Kanji (nếu có)" className={`${editInputClass} text-3xl font-bold text-charcoal py-1`} />
              <input value={reading} onChange={e => setReading(e.target.value)} onBlur={() => reading !== (item.reading || '') && save({ reading })}
                placeholder="Cách đọc" className={`${editInputClass} text-base text-on-muted mt-1 py-1`} />
              <input value={meaning} onChange={e => setMeaning(e.target.value)} onBlur={() => meaning !== (item.meaning_vi || '') && save({ meaning_vi: meaning })}
                placeholder="Nghĩa tiếng Việt" className={`${editInputClass} text-lg font-medium text-tsubaki-red mt-3 py-1`} />
              {saving && <p className="text-xs text-on-muted mt-2">Đang lưu…</p>}
            </>
          ) : (
            <>
              <FuriganaText text={item.kanji || item.reading} textClassName="text-3xl font-bold text-charcoal" />
              {item.kanji && <p className="text-base text-on-muted mt-1">{item.reading}</p>}
              <p className="text-lg font-medium text-tsubaki-red mt-3">{item.meaning_vi}</p>
              {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
            </>
          )}

          {item.example_sentence && (
            <div className="mt-4">
              {!showExample ? (
                <button onClick={() => setShowExample(true)} className="text-sm text-tsubaki-red font-semibold hover:underline">
                  Xem ví dụ
                </button>
              ) : (
                <p className="text-sm text-on-muted italic bg-surface-low rounded-xl px-4 py-3">
                  「<FuriganaText text={item.example_sentence} textClassName="text-sm italic" />」
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {editable && (
        <div className="mt-4">
          <button onClick={() => onItemRemoved(item.id)}
            className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-outline text-xs text-on-muted hover:border-error hover:text-error transition-colors">
            <span className="material-symbols-outlined text-base">delete</span> Xóa từ này khỏi bài đăng
          </button>
        </div>
      )}

      <div className="h-1.5 bg-surface-low rounded-full mt-4 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <p className="text-center text-xs text-on-muted mt-1">{idx + 1} / {total}</p>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
        </button>
        <button
          onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
          disabled={idx === total - 1}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-semibold hover:opacity-90 disabled:opacity-30 transition-colors"
        >
          Tiếp theo <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
      </div>
    </div>
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
    <section className="mb-4 bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden">
      <button onClick={openPanel} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-low/40 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">edit_note</span>
          </span>
          <div>
            <h3 className="font-semibold text-on-surface text-sm">Thông tin bài đăng</h3>
            <p className="text-xs text-on-muted">Tiêu đề, chủ đề, cấp độ, mô tả</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-muted transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-outline/10 pt-4 space-y-4">
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
        </div>
      )}
    </section>
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
    <section className="mb-6 bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-low/40 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">playlist_add</span>
          </span>
          <div>
            <h3 className="font-semibold text-on-surface text-sm">Quản lý mục</h3>
            <p className="text-xs text-on-muted">Tìm & thêm mục có sẵn, hoặc nhập file/JSON hàng loạt</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-muted transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-outline/10 pt-4 space-y-4">
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
        </div>
      )}

      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type={TYPE_TO_IMPORT[post.list_type]}
        studyListId={post.id}
        onImported={async () => { await onChanged(); setImportOpen(false); }}
      />
    </section>
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
            <VocabWordViewer items={post.items} topic={post.topic} editable={canEdit} onItemSaved={handleItemSaved} onItemRemoved={handleItemRemoved} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {post.items.map((item, i) => (
                  <ItemCard key={item.id} item={item} listType={post.list_type} index={i} type={type} postId={id}
                    editable={canEdit} onRemove={() => handleItemRemoved(item.id)} />
                ))}
              </div>

              {type === 'kanji' && (
                <div className="mt-8 flex justify-center">
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
    </StudentLayout>
  );
}
