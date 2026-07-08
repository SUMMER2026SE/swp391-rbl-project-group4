import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import api from '../../lib/api';

// Trang soạn Ngữ pháp của Mục — danh sách item rời (public.grammar_points, gắn qua
// content_module.lesson_grammar_points), đồng nhất với trang Từ vựng / Kanji.
// Field markdown grammar_notes cũ vẫn giữ làm "Ghi chú tổng quan" tùy chọn.

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
  title: '', title_ja: '', meaning_vi: '',
  explanation: '', example_sentence: '', level: '',
};

// ── Grammar Card ──────────────────────────────────────────────────────────────

function GrammarCard({ item, onEdit, onDelete }) {
  const levelCls = LEVEL_COLOR[item.level] || 'bg-gray-100 text-gray-600';

  return (
    <article className="bg-white/75 backdrop-blur-md border border-outline/20 rounded-2xl p-5 flex flex-col h-full shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
      {/* Top row */}
      <div className="flex justify-between items-start mb-3">
        {item.level ? (
          <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${levelCls}`}>{item.level} Level</span>
        ) : <span />}
        <span className="material-symbols-outlined text-amber-500 text-lg">spellcheck</span>
      </div>

      {/* Structure */}
      <div className="flex-1 mb-3">
        <h2 className="text-xl font-bold text-on-surface leading-snug mb-1">{item.title}</h2>
        {item.title_ja && <p className="text-xs text-on-muted mb-1">{item.title_ja}</p>}
        <p className="text-sm font-semibold text-tsubaki-red">{item.meaning_vi}</p>
        {item.explanation && (
          <p className="text-xs text-on-muted mt-2 leading-relaxed line-clamp-3">{item.explanation}</p>
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

// ── Grammar Form ──────────────────────────────────────────────────────────────

function GrammarForm({ form, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cấu trúc *</label>
          <input
            value={form.title}
            onChange={e => onChange({ ...form, title: e.target.value })}
            placeholder="例: 〜ばかりでなく"
            className="w-full px-4 py-3 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề tiếng Nhật</label>
          <input
            value={form.title_ja}
            onChange={e => onChange({ ...form, title_ja: e.target.value })}
            placeholder="例: 文法のタイトル"
            className="w-full px-4 py-3 border border-outline rounded-xl text-lg outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Ý nghĩa *</label>
          <input
            value={form.meaning_vi}
            onChange={e => onChange({ ...form, meaning_vi: e.target.value })}
            placeholder="Không chỉ... mà còn..."
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

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Giải thích cách dùng</label>
        <textarea
          value={form.explanation}
          onChange={e => onChange({ ...form, explanation: e.target.value })}
          rows={3}
          placeholder="Cách chia, sắc thái, lưu ý khi sử dụng..."
          className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Câu ví dụ</label>
        <textarea
          value={form.example_sentence}
          onChange={e => onChange({ ...form, example_sentence: e.target.value })}
          rows={2}
          placeholder="例: 彼は英語ばかりでなく、日本語も話せます。"
          className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none"
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonGrammar() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]   = useState(null);
  const [grammar, setGrammar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);

  // Modal "Nhập file"
  const [importOpen, setImportOpen] = useState(false);

  // Ghi chú tổng quan (grammar_notes cũ — tùy chọn)
  const [notesOpen, setNotesOpen]     = useState(false);
  const [notes, setNotes]             = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

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
      const [lessonRes, grammarRes] = await Promise.all([
        api.get(`${apiBase}/lessons/${lessonId}`),
        api.get(`${apiBase}/grammar-points?lesson_id=${lessonId}`),
      ]);
      setLesson(lessonRes.data);
      setNotes(lessonRes.data.grammar_notes || '');
      setGrammar(grammarRes.data.data || []);
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
      title: item.title || '',
      title_ja: item.title_ja || '',
      meaning_vi: item.meaning_vi || '',
      explanation: item.explanation || '',
      example_sentence: item.example_sentence || '',
      level: item.level || '',
    });
    setEditId(item.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Cấu trúc (title) là bắt buộc.' });
    if (!form.meaning_vi.trim()) return setAlert({ type: 'error', msg: 'Ý nghĩa là bắt buộc.' });
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        title_ja: form.title_ja.trim() || null,
        meaning_vi: form.meaning_vi.trim(),
        explanation: form.explanation.trim() || null,
        example_sentence: form.example_sentence.trim() || null,
        level: form.level || null,
        lesson_id: lessonId,
      };
      if (editId) {
        await api.put(`${apiBase}/grammar-points/${editId}`, payload);
      } else {
        await api.post(`${apiBase}/grammar-points`, payload);
      }
      setModal(false);
      await load();
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật ngữ pháp.' : 'Đã thêm ngữ pháp mới.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Gỡ khỏi bài (không xóa khỏi thư viện)
  const handleDelete = async (item) => {
    if (!confirm(`Gỡ ngữ pháp "${item.title}" khỏi bài này? (Vẫn còn trong thư viện)`)) return;
    try {
      await api.delete(`${apiBase}/lessons/${lessonId}/grammar-points/${item.id}`);
      setGrammar(g => g.filter(x => x.id !== item.id));
      setAlert({ type: 'success', msg: 'Đã gỡ khỏi bài.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Ghi chú tổng quan ─────────────────────────────────────────────────────────

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await api.put(`${apiBase}/lessons/${lessonId}`, { grammar_notes: notes });
      setAlert({ type: 'success', msg: 'Đã lưu ghi chú tổng quan.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Picker: thêm từ thư viện ──────────────────────────────────────────────────

  const fetchPicker = async (term, level = '') => {
    setPLoad(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (term?.trim()) params.set('search', term.trim());
      if (level) params.set('level', level);
      const r = await api.get(`${apiBase}/grammar-points?${params}`);
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
    if (ids.length === 0) return setAlert({ type: 'error', msg: 'Chưa chọn ngữ pháp nào.' });
    setAttaching(true);
    try {
      await api.post(`${apiBase}/lessons/${lessonId}/grammar-points/attach`, { ids });
      setPicker(false);
      await load();
      setAlert({ type: 'success', msg: `Đã thêm ${ids.length} ngữ pháp vào bài.` });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setAttaching(false);
    }
  };

  const inLesson = new Set(grammar.map(g => g.id));

  const displayed = grammar.filter(item => {
    const matchLevel = !filterLevel || item.level === filterLevel;
    const q = filterSearch.toLowerCase();
    const matchSearch = !q ||
      (item.title || '').toLowerCase().includes(q) ||
      (item.meaning_vi || '').toLowerCase().includes(q) ||
      (item.title_ja || '').toLowerCase().includes(q);
    return matchLevel && matchSearch;
  });

  // ── Back navigation ─────────────────────────────────────────────────────────

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout title="Ngữ pháp bài học">
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
            <span className="bg-amber-100 text-amber-700 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">spellcheck</span>
              Grammar
            </span>
            {lesson?.level && (
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLOR[lesson.level] || 'bg-gray-100 text-gray-600'}`}>
                {lesson.level}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-on-surface">
            {loading ? 'Đang tải...' : lesson?.title || 'Bài học ngữ pháp'}
          </h1>
          {lesson?.title_ja && (
            <p className="text-on-muted text-sm mt-0.5">{lesson.title_ja}</p>
          )}
          <p className="text-on-muted text-sm mt-1">
            {grammar.length} điểm ngữ pháp trong bài học này
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span>
            Nhập file
          </Button>
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

      {/* Ghi chú tổng quan (grammar_notes cũ, tùy chọn) */}
      <div className="mb-6 rounded-2xl border border-outline/20 bg-white/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setNotesOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium hover:bg-surface-stone/40 transition-colors"
        >
          <span className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-lg text-sumire-purple">sticky_note_2</span>
            Ghi chú tổng quan của bài (tùy chọn, hỗ trợ Markdown)
            {notes && <span className="text-xs text-on-muted font-normal">— {notes.length} ký tự</span>}
          </span>
          <span className="material-symbols-outlined text-lg text-on-muted">
            {notesOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {notesOpen && (
          <div className="px-5 pb-4 space-y-3">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={8}
              placeholder={'## Cấu trúc (Formula)\n\nV + 〜て + ください\n\n## Cách dùng\n\nSử dụng khi...'}
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm font-mono outline-none focus:border-tsubaki-red transition-colors resize-y leading-relaxed"
            />
            <div className="flex justify-end">
              <Button size="sm" loading={notesSaving} onClick={handleSaveNotes}>
                <span className="material-symbols-outlined text-base">save</span>
                Lưu ghi chú
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      {grammar.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl">search</span>
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Tìm theo cấu trúc hoặc ý nghĩa..."
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

      {/* Grammar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : grammar.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-3 opacity-20">spellcheck</span>
          <p className="text-lg font-semibold text-charcoal mb-1">Chưa có điểm ngữ pháp nào</p>
          <p className="text-sm mb-6">Thêm điểm ngữ pháp đầu tiên cho bài học này</p>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-base">add</span>
            Thêm ngữ pháp
          </Button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-on-muted text-center">
          <span className="material-symbols-outlined text-5xl mb-2 opacity-20">search_off</span>
          <p className="text-base font-medium">Không có ngữ pháp phù hợp với bộ lọc</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayed.map(item => (
            <GrammarCard
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
            <span className="text-sm font-medium">Thêm ngữ pháp mới</span>
          </button>
        </div>
      )}

      {/* Modal thêm/sửa */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa ngữ pháp' : 'Thêm ngữ pháp mới'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>Lưu</Button>
          </>
        }
      >
        <GrammarForm form={form} onChange={setForm} />
      </Modal>

      {/* Nhập file */}
      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="grammar"
        lessonId={lessonId}
        apiBase={apiBase}
        onImported={async (msg) => { await load(); setAlert({ type: 'success', msg }); }}
      />

      {/* Picker thư viện */}
      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title="Thêm ngữ pháp từ thư viện"
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
                placeholder="Tìm theo cấu trúc hoặc ý nghĩa... (Enter để tìm)"
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
                <p className="text-sm text-on-muted text-center py-10">Không có ngữ pháp phù hợp (hoặc đã có trong bài).</p>
              ) : (
                pickerList.filter(it => !inLesson.has(it.id)).map(it => (
                  <label key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-stone/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={() => togglePick(it.id)}
                      className="w-4 h-4 accent-tsubaki-red shrink-0"
                    />
                    <span className="text-base font-bold text-on-surface w-40 shrink-0 truncate">{it.title}</span>
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
