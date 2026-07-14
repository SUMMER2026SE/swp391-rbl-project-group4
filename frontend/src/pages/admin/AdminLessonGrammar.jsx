import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import CollapsibleSection from '../../components/shared/CollapsibleSection';
import GrammarItemCard from '../../components/shared/GrammarItemCard';
import LessonInfoPanel from '../../components/shared/LessonInfoPanel';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const EMPTY_FORM = { title: '', title_ja: '', meaning_vi: '', explanation: '', example_sentence: '', level: '' };

// Trình soạn Mục ngữ pháp của khóa học — dùng chung admin + teacher (useEditorArea).
// UI list/search/card tái dùng phong cách Study List (ManagePanel/GrammarItemCard).
export default function AdminLessonGrammar() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]   = useState(null);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Panel quản lý
  const [manageOpen, setManageOpen] = useState(false);
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState([]);
  const [importOpen, setImportOpen] = useState(false);

  // Modal thêm thủ công (POST ${apiBase}/grammar-points với lesson_id → tạo + gắn vào bài)
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const currentIds = new Set(items.map(i => i.id));

  const load = async () => {
    setLoading(true);
    try {
      const [lessonRes, grammarRes] = await Promise.all([
        api.get(`${apiBase}/lessons/${lessonId}`),
        api.get(`${apiBase}/grammar-points?lesson_id=${lessonId}`),
      ]);
      setLesson(lessonRes.data);
      setItems(grammarRes.data.data || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [lessonId]);

  // ── Tìm & thêm từ thư viện grammar_points ──────────────────────────────────
  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const r = await api.get(`${apiBase}/grammar-points?search=${encodeURIComponent(search)}&limit=10`);
      setResults(r.data.data || []);
    } catch (e2) { setAlert({ type: 'error', msg: e2.message }); }
  };

  const attachItem = async (id) => {
    try {
      await api.post(`${apiBase}/lessons/${lessonId}/grammar-points/attach`, { ids: [id] });
      await load();
    } catch (e2) { setAlert({ type: 'error', msg: e2.message }); }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Gỡ "${item.title}" khỏi bài? (mẫu gốc trong thư viện vẫn được giữ)`)) return;
    try {
      await api.delete(`${apiBase}/lessons/${lessonId}/grammar-points/${item.id}`);
      setItems(list => list.filter(i => i.id !== item.id));
    } catch (e2) { setAlert({ type: 'error', msg: e2.message }); }
  };

  // ── Thêm thủ công ──────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY_FORM); setModal(true); };

  const saveManual = async () => {
    if (!form.title.trim() || !form.meaning_vi.trim())
      return setAlert({ type: 'error', msg: 'Cấu trúc và ý nghĩa không được để trống.' });
    setSaving(true);
    try {
      await api.post(`${apiBase}/grammar-points`, {
        title: form.title.trim(),
        title_ja: form.title_ja.trim() || null,
        meaning_vi: form.meaning_vi.trim(),
        explanation: form.explanation.trim() || null,
        example_sentence: form.example_sentence.trim() || null,
        level: form.level || null,
        lesson_id: lessonId,
      });
      setModal(false);
      await load();
      setAlert({ type: 'success', msg: 'Đã thêm mẫu ngữ pháp vào bài.' });
    } catch (e2) { setAlert({ type: 'error', msg: e2.message }); } finally { setSaving(false); }
  };

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  if (loading) {
    return (
      <Layout title="Ngữ pháp bài học">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Ngữ pháp bài học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-6">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại Course Builder
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="bg-amber-100 text-amber-700 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">spellcheck</span>
            Ngữ pháp
          </span>
        </div>

        <h1 className="font-display text-2xl font-bold text-on-surface">
          {lesson?.title || 'Bài học ngữ pháp'}
        </h1>
        {lesson?.title_ja && (
          <p className="text-on-muted text-sm mt-0.5">{lesson.title_ja}</p>
        )}
        <p className="text-on-muted text-sm mt-1">
          {items.length} mẫu ngữ pháp trong bài học này
        </p>
      </section>

      <LessonInfoPanel lesson={lesson} apiBase={apiBase} onSaved={u => setLesson(l => ({ ...l, ...u }))} />

      {/* Panel quản lý — thêm thủ công, nhập file, tìm & thêm từ thư viện */}
      <CollapsibleSection icon="playlist_add" title="Quản lý ngữ pháp"
        subtitle="Thêm thủ công, nhập file/JSON, tìm & thêm mẫu có sẵn từ thư viện"
        open={manageOpen} onToggle={() => setManageOpen(o => !o)} className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-base">add</span>
            Thêm thủ công
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span>
            Nhập file / JSON
          </Button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm trong thư viện ngữ pháp để thêm vào bài..."
            className="flex-1 px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
          <Button type="submit" size="sm">Tìm</Button>
        </form>

        {results.length > 0 && (
          <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-48 overflow-y-auto">
            {results.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><strong>{item.title}</strong> — {item.meaning_vi}</span>
                {currentIds.has(item.id) ? (
                  <span className="text-xs text-on-muted">Đã có</span>
                ) : (
                  <button onClick={() => attachItem(item.id)} className="text-tsubaki-red text-xs font-semibold hover:underline">+ Thêm</button>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Danh sách thẻ */}
      {items.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-muted">
          Bài học này chưa có mẫu ngữ pháp nào — thêm ở panel "Quản lý ngữ pháp" bên trên.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <GrammarItemCard key={item.id} item={item} index={i}
              to={`${apiBase}/lessons/${lessonId}/grammar/${item.id}`}
              editable onRemove={() => removeItem(item)} removeTitle="Gỡ khỏi bài" />
          ))}
        </div>
      )}

      {/* Modal thêm thủ công */}
      <Modal open={modal} onClose={() => setModal(false)} title="Thêm mẫu ngữ pháp" size="md"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button><Button loading={saving} onClick={saveManual}>Thêm vào bài</Button></>}>
        <div className="space-y-4">
          <Input label="Cấu trúc *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: 〜てから" />
          <Input label="Tiêu đề (Tiếng Nhật)" value={form.title_ja} onChange={e => setForm(f => ({ ...f, title_ja: e.target.value }))} placeholder="日本語のタイトル" />
          <Input label="Ý nghĩa (Tiếng Việt) *" value={form.meaning_vi} onChange={e => setForm(f => ({ ...f, meaning_vi: e.target.value }))} placeholder="VD: sau khi..." />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Cấu trúc / Cách dùng</label>
            <textarea value={form.explanation} rows={3}
              onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
              placeholder="Giải thích chi tiết cách dùng..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
          </div>
          <Input label="Câu ví dụ" value={form.example_sentence} onChange={e => setForm(f => ({ ...f, example_sentence: e.target.value }))} placeholder="例文" />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ</label>
            <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">-- Không chọn --</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Import file/JSON */}
      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="grammar"
        lessonId={lessonId}
        apiBase={apiBase}
        onImported={async (msg) => { await load(); setImportOpen(false); setAlert({ type: 'success', msg }); }}
      />
    </Layout>
  );
}
