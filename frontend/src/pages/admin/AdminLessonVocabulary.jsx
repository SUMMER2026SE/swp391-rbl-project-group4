import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
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
  level: '', type: '', example_sentence: '',
};

// ── Vocabulary Card ───────────────────────────────────────────────────────────

function VocabCard({ item, onEdit, onDelete }) {
  const levelCls = LEVEL_COLOR[item.level] || 'bg-gray-100 text-gray-600';

  return (
    <article className="bg-white/75 backdrop-blur-md border border-outline/20 rounded-2xl p-5 flex flex-col h-full shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
      {/* Top row */}
      <div className="flex justify-between items-start mb-4">
        {item.level ? (
          <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${levelCls}`}>{item.level} Level</span>
        ) : <span />}
        {item.type && (
          <span className="text-xs text-on-muted bg-surface-container px-2 py-0.5 rounded-full">{item.type}</span>
        )}
      </div>

      {/* Main word */}
      <div className="text-center flex-1 mb-4">
        {item.reading && (
          <p className="text-xs text-on-muted mb-1 tracking-wider">{item.reading}</p>
        )}
        <h2 className="text-3xl font-bold text-on-surface mb-2 leading-tight">
          {item.kanji || item.reading}
        </h2>
        <p className="text-lg font-semibold text-tsubaki-red">{item.meaning_vi}</p>
        {item.meaning_ja && (
          <p className="text-xs text-on-muted mt-0.5">{item.meaning_ja}</p>
        )}
      </div>

      {/* Example */}
      {item.example_sentence && (
        <div className="bg-surface-stone/60 p-3 rounded-xl border border-outline/10 mb-4">
          <p className="text-xs font-bold text-on-muted uppercase tracking-wider mb-1">VÍ DỤ</p>
          <p className="text-sm text-charcoal italic leading-relaxed">{item.example_sentence}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-3 border-t border-outline/10">
        <button
          onClick={() => onEdit(item)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline/30 text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          Sửa
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline/30 text-sm text-on-muted hover:border-error hover:text-error transition-colors"
        >
          <span className="material-symbols-outlined text-base">link_off</span>
          Gỡ
        </button>
      </div>
    </article>
  );
}

// ── Vocab Form ────────────────────────────────────────────────────────────────

function VocabForm({ form, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Kanji / Chữ</label>
          <input
            value={form.kanji}
            onChange={e => onChange({ ...form, kanji: e.target.value })}
            placeholder="例: 会議"
            className="w-full px-4 py-3 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cách đọc (Hiragana) *</label>
          <input
            value={form.reading}
            onChange={e => onChange({ ...form, reading: e.target.value })}
            placeholder="例: かいぎ"
            className="w-full px-4 py-3 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nghĩa tiếng Việt *</label>
          <input
            value={form.meaning_vi}
            onChange={e => onChange({ ...form, meaning_vi: e.target.value })}
            placeholder="Ý nghĩa..."
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nghĩa tiếng Nhật</label>
          <input
            value={form.meaning_ja}
            onChange={e => onChange({ ...form, meaning_ja: e.target.value })}
            placeholder="意味..."
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
          <select
            value={form.level}
            onChange={e => onChange({ ...form, level: e.target.value })}
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          >
            <option value="">-- Chọn --</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Loại từ</label>
          <select
            value={form.type}
            onChange={e => onChange({ ...form, type: e.target.value })}
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          >
            <option value="">-- Chọn --</option>
            {WORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Câu ví dụ</label>
        <textarea
          value={form.example_sentence}
          onChange={e => onChange({ ...form, example_sentence: e.target.value })}
          rows={2}
          placeholder="例: 明日、10時から会議があります。"
          className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none"
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonVocabulary() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson]   = useState(null);
  const [vocab, setVocab]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);

  // Picker "Thêm từ thư viện"
  const [picker, setPicker]       = useState(false);
  const [pickerSearch, setSearch] = useState('');
  const [pickerList, setList]     = useState([]);
  const [pickerLoad, setPLoad]    = useState(false);
  const [selected, setSelected]   = useState({});   // { [id]: true }
  const [attaching, setAttaching] = useState(false);

  // ── Load data ───────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [lessonRes, vocabRes] = await Promise.all([
        api.get(`/admin/lessons/${lessonId}`),
        api.get(`/admin/vocabulary?lesson_id=${lessonId}`),
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

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true); };
  const openEdit   = (item) => {
    setForm({
      kanji: item.kanji || '',
      reading: item.reading || '',
      meaning_vi: item.meaning_vi || '',
      meaning_ja: item.meaning_ja || '',
      level: item.level || '',
      type: item.type || '',
      example_sentence: item.example_sentence || '',
    });
    setEditId(item.id);
    setModal(true);
  };

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
        level: form.level || null,
        type: form.type || null,
        example_sentence: form.example_sentence.trim() || null,
        lesson_id: lessonId,
      };
      if (editId) {
        await api.put(`/admin/vocabulary/${editId}`, payload);
      } else {
        await api.post('/admin/vocabulary', payload);
      }
      setModal(false);
      await load();
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật từ vựng.' : 'Đã thêm từ vựng mới.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Gỡ khỏi bài (không xóa từ gốc trong thư viện)
  const handleDelete = async (item) => {
    if (!confirm(`Gỡ từ "${item.kanji || item.reading}" khỏi bài này? (Từ vẫn còn trong thư viện)`)) return;
    try {
      await api.delete(`/admin/lessons/${lessonId}/vocabulary/${item.id}`);
      setVocab(v => v.filter(x => x.id !== item.id));
      setAlert({ type: 'success', msg: 'Đã gỡ khỏi bài.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Picker: thêm từ thư viện ──────────────────────────────────────────────────

  const fetchPicker = async (term) => {
    setPLoad(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (term?.trim()) params.set('search', term.trim());
      const r = await api.get(`/admin/vocabulary?${params}`);
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
    setPicker(true);
    fetchPicker('');
  };

  const togglePick = (id) =>
    setSelected(s => ({ ...s, [id]: !s[id] }));

  const handleAttach = async () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (ids.length === 0) return setAlert({ type: 'error', msg: 'Chưa chọn từ nào.' });
    setAttaching(true);
    try {
      await api.post(`/admin/lessons/${lessonId}/vocabulary/attach`, { ids });
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

  // ── Back navigation ─────────────────────────────────────────────────────────

  const goBack = () => {
    if (lesson?.course_id) navigate(`/admin/courses/${lesson.course_id}/edit`);
    else navigate('/admin/courses');
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Từ vựng bài học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
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
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={openPicker}>
            <span className="material-symbols-outlined text-base">library_add</span>
            Thêm từ thư viện
          </Button>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-base">add</span>
            Thêm thủ công
          </Button>
        </div>
      </section>

      {/* Progress bar */}
      {vocab.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-tsubaki-red to-sumire-purple rounded-full transition-all"
              style={{ width: `${Math.min((vocab.length / 10) * 100, 100)}%` }}
            />
          </div>
          <span className="text-xs text-on-muted shrink-0">{vocab.length} / 10 từ gợi ý</span>
        </div>
      )}

      {/* Vocab grid */}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {vocab.map(item => (
            <VocabCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Add card */}
          <button
            onClick={openCreate}
            className="min-h-[200px] border-2 border-dashed border-outline/25 rounded-2xl flex flex-col items-center justify-center gap-2
              text-on-muted hover:border-tsubaki-red/50 hover:text-tsubaki-red hover:bg-surface-container-low/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-highest/50 group-hover:bg-tsubaki-red group-hover:text-white transition-all flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">add</span>
            </div>
            <span className="text-sm font-medium">Thêm từ mới</span>
          </button>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa từ vựng' : 'Thêm từ vựng mới'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>Lưu</Button>
          </>
        }
      >
        <VocabForm form={form} onChange={setForm} />
      </Modal>

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
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl">search</span>
            <input
              value={pickerSearch}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchPicker(pickerSearch)}
              placeholder="Tìm theo kanji, cách đọc hoặc nghĩa... (Enter để tìm)"
              className="w-full pl-11 pr-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
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
    </AdminLayout>
  );
}
