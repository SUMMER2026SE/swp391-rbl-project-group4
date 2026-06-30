import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_COLOR = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  character: '', reading_on: '', reading_kun: '',
  meaning_vi: '', stroke_count: '', level: '', han_viet: '',
};

// ── Kanji Card ────────────────────────────────────────────────────────────────

function KanjiCard({ item, onEdit, onDelete }) {
  const levelCls = LEVEL_COLOR[item.level] || 'bg-gray-100 text-gray-600';
  const onYomi = Array.isArray(item.reading_on)  ? item.reading_on.join('、') : (item.reading_on  || '');
  const kunYomi = Array.isArray(item.reading_kun) ? item.reading_kun.join('、') : (item.reading_kun || '');

  return (
    <article className="bg-white/80 backdrop-blur-md border border-outline/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Character display */}
      <div className="relative bg-gradient-to-br from-surface-stone to-white flex items-center justify-center py-8 border-b border-outline/10">
        {item.level && (
          <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-bold ${levelCls}`}>
            {item.level}
          </span>
        )}
        {item.stroke_count && (
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-container text-on-muted">
            {item.stroke_count} nét
          </span>
        )}
        <span
          className="text-[96px] leading-none text-on-surface select-none"
          style={{ fontFamily: "'Noto Serif JP', 'Noto Sans JP', serif" }}
        >
          {item.character}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 space-y-3">
        {/* Meaning */}
        <div className="text-center">
          <p className="text-base font-bold text-tsubaki-red">{item.meaning_vi}</p>
          {item.han_viet && (
            <p className="text-xs text-on-muted mt-0.5">{item.han_viet}</p>
          )}
        </div>

        {/* Readings */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-tsubaki-red/5 rounded-xl p-2.5 text-center">
            <p className="text-[9px] font-bold text-on-muted uppercase tracking-wider mb-1">On-yomi</p>
            <p className="text-sm font-bold text-tsubaki-red font-mono">
              {onYomi || <span className="text-on-muted/40 font-normal">—</span>}
            </p>
          </div>
          <div className="bg-surface-container/60 rounded-xl p-2.5 text-center">
            <p className="text-[9px] font-bold text-on-muted uppercase tracking-wider mb-1">Kun-yomi</p>
            <p className="text-sm font-bold text-on-surface font-mono">
              {kunYomi || <span className="text-on-muted/40 font-normal">—</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-outline/10 mt-1">
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

// ── Kanji Form ────────────────────────────────────────────────────────────────

function KanjiForm({ form, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Ký tự Kanji *</label>
          <input
            value={form.character}
            onChange={e => onChange({ ...form, character: e.target.value })}
            placeholder="例: 空"
            className="w-full px-4 py-3 border border-outline rounded-xl text-3xl text-center outline-none focus:border-tsubaki-red transition-colors"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nghĩa tiếng Việt *</label>
          <input
            value={form.meaning_vi}
            onChange={e => onChange({ ...form, meaning_vi: e.target.value })}
            placeholder="VD: bầu trời, trống rỗng"
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">On-yomi (音読み)</label>
          <input
            value={form.reading_on}
            onChange={e => onChange({ ...form, reading_on: e.target.value })}
            placeholder="VD: クウ、コン (phân cách bởi 、)"
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Kun-yomi (訓読み)</label>
          <input
            value={form.reading_kun}
            onChange={e => onChange({ ...form, reading_kun: e.target.value })}
            placeholder="VD: そら、あ.く (phân cách bởi 、)"
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Hán Việt</label>
          <input
            value={form.han_viet}
            onChange={e => onChange({ ...form, han_viet: e.target.value })}
            placeholder="VD: Không"
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Số nét</label>
          <input
            type="number" min="1" max="30"
            value={form.stroke_count}
            onChange={e => onChange({ ...form, stroke_count: e.target.value })}
            placeholder="VD: 8"
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
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
      </div>

      {/* Live preview */}
      {form.character && (
        <div className="p-4 bg-surface-stone rounded-2xl border border-outline/10 flex items-center gap-6">
          <span
            className="text-6xl leading-none text-on-surface"
            style={{ fontFamily: "'Noto Serif JP', 'Noto Sans JP', serif" }}
          >
            {form.character}
          </span>
          <div className="flex-1 space-y-1.5">
            {form.meaning_vi && <p className="font-bold text-tsubaki-red">{form.meaning_vi}</p>}
            {form.reading_on  && <p className="text-sm text-on-muted"><span className="font-semibold text-xs uppercase tracking-wider mr-1">On:</span>{form.reading_on}</p>}
            {form.reading_kun && <p className="text-sm text-on-muted"><span className="font-semibold text-xs uppercase tracking-wider mr-1">Kun:</span>{form.reading_kun}</p>}
          </div>
          {form.level && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${LEVEL_COLOR[form.level] || 'bg-gray-100 text-gray-600'}`}>
              {form.level}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonKanji() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]   = useState(null);
  const [kanji, setKanji]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Picker "Thêm từ thư viện"
  const [picker, setPicker]       = useState(false);
  const [pickerSearch, setSearch] = useState('');
  const [pickerList, setList]     = useState([]);
  const [pickerLoad, setPLoad]    = useState(false);
  const [selected, setSelected]   = useState({});   // { [id]: true }
  const [attaching, setAttaching] = useState(false);

  // ── Helpers for reading arrays ──────────────────────────────────────────────

  // Always returns string[] (matching text[] DB column), never a plain string
  const parseReading = (val) => {
    if (!val || val.trim() === '') return [];
    return val.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
  };

  const readingToString = (val) =>
    Array.isArray(val) ? val.join('、') : (val || '');

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [lessonRes, kanjiRes] = await Promise.all([
        api.get(`${apiBase}/lessons/${lessonId}`),
        api.get(`${apiBase}/kanji?lesson_id=${lessonId}&limit=100`),
      ]);
      setLesson(lessonRes.data);
      setKanji(kanjiRes.data.data || []);
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
      character:   item.character   || '',
      reading_on:  readingToString(item.reading_on),
      reading_kun: readingToString(item.reading_kun),
      meaning_vi:  item.meaning_vi  || '',
      stroke_count: item.stroke_count != null ? String(item.stroke_count) : '',
      level:       item.level       || '',
      han_viet:    item.han_viet    || '',
    });
    setEditId(item.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.character.trim()) return setAlert({ type: 'error', msg: 'Ký tự kanji không được để trống.' });
    if (!form.meaning_vi.trim()) return setAlert({ type: 'error', msg: 'Nghĩa tiếng Việt là bắt buộc.' });
    setSaving(true);
    try {
      const payload = {
        character:   form.character.trim(),
        reading_on:  parseReading(form.reading_on),
        reading_kun: parseReading(form.reading_kun),
        meaning_vi:  form.meaning_vi.trim(),
        stroke_count: form.stroke_count ? Number(form.stroke_count) : null,
        level:       form.level || null,
        han_viet:    form.han_viet.trim() || null,
        lesson_id:   lessonId,
      };
      if (editId) {
        await api.put(`${apiBase}/kanji/${editId}`, payload);
      } else {
        await api.post(`${apiBase}/kanji`, payload);
      }
      setModal(false);
      await load();
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật kanji.' : 'Đã thêm kanji mới.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Gỡ khỏi bài (không xóa kanji gốc trong thư viện)
  const handleDelete = async (item) => {
    if (!confirm(`Gỡ kanji "${item.character}" khỏi bài này? (Kanji vẫn còn trong thư viện)`)) return;
    try {
      await api.delete(`${apiBase}/lessons/${lessonId}/kanji/${item.id}`);
      setKanji(k => k.filter(x => x.id !== item.id));
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
      const r = await api.get(`${apiBase}/kanji?${params}`);
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
    if (ids.length === 0) return setAlert({ type: 'error', msg: 'Chưa chọn kanji nào.' });
    setAttaching(true);
    try {
      await api.post(`${apiBase}/lessons/${lessonId}/kanji/attach`, { ids });
      setPicker(false);
      await load();
      setAlert({ type: 'success', msg: `Đã thêm ${ids.length} kanji vào bài.` });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setAttaching(false);
    }
  };

  const inLesson = new Set(kanji.map(k => k.id));

  // ── Back navigation ─────────────────────────────────────────────────────────

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout title="Kanji bài học">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Kanji bài học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại Course Builder
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="bg-purple-100 text-purple-700 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">translate</span>
              Kanji
            </span>
            {lesson?.level && (
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLOR[lesson.level] || 'bg-gray-100 text-gray-600'}`}>
                {lesson.level}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-on-surface">
            {lesson?.title || 'Bài học Kanji'}
          </h1>
          {lesson?.title_ja && (
            <p className="text-on-muted text-sm mt-0.5">{lesson.title_ja}</p>
          )}
          <p className="text-on-muted text-sm mt-1">
            {kanji.length} kanji trong bài học này
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
      {kanji.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-tsubaki-red to-sumire-purple rounded-full transition-all"
              style={{ width: `${Math.min((kanji.length / 10) * 100, 100)}%` }}
            />
          </div>
          <span className="text-xs text-on-muted shrink-0">{kanji.length} / 10 kanji gợi ý</span>
        </div>
      )}

      {/* Kanji grid */}
      {kanji.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-muted text-center">
          <span
            className="text-8xl leading-none mb-4 opacity-10 select-none"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            字
          </span>
          <p className="text-lg font-semibold text-charcoal mb-1">Chưa có kanji nào</p>
          <p className="text-sm mb-6">Thêm kanji đầu tiên cho bài học này</p>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-base">add</span>
            Thêm Kanji
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {kanji.map(item => (
            <KanjiCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Add card */}
          <button
            onClick={openCreate}
            className="min-h-[220px] border-2 border-dashed border-outline/25 rounded-2xl flex flex-col items-center justify-center gap-2
              text-on-muted hover:border-tsubaki-red/50 hover:text-tsubaki-red hover:bg-surface-container-low/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-highest/50 group-hover:bg-tsubaki-red group-hover:text-white transition-all flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">add</span>
            </div>
            <span className="text-sm font-medium">Thêm kanji mới</span>
          </button>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa Kanji' : 'Thêm Kanji mới'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>Lưu</Button>
          </>
        }
      >
        <KanjiForm form={form} onChange={setForm} />
      </Modal>

      {/* Picker thư viện */}
      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="Thêm Kanji từ thư viện"
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
              placeholder="Tìm theo ký tự, nghĩa hoặc hán việt... (Enter để tìm)"
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
                <p className="text-sm text-on-muted text-center py-10">Không có kanji phù hợp (hoặc đã có trong bài).</p>
              ) : (
                pickerList.filter(it => !inLesson.has(it.id)).map(it => (
                  <label key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-stone/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={() => togglePick(it.id)}
                      className="w-4 h-4 accent-tsubaki-red shrink-0"
                    />
                    <span className="text-3xl text-on-surface w-14 shrink-0 text-center" style={{ fontFamily: "'Noto Serif JP', serif" }}>{it.character}</span>
                    <span className="text-sm flex-1 truncate">{it.meaning_vi}</span>
                    {it.han_viet && <span className="text-xs text-on-muted shrink-0 truncate max-w-[8rem]">{it.han_viet}</span>}
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
