import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import CollapsibleSection from '../../components/shared/CollapsibleSection';
import LessonInfoPanel from '../../components/shared/LessonInfoPanel';
import VocabWordViewer from '../../components/shared/VocabWordViewer';
import { useConfirm, useNotify } from '../../contexts/ConfirmContext';
import api from '../../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const WORD_TYPES = ['DANH TỪ', 'ĐỘNG TỪ', 'TÍNH TỪ', 'PHÓ TỪ', 'LIÊN TỪ', 'KHÁC'];

const LEVEL_COLOR = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  kanji: '', reading: '', meaning_vi: '', meaning_ja: '',
  type: '', example_sentence: '', image_url: '',
};

// ── Vocab Form (popup thêm mới thủ công) ──────────────────────────────────────
// Nhóm trường theo khối: Từ (kanji + cách đọc) → Nghĩa (VI + JA) → Bổ sung
// (loại từ + câu ví dụ) → Ảnh minh họa. Không có field cấp độ JLPT trong ngữ
// cảnh khóa học. Sửa từ đã có thì làm inline ngay trên thẻ xem trước.

const FIELD_CLS = 'w-full px-4 py-2.5 border border-outline rounded-xl outline-none focus:border-tsubaki-red transition-colors';
const LABEL_CLS = 'block text-sm font-medium text-on-muted mb-1';
const GROUP_CLS = 'text-xs font-bold text-on-muted uppercase tracking-wider mb-2';

