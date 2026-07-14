import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const LEVEL_STYLE = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const EMPTY = {
  title: '', title_vi: '', summary_vi: '', level: '',
  thumbnail_url: '',
  content: '', segments: [], questions: [], vocab: [], grammar: [],
  is_published: false,
};

const LIMIT = 20;

export function ReadingManager({ Layout = AdminLayout, base = '/admin/reading', uploadPath = '/admin/reading-passages/upload', title = 'Quản lý Luyện đọc' }) {
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');

  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [composing, setComposing]   = useState(false);   // AI soạn bài
  const [genQuiz, setGenQuiz]       = useState(false);   // AI sinh câu hỏi
  const [genVocab, setGenVocab]     = useState(false);   // sinh từ vựng & ngữ pháp
  const [uploading, setUploading]   = useState(false);
  const [segmenting, setSegmenting] = useState(false);   // tách câu thủ công (không AI)
  const [parsingFile, setParsingFile] = useState(false); // đọc nội dung từ file .txt/.docx

  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      const r = await api.get(`${base}?${params}`);
      setData(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchNews, 300);
    return () => clearTimeout(timer);
  }, [fetchNews]);

  // ── Form open ────────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = async (row) => {
    setEditId(row.id);
    setModal(true);
    try {
      const r = await api.get(`${base}/${row.id}`);
      const a = r.data;
      setForm({
        title:         a.title         || '',
        title_vi:      a.title_vi      || '',
        summary_vi:    a.summary_vi    || '',
        level:         a.level         || '',
        thumbnail_url: a.thumbnail_url || '',
        content:       a.content       || '',
        segments:      Array.isArray(a.segments)  ? a.segments  : [],
        questions:     Array.isArray(a.questions) ? a.questions : [],
        vocab:         Array.isArray(a.vocab)     ? a.vocab     : [],
        grammar:       Array.isArray(a.grammar)   ? a.grammar   : [],
        is_published:  a.is_published  || false,
      });
    } catch (e) {
      showAlert('error', e.message);
    }
  };

  // ── Generate segments (AI) ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenerating(true);
    try {
      const r = await api.post(`${base}/generate-segments`, { content: form.content });
      setForm(f => ({ ...f, segments: r.data.segments || [] }));
      showAlert('success', `Đã tách & sinh ${r.data.segments?.length || 0} câu. Hãy kiểm tra lại trước khi lưu.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Tách câu THỦ CÔNG (không AI): dán text lẫn Nhật + Việt → segments + furigana ──
  const handleSegmentManual = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setSegmenting(true);
    try {
      const r = await api.post(`${base}/segment-manual`, { text: form.content });
      setForm(f => ({ ...f, segments: r.data.segments || [], content: r.data.content || f.content }));
      showAlert('success', `Đã tách ${r.data.segments?.length || 0} câu (furigana tạo tự động). Hãy kiểm tra & sửa nếu cần.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSegmenting(false);
    }
  };

  // ── Đọc nội dung từ file .txt/.docx đổ vào ô nội dung ────────────────────────
  const handleParseFile = async (file) => {
    if (!file) return;
    setParsingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`${base}/parse-file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, content: r.data.text || '' }));
      showAlert('success', 'Đã đọc nội dung file. Bạn có thể tách câu bằng AI hoặc thủ công.');
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setParsingFile(false);
    }
  };

  // ── AI soạn bài đọc gốc theo chủ đề + level ──────────────────────────────────
  const handleCompose = async (topic, length) => {
    if (!topic.trim()) return showAlert('error', 'Hãy nhập chủ đề bài đọc.');
    setComposing(true);
    try {
      const r = await api.post(`${base}/generate-article`, { topic, level: form.level, length });
      setForm(f => ({
        ...f,
        title:      r.data.title      || f.title,
        title_vi:   r.data.title_vi   || f.title_vi,
        summary_vi: r.data.summary_vi || f.summary_vi,
        content:    r.data.content    || f.content,
      }));
      showAlert('success', 'AI đã soạn xong bài. Hãy đọc lại, chỉnh sửa rồi tách câu.');
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setComposing(false);
    }
  };

  // ── AI sinh câu hỏi trắc nghiệm đọc hiểu ─────────────────────────────────────
  const handleGenQuestions = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenQuiz(true);
    try {
      const r = await api.post(`${base}/generate-questions`, { content: form.content, level: form.level });
      setForm(f => ({ ...f, questions: r.data.questions || [] }));
      showAlert('success', `Đã sinh ${r.data.questions?.length || 0} câu hỏi. Hãy kiểm tra lại trước khi lưu.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenQuiz(false);
    }
  };

  // ── Sinh từ vựng (từ điển hệ thống) & ngữ pháp (AI) ──────────────────────────
  const handleGenVocabGrammar = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenVocab(true);
    try {
      const r = await api.post(`${base}/generate-vocab-grammar`, { content: form.content, level: form.level });
      setForm(f => ({ ...f, vocab: r.data.vocab || [], grammar: r.data.grammar || [] }));
      if (r.data.grammarError) showAlert('error', `Từ vựng OK nhưng ngữ pháp lỗi: ${r.data.grammarError}`);
      else showAlert('success', `Đã sinh ${r.data.vocab?.length || 0} từ vựng & ${r.data.grammar?.length || 0} điểm ngữ pháp.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenVocab(false);
    }
  };

  // ── Thumbnail upload (dùng lại bucket passage-images) ─────────────────────────
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post(uploadPath, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, thumbnail_url: r.data.url }));
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Segment edit helpers ──────────────────────────────────────────────────────
  const updateSeg = (i, key, val) =>
    setForm(f => ({ ...f, segments: f.segments.map((s, idx) => idx === i ? { ...s, [key]: val } : s) }));
  const removeSeg = (i) =>
    setForm(f => ({ ...f, segments: f.segments.filter((_, idx) => idx !== i) }));
  const addSeg = () =>
    setForm(f => ({ ...f, segments: [...f.segments, { jp: '', furigana: '', vi: '' }] }));

  // ── Edit helpers dùng chung cho questions / vocab / grammar ──────────────────
  const updateItem = (key, i, field, val) =>
    setForm(f => ({ ...f, [key]: f[key].map((it, idx) => idx === i ? { ...it, [field]: val } : it) }));
  const removeItem = (key, i) =>
    setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));
  const addItem = (key, empty) =>
    setForm(f => ({ ...f, [key]: [...f[key], empty] }));
  const updateOption = (i, j, val) =>
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, idx) =>
        idx === i ? { ...q, options: q.options.map((o, oIdx) => oIdx === j ? val : o) } : q),
    }));
  const updateOptionVi = (i, j, val) =>
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, idx) => {
        if (idx !== i) return q;
        const options_vi = Array.isArray(q.options_vi) ? [...q.options_vi] : ['', '', '', ''];
        options_vi[j] = val;
        return { ...q, options_vi };
      }),
    }));

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) return showAlert('error', 'Tiêu đề (tiếng Nhật) là bắt buộc.');
    setSaving(true);
    try {
      if (editId) await api.put(`${base}/${editId}`, form);
      else        await api.post(base, form);
      showAlert('success', editId ? 'Đã cập nhật bài đọc.' : 'Đã tạo bài đọc.');
      setModal(false);
      fetchNews();
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`${base}/${deleteTarget.id}`);
      showAlert('success', 'Đã xóa bài đọc.');
      setDeleteTarget(null);
      if (data.length === 1 && page > 1) setPage(p => p - 1);
      else fetchNews();
    } catch (e) {
      showAlert('error', e.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Layout title={title}>
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            Luyện đọc <span className="ml-2 text-lg font-normal text-on-muted">({total})</span>
          </h1>
          <p className="text-sm text-on-muted mt-0.5">
            Soạn bài đọc tiếng Nhật (AI hỗ trợ), sinh furigana + bản dịch + quiz + từ vựng, rồi đăng cho học viên.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={() => navigate('/admin/reading/preview')}>
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem như học viên
          </Button>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo bài đọc mới
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-xl pointer-events-none">search</span>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm theo tiêu đề..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">auto_stories</span>
          <p className="text-lg font-semibold text-charcoal mb-1">
            {search ? 'Không tìm thấy bài đọc' : 'Chưa có bài đọc nào'}
          </p>
          <p className="text-sm mb-6">Tạo bài đọc đầu tiên cho học viên</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {data.map(row => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-surface-low overflow-hidden shrink-0 flex items-center justify-center">
                {row.thumbnail_url
                  ? <img src={row.thumbnail_url} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  : <span className="material-symbols-outlined text-outline/40">auto_stories</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate">{row.title}</p>
                {row.title_vi && <p className="text-xs text-on-muted truncate">{row.title_vi}</p>}
              </div>
              {row.level && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${LEVEL_STYLE[row.level] || 'bg-gray-100 text-gray-600'}`}>
                  {row.level}
                </span>
              )}
              <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                row.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {row.is_published ? 'Đã đăng' : 'Nháp'}
              </span>
              <span className="text-xs text-on-muted hidden sm:flex items-center gap-1 w-14 justify-end" title="Lượt xem">
                <span className="material-symbols-outlined text-[15px]">visibility</span>
                {row.view_count ?? 0}
              </span>
              <span className="text-xs text-on-muted hidden md:block w-20 text-right" title="Ngày đăng">
                {row.published_at ? new Date(row.published_at).toLocaleDateString('vi') : '—'}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => navigate(`/admin/reading/preview/${row.id}`)} title="Xem như học viên"
                  className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                </button>
                <button onClick={() => openEdit(row)} title="Sửa"
                  className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onClick={() => setDeleteTarget(row)} title="Xóa"
                  className="p-1.5 text-on-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 transition-colors">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm hover:bg-surface-low disabled:opacity-40 transition-colors">Tiếp →</button>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa bài đọc' : 'Tạo bài đọc mới'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>{editId ? 'Lưu thay đổi' : 'Tạo bài đọc'}</Button>
          </>
        }
      >
        <ReadingForm
          form={form}
          onChange={setForm}
          onGenerate={handleGenerate}
          generating={generating}
          onSegmentManual={handleSegmentManual}
          segmenting={segmenting}
          onParseFile={handleParseFile}
          parsingFile={parsingFile}
          onCompose={handleCompose}
          composing={composing}
          onGenQuestions={handleGenQuestions}
          genQuiz={genQuiz}
          onGenVocabGrammar={handleGenVocabGrammar}
          genVocab={genVocab}
          onUpload={handleUpload}
          uploading={uploading}
          updateSeg={updateSeg}
          removeSeg={removeSeg}
          addSeg={addSeg}
          updateItem={updateItem}
          removeItem={removeItem}
          addItem={addItem}
          updateOption={updateOption}
          updateOptionVi={updateOptionVi}
        />
      </Modal>

      {/* Delete modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xóa bài đọc"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              Xóa vĩnh viễn
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-800">
          <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">warning</span>
          <p>Bài đọc <strong>"{deleteTarget?.title}"</strong> sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</p>
        </div>
      </Modal>
    </Layout>
  );
}

export default function AdminReading() {
  return <ReadingManager />;
}

// ── Form ──────────────────────────────────────────────────────────────────────
// hidePublish/hideTitles: bài đọc gắn với Mục khóa học — trạng thái đăng và tiêu đề
// (Nhật/Việt) lấy theo thông tin Mục (LessonInfoPanel), không nhập lại ở đây.
export function ReadingForm({
  form, onChange, onGenerate, generating, onSegmentManual, segmenting, onParseFile, parsingFile,
  onCompose, composing, onGenQuestions, genQuiz, onGenVocabGrammar, genVocab,
  onUpload, uploading, updateSeg, removeSeg, addSeg,
  updateItem, removeItem, addItem, updateOption, updateOptionVi,
  hidePublish = false,
  hideTitles = false,
}) {
  const [topic, setTopic]   = useState('');
  const [length, setLength] = useState('medium');

  return (
    <div className="space-y-4">
      {/* ── AI soạn bài đọc gốc (tùy chọn) ─────────────────────────────────────── */}
      <div className="bg-sumire-purple/5 border border-sumire-purple/20 rounded-xl p-3 space-y-2">
        <p className="text-sm font-semibold text-charcoal flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sumire-purple text-[20px]">auto_awesome</span>
          AI soạn bài đọc mới
        </p>
        <p className="text-xs text-on-muted">
          Nhập chủ đề (và chọn cấp độ JLPT bên dưới) — AI sẽ tự sáng tác bài đọc gốc, không sao chép nguồn nào.
          Bạn vẫn nên đọc lại và chỉnh sửa trước khi dùng.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Chủ đề, vd: Văn hóa trà đạo Nhật Bản..."
            className="flex-1 px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
          />
          <select
            value={length}
            onChange={e => setLength(e.target.value)}
            className="px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
          >
            <option value="short">Ngắn (~400 ký tự)</option>
            <option value="medium">Vừa (~650 ký tự)</option>
            <option value="long">Dài (~1000 ký tự)</option>
          </select>
          <Button variant="purple" size="sm" loading={composing} onClick={() => onCompose(topic, length)}>
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            Soạn bài
          </Button>
        </div>
      </div>

      {/* Metadata */}
      {!hideTitles && (
        <>
          <Input
            label="Tiêu đề (Tiếng Nhật) *"
            value={form.title}
            onChange={e => onChange({ ...form, title: e.target.value })}
            placeholder="記事のタイトル..."
          />
          <Input
            label="Tiêu đề (Tiếng Việt)"
            value={form.title_vi}
            onChange={e => onChange({ ...form, title_vi: e.target.value })}
            placeholder="Dịch tiêu đề..."
          />
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả ngắn (hiển thị ở thẻ danh sách)</label>
        <textarea
          value={form.summary_vi}
          onChange={e => onChange({ ...form, summary_vi: e.target.value })}
          rows={2}
          placeholder="Tóm tắt ngắn bằng tiếng Việt..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
          <select
            value={form.level}
            onChange={e => onChange({ ...form, level: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
          >
            <option value="">-- Chọn cấp độ --</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        {!hidePublish && (
        <div className="flex flex-col justify-end">
          <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
          <button
            type="button"
            onClick={() => onChange({ ...form, is_published: !form.is_published })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              form.is_published
                ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                : 'bg-surface-low border-outline text-on-muted hover:bg-outline/20'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{form.is_published ? 'public' : 'draft'}</span>
            {form.is_published ? 'Đăng cho học viên' : 'Bản nháp'}
          </button>
        </div>
        )}
      </div>

      {/* Thumbnail */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Ảnh thumbnail</label>
        <div className="flex items-center gap-3">
          {form.thumbnail_url && (
            <img src={form.thumbnail_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-low shrink-0" />
          )}
          <Input
            className="flex-1"
            value={form.thumbnail_url}
            onChange={e => onChange({ ...form, thumbnail_url: e.target.value })}
            placeholder="Dán URL hoặc tải ảnh lên →"
          />
          <label className="shrink-0 cursor-pointer inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border border-outline text-sm font-medium text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">
            <span className="material-symbols-outlined text-[18px]">{uploading ? 'progress_activity' : 'upload'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={e => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>

      {/* Content + generate */}
      <div className="pt-2 border-t border-outline/30">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-on-muted">Nội dung bài đọc</label>
          {/* Tải nội dung từ file .txt/.docx */}
          <label className={`shrink-0 cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            parsingFile ? 'border-outline text-on-muted' : 'border-outline text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red'
          }`}>
            <span className={`material-symbols-outlined text-[16px] ${parsingFile ? 'animate-spin' : ''}`}>{parsingFile ? 'progress_activity' : 'upload_file'}</span>
            {parsingFile ? 'Đang đọc...' : 'Tải file (.txt/.docx)'}
            <input type="file" accept=".txt,.docx" className="hidden" disabled={parsingFile}
              onChange={e => { onParseFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
        <textarea
          value={form.content}
          onChange={e => onChange({ ...form, content: e.target.value })}
          rows={5}
          placeholder="Dán nội dung tiếng Nhật (có thể kèm bản dịch tiếng Việt) vào đây, hoặc tải file lên..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-y leading-relaxed"
        />
        <p className="text-xs text-on-muted mt-1.5">
          <strong>Tách câu &amp; dịch (AI):</strong> AI tự dịch từng câu. <strong>Tách câu (không AI):</strong> nhanh, dùng khi
          bạn đã có sẵn bản dịch tiếng Việt — dán lẫn Nhật + Việt, hệ thống tự phân loại và ghép cặp, furigana tạo tự động.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button variant="purple" size="sm" loading={generating} onClick={onGenerate}>
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Tách câu &amp; dịch (AI)
          </Button>
          <Button variant="secondary" size="sm" loading={segmenting} onClick={onSegmentManual}>
            <span className="material-symbols-outlined text-[18px]">content_cut</span>
            Tách câu (không AI)
          </Button>
        </div>
      </div>

      {/* Segments review */}
      {form.segments.length > 0 && (
        <div className="pt-2 border-t border-outline/30">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-on-muted">
              Câu đã tách ({form.segments.length}) — kiểm tra &amp; sửa trước khi lưu
            </label>
            <button type="button" onClick={addSeg}
              className="text-xs font-semibold text-tsubaki-red hover:underline inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span> Thêm câu
            </button>
          </div>
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
            {form.segments.map((seg, i) => (
              <div key={i} className="relative bg-surface-low/50 border border-outline/40 rounded-xl p-3 space-y-2">
                <button type="button" onClick={() => removeSeg(i)}
                  className="absolute top-2 right-2 text-on-muted hover:text-error transition-colors" title="Xóa câu">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <SegField label="Câu (JP)" value={seg.jp} onChange={v => updateSeg(i, 'jp', v)} />
                <SegField label="Furigana (ruby HTML)" value={seg.furigana} onChange={v => updateSeg(i, 'furigana', v)} mono />
                <SegField label="Dịch (VI)" value={seg.vi} onChange={v => updateSeg(i, 'vi', v)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quiz đọc hiểu ──────────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-outline/30">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-on-muted">
            Câu hỏi trắc nghiệm ({form.questions.length})
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => addItem('questions', { question: '', question_vi: '', options: ['', '', '', ''], options_vi: ['', '', '', ''], answer: 0, explanation_vi: '' })}
              className="text-xs font-semibold text-tsubaki-red hover:underline inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span> Thêm câu hỏi
            </button>
            <Button variant="purple" size="sm" loading={genQuiz} onClick={onGenQuestions}>
              <span className="material-symbols-outlined text-[18px]">quiz</span>
              Sinh câu hỏi bằng AI
            </Button>
          </div>
        </div>
        {form.questions.length > 0 && (
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
            {form.questions.map((q, i) => (
              <div key={i} className="relative bg-surface-low/50 border border-outline/40 rounded-xl p-3 space-y-2">
                <button type="button" onClick={() => removeItem('questions', i)}
                  className="absolute top-2 right-2 text-on-muted hover:text-error transition-colors" title="Xóa câu hỏi">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <SegField label={`Câu hỏi ${i + 1}`} value={q.question} onChange={v => updateItem('questions', i, 'question', v)} />
                <SegField label="Bản dịch câu hỏi (VI)" value={q.question_vi || ''} onChange={v => updateItem('questions', i, 'question_vi', v)} />
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-on-muted uppercase tracking-wide">Lựa chọn (chọn đáp án đúng) — kèm bản dịch tiếng Việt</label>
                  {(q.options || []).map((opt, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.answer === j}
                        onChange={() => updateItem('questions', i, 'answer', j)}
                        className="shrink-0 accent-green-600"
                        title="Đáp án đúng"
                      />
                      <input
                        value={opt}
                        onChange={e => updateOption(i, j, e.target.value)}
                        placeholder={`Lựa chọn ${j + 1}`}
                        className={`flex-1 px-3 py-1.5 bg-white border rounded-lg text-sm outline-none transition-colors ${
                          q.answer === j ? 'border-green-400 focus:border-green-500' : 'border-outline focus:border-tsubaki-red'
                        }`}
                      />
                      <input
                        value={q.options_vi?.[j] || ''}
                        onChange={e => updateOptionVi(i, j, e.target.value)}
                        placeholder={`Dịch ${j + 1}`}
                        className="flex-1 px-3 py-1.5 bg-white border border-outline rounded-lg text-sm text-on-muted outline-none focus:border-sumire-purple transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <SegField label="Giải thích (VI)" value={q.explanation_vi} onChange={v => updateItem('questions', i, 'explanation_vi', v)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Từ vựng & Ngữ pháp ─────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-outline/30">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-on-muted">
            Từ vựng ({form.vocab.length}) &amp; Ngữ pháp ({form.grammar.length})
          </label>
          <Button variant="purple" size="sm" loading={genVocab} onClick={onGenVocabGrammar}>
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Sinh từ vựng &amp; ngữ pháp
          </Button>
        </div>

        {/* Vocab */}
        {form.vocab.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-on-muted uppercase tracking-wide">Từ vựng</span>
              <button type="button" onClick={() => addItem('vocab', { word: '', reading: '', meaning_vi: '', entry_id: null, jlpt_level: null })}
                className="text-xs font-semibold text-tsubaki-red hover:underline inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">add</span> Thêm từ
              </button>
            </div>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
              {form.vocab.map((v, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface-low/50 border border-outline/40 rounded-lg p-2">
                  <input value={v.word} onChange={e => updateItem('vocab', i, 'word', e.target.value)}
                    placeholder="Từ" className="w-24 px-2 py-1.5 bg-white border border-outline rounded text-sm outline-none focus:border-tsubaki-red" />
                  <input value={v.reading} onChange={e => updateItem('vocab', i, 'reading', e.target.value)}
                    placeholder="Cách đọc" className="w-28 px-2 py-1.5 bg-white border border-outline rounded text-sm outline-none focus:border-tsubaki-red" />
                  <input value={v.meaning_vi} onChange={e => updateItem('vocab', i, 'meaning_vi', e.target.value)}
                    placeholder="Nghĩa tiếng Việt" className="flex-1 px-2 py-1.5 bg-white border border-outline rounded text-sm outline-none focus:border-tsubaki-red" />
                  {v.jlpt_level && <span className="text-[10px] font-bold text-on-muted shrink-0">{v.jlpt_level}</span>}
                  <button type="button" onClick={() => removeItem('vocab', i)}
                    className="shrink-0 text-on-muted hover:text-error transition-colors" title="Xóa từ">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grammar */}
        {form.grammar.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-on-muted uppercase tracking-wide">Ngữ pháp</span>
              <button type="button" onClick={() => addItem('grammar', { pattern: '', explanation_vi: '', example_jp: '' })}
                className="text-xs font-semibold text-tsubaki-red hover:underline inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">add</span> Thêm điểm ngữ pháp
              </button>
            </div>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
              {form.grammar.map((g, i) => (
                <div key={i} className="relative bg-surface-low/50 border border-outline/40 rounded-lg p-3 space-y-2">
                  <button type="button" onClick={() => removeItem('grammar', i)}
                    className="absolute top-2 right-2 text-on-muted hover:text-error transition-colors" title="Xóa">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                  <input value={g.pattern} onChange={e => updateItem('grammar', i, 'pattern', e.target.value)}
                    placeholder="Mẫu ngữ pháp, vd 〜ながら" className="w-full px-2 py-1.5 bg-white border border-outline rounded text-sm font-semibold outline-none focus:border-tsubaki-red" />
                  <SegField label="Giải thích (VI)" value={g.explanation_vi} onChange={v => updateItem('grammar', i, 'explanation_vi', v)} />
                  <SegField label="Ví dụ (JP)" value={g.example_jp} onChange={v => updateItem('grammar', i, 'example_jp', v)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SegField({ label, value, onChange, mono }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-on-muted uppercase tracking-wide mb-0.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={mono ? 2 : 1}
        className={`w-full px-3 py-2 bg-white border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red transition-colors resize-y ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  );
}