function VocabForm({ form, onChange, uploadImage }) {
  const notify = useNotify();
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      onChange({ ...form, image_url: await uploadImage(file) });
    } catch (err) { notify(err.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className={GROUP_CLS}>Từ vựng</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Kanji / Chữ</label>
            <input value={form.kanji} onChange={set('kanji')} placeholder="例: 会議" className={`${FIELD_CLS} text-lg`} />
          </div>
          <div>
            <label className={LABEL_CLS}>Cách đọc (Hiragana) *</label>
            <input value={form.reading} onChange={set('reading')} placeholder="例: かいぎ" className={`${FIELD_CLS} text-lg`} />
          </div>
        </div>
      </div>

      <div>
        <p className={GROUP_CLS}>Nghĩa</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Tiếng Việt *</label>
            <input value={form.meaning_vi} onChange={set('meaning_vi')} placeholder="Ý nghĩa..." className={`${FIELD_CLS} text-sm`} />
          </div>
          <div>
            <label className={LABEL_CLS}>Tiếng Nhật</label>
            <input value={form.meaning_ja} onChange={set('meaning_ja')} placeholder="意味..." className={`${FIELD_CLS} text-sm`} />
          </div>
        </div>
      </div>

      <div>
        <p className={GROUP_CLS}>Bổ sung</p>
        <div className="space-y-3">
          <div className="w-1/2 pr-1.5">
            <label className={LABEL_CLS}>Loại từ</label>
            <select value={form.type} onChange={set('type')} className={`${FIELD_CLS} text-sm`}>
              <option value="">-- Chọn --</option>
              {WORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Câu ví dụ</label>
            <textarea
              value={form.example_sentence}
              onChange={set('example_sentence')}
              rows={2}
              placeholder="例: 明日、10時から会議があります。"
              className={`${FIELD_CLS} text-sm resize-none`}
            />
          </div>
        </div>
      </div>

      <div>
        <p className={GROUP_CLS}>Ảnh minh họa</p>
        {form.image_url ? (
          <div className="relative w-full h-36 rounded-xl overflow-hidden border border-outline">
            <img src={form.image_url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange({ ...form, image_url: '' })} title="Bỏ ảnh"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full h-24 border-2 border-dashed border-outline/40 rounded-xl flex flex-col items-center justify-center gap-1 text-on-muted text-sm hover:border-tsubaki-red/50 hover:text-tsubaki-red transition-colors disabled:opacity-50">
            <span className={`material-symbols-outlined text-2xl ${uploading ? 'animate-spin' : ''}`}>
              {uploading ? 'progress_activity' : 'add_photo_alternate'}
            </span>
            {uploading ? 'Đang tải lên…' : 'Tải ảnh minh họa (tùy chọn)'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonVocabulary() {
  const confirm = useConfirm();
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]   = useState(null);
  const [vocab, setVocab]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  // Panel "Quản lý từ vựng" — mở sẵn vì các nút thêm nằm trong đó
  const [manageOpen, setManageOpen] = useState(true);

  // Modal "Nhập file"
  const [importOpen, setImportOpen] = useState(false);

  // Picker "Thêm từ thư viện"
  const [picker, setPicker]       = useState(false);
  const [pickerSearch, setSearch] = useState('');
  const [pickerLevel, setPickerLevel] = useState('');
  const [pickerList, setList]     = useState([]);
  const [pickerLoad, setPLoad]    = useState(false);
  const [selected, setSelected]   = useState({});   // { [id]: true }
  const [attaching, setAttaching] = useState(false);

  // Filter bar cho danh sách trong bài
  const [filterSearch, setFilterSearch] = useState('');
  const [filterLevel, setFilterLevel]   = useState('');

  // ── Load data ───────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [lessonRes, vocabRes] = await Promise.all([
        api.get(`${apiBase}/lessons/${lessonId}`),
        api.get(`${apiBase}/vocabulary?lesson_id=${lessonId}`),
      ]);
      setLesson(lessonRes.data);
      setVocab(vocabRes.data.data || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [lessonId]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const openCreate = () => { setForm(EMPTY_FORM); setModal(true); };

  const handleSave = async () => {
    if (!form.reading.trim()) return setAlert({ type: 'error', msg: 'Cách đọc (reading) là bắt buộc.' });
    if (!form.meaning_vi.trim()) return setAlert({ type: 'error', msg: 'Nghĩa tiếng Việt là bắt buộc.' });
    setSaving(true);
    try {
      const payload = {
        kanji: form.kanji.trim() || null,
        reading: form.reading.trim(),
        meaning_vi: form.meaning_vi.trim(),
        meaning_ja: form.meaning_ja.trim() || null,
        type: form.type || null,
        example_sentence: form.example_sentence.trim() || null,
        image_url: form.image_url || null,
        lesson_id: lessonId,
      };
      await api.post(`${apiBase}/vocabulary`, payload);
      setModal(false);
      await load();
      setAlert({ type: 'success', msg: 'Đã thêm từ vựng mới.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Sửa inline từ thẻ xem trước — cập nhật kho chung rồi đồng bộ state tại chỗ.
  const saveVocabItem = async (id, patch) => {
    await api.put(`${apiBase}/vocabulary/${id}`, patch);
    setVocab(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const uploadVocabImage = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const up = await api.post(`${apiBase}/vocabulary/upload-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return up.data.url;
  };

  // Gỡ khỏi bài (không xóa từ gốc trong thư viện)
  const handleDelete = async (item) => {
    if (!await confirm(`Gỡ từ "${item.kanji || item.reading}" khỏi bài này? (Từ vẫn còn trong thư viện)`)) return;
    try {
      await api.delete(`${apiBase}/lessons/${lessonId}/vocabulary/${item.id}`);
      setVocab(v => v.filter(x => x.id !== item.id));
      setAlert({ type: 'success', msg: 'Đã gỡ khỏi bài.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Picker: thêm từ thư viện ──────────────────────────────────────────────────

  const fetchPicker = async (term, level = '') => {
    setPLoad(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (term?.trim()) params.set('search', term.trim());
      if (level) params.set('level', level);
      const r = await api.get(`${apiBase}/vocabulary?${params}`);
      setList(r.data.data || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setPLoad(false);
    }
  };

  const openPicker = () => {
    setSelected({});
    setSearch('');
    setPickerLevel('');
    setPicker(true);
    fetchPicker('', '');
  };

  const togglePick = (id) =>
    setSelected(s => ({ ...s, [id]: !s[id] }));

  const handleAttach = async () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (ids.length === 0) return setAlert({ type: 'error', msg: 'Chưa chọn từ nào.' });
    setAttaching(true);
    try {
      await api.post(`${apiBase}/lessons/${lessonId}/vocabulary/attach`, { ids });
      setPicker(false);
      await load();
      setAlert({ type: 'success', msg: `Đã thêm ${ids.length} từ vào bài.` });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setAttaching(false);
    }
  };

  const inLesson = new Set(vocab.map(v => v.id));

  const displayed = vocab.filter(item => {
    const matchLevel = !filterLevel || item.level === filterLevel;
    const q = filterSearch.toLowerCase();
    const matchSearch = !q ||
      (item.kanji || '').toLowerCase().includes(q) ||
      (item.reading || '').toLowerCase().includes(q) ||
      (item.meaning_vi || '').toLowerCase().includes(q);
    return matchLevel && matchSearch;
  });

  // ── Back navigation ─────────────────────────────────────────────────────────

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout title="Từ vựng bài học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header khóa/bài */}
      <section className="mb-6">
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại Course Builder
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="bg-green-100 text-green-700 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">style</span>
            Vocabulary
          </span>
          {lesson?.level && (
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLOR[lesson.level] || 'bg-gray-100 text-gray-600'}`}>
              {lesson.level}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold text-on-surface">
          {loading ? 'Đang tải...' : lesson?.title || 'Bài học từ vựng'}
        </h1>
        {lesson?.title_ja && (
          <p className="text-on-muted text-sm mt-0.5">{lesson.title_ja}</p>
        )}
        <p className="text-on-muted text-sm mt-1">
          {vocab.length} từ vựng trong bài học này
        </p>
      </section>

      <LessonInfoPanel lesson={lesson} apiBase={apiBase} onSaved={u => setLesson(l => ({ ...l, ...u }))} />

      {/* Panel quản lý — thêm từ + tìm/lọc danh sách trong bài */}
      <CollapsibleSection icon="playlist_add" title="Quản lý từ vựng"
        subtitle="Thêm thủ công, nhập file, thêm từ thư viện; tìm & lọc danh sách"
        open={manageOpen} onToggle={() => setManageOpen(o => !o)} className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-base">add</span>
            Thêm thủ công
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span>
            Nhập file
          </Button>
          <Button variant="secondary" onClick={openPicker}>
            <span className="material-symbols-outlined text-base">library_add</span>
            Thêm từ thư viện
          </Button>
        </div>

        {vocab.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl">search</span>
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Tìm theo kanji, cách đọc hoặc nghĩa..."
                className="w-full pl-11 pr-4 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
            </div>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="px-4 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            >
              <option value="">Tất cả cấp độ</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
      </CollapsibleSection>

      {/* Danh sách từ bên trái + thẻ xem trước bên phải */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : vocab.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-3 opacity-20">style</span>
          <p className="text-lg font-semibold text-charcoal mb-1">Chưa có từ vựng nào</p>
          <p className="text-sm mb-6">Thêm từ vựng đầu tiên cho bài học này</p>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-base">add</span>
            Thêm từ vựng
          </Button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-on-muted text-center">
          <span className="material-symbols-outlined text-5xl mb-2 opacity-20">search_off</span>
          <p className="text-base font-medium">Không có từ phù hợp với bộ lọc</p>
        </div>
      ) : (
        <VocabWordViewer
          items={displayed}
          icon="style"
          showLevel={false}
          showDetails
          furiganaEnabled={false}
          editable
          typeOptions={WORD_TYPES}
          saveItem={saveVocabItem}
          uploadImage={uploadVocabImage}
          removeTitle="Gỡ khỏi bài"
          removeCardLabel="Gỡ từ này khỏi bài"
          onRemoveItem={(id) => {
            const item = vocab.find(v => v.id === id);
            if (item) handleDelete(item);
          }}
        />
      )}

      {/* Modal thêm mới thủ công (sửa từ đã có: inline ngay trên thẻ xem trước) */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Thêm từ vựng mới"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>Lưu</Button>
          </>
        }
      >
        <VocabForm form={form} onChange={setForm} uploadImage={uploadVocabImage} />
      </Modal>

      {/* Nhập file */}
      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="vocab"
        lessonId={lessonId}
        apiBase={apiBase}
        onImported={async (msg) => { await load(); setAlert({ type: 'success', msg }); }}
      />

      {/* Picker thư viện */}
      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="Thêm từ vựng từ thư viện"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPicker(false)}>Hủy</Button>
            <Button loading={attaching} onClick={handleAttach}>
              Thêm đã chọn ({Object.values(selected).filter(Boolean).length})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl">search</span>
              <input
                value={pickerSearch}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchPicker(pickerSearch, pickerLevel)}
                placeholder="Tìm theo kanji, cách đọc hoặc nghĩa... (Enter để tìm)"
                className="w-full pl-11 pr-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
            </div>
            <select
              value={pickerLevel}
              onChange={e => { setPickerLevel(e.target.value); fetchPicker(pickerSearch, e.target.value); }}
              className="px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            >
              <option value="">Tất cả cấp độ</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {pickerLoad ? (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-outline/15 border border-outline/20 rounded-xl">
              {pickerList.filter(it => !inLesson.has(it.id)).length === 0 ? (
                <p className="text-sm text-on-muted text-center py-10">Không có từ phù hợp (hoặc đã có trong bài).</p>
              ) : (
                pickerList.filter(it => !inLesson.has(it.id)).map(it => (
                  <label key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-stone/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={() => togglePick(it.id)}
                      className="w-4 h-4 accent-tsubaki-red shrink-0"
                    />
                    <span className="text-lg font-bold text-on-surface w-28 shrink-0 truncate">{it.kanji || it.reading}</span>
                    <span className="text-sm text-on-muted w-28 shrink-0 truncate">{it.reading}</span>
                    <span className="text-sm flex-1 truncate">{it.meaning_vi}</span>
                    {it.level && <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${LEVEL_COLOR[it.level] || 'bg-gray-100 text-gray-600'}`}>{it.level}</span>}
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
