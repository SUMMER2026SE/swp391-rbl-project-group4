import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import LessonInfoPanel from '../../components/shared/LessonInfoPanel';
import { ReadingForm } from './AdminReading';
import api from '../../lib/api';

const EMPTY = {
  title: '', title_vi: '', summary_vi: '', level: '',
  thumbnail_url: '',
  content: '', segments: [], questions: [], vocab: [], grammar: [],
};

// Soạn bài đọc cho Mục "Bài đọc" của khóa học — dùng chung cơ chế
// reading_module.articles + editor cấu trúc của trang Luyện đọc (ReadingForm):
// AI tách câu/furigana/dịch, sinh quiz, từ vựng & ngữ pháp. Lưu qua
// PUT {apiBase}/lessons/:lessonId/reading (upsert article gắn với lesson).
export default function AdminLessonReading() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();
  const { apiBase, Layout, isTeacher } = useEditorArea();
  // Các endpoint AI hỗ trợ soạn bài tái dùng nguyên vẹn từ trang Luyện đọc
  const aiBase     = isTeacher ? '/teacher/my-reading' : '/admin/reading';
  const uploadPath = `${apiBase}/reading-passages/upload`;

  const [lesson, setLesson]   = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [generating, setGenerating] = useState(false);
  const [composing, setComposing]   = useState(false);
  const [genQuiz, setGenQuiz]       = useState(false);
  const [genVocab, setGenVocab]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [segmenting, setSegmenting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  // ── Load: thông tin Mục + article đã gắn (404 = chưa có → form trống) ────────
  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`${apiBase}/lessons/${lessonId}`);
        setLesson(r.data);
        try {
          const a = (await api.get(`${apiBase}/lessons/reading/${lessonId}`)).data;
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
          });
        } catch (e) {
          if (e.status !== 404) throw e;
          // Chưa có bài đọc — form trống, lưu lần đầu sẽ tạo article mới
        }
      } catch (e) {
        setAlert({ type: 'error', msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lessonId]);

  // ── Save (upsert article gắn với lesson) ─────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      // Tiêu đề Nhật/Việt lấy theo thông tin Mục (server tự đồng bộ) — không gửi từ form
      const { title, title_vi, ...payload } = form;
      await api.put(`${apiBase}/lessons/${lessonId}/reading`, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── AI helpers (tái dùng endpoint của trang Luyện đọc) ───────────────────────
  const handleGenerate = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenerating(true);
    try {
      const r = await api.post(`${aiBase}/generate-segments`, { content: form.content });
      setForm(f => ({ ...f, segments: r.data.segments || [] }));
      showAlert('success', `Đã tách & sinh ${r.data.segments?.length || 0} câu. Hãy kiểm tra lại trước khi lưu.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSegmentManual = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setSegmenting(true);
    try {
      const r = await api.post(`${aiBase}/segment-manual`, { text: form.content });
      setForm(f => ({ ...f, segments: r.data.segments || [], content: r.data.content || f.content }));
      showAlert('success', `Đã tách ${r.data.segments?.length || 0} câu (furigana tạo tự động). Hãy kiểm tra & sửa nếu cần.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSegmenting(false);
    }
  };

  const handleParseFile = async (file) => {
    if (!file) return;
    setParsingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`${aiBase}/parse-file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, content: r.data.text || '' }));
      showAlert('success', 'Đã đọc nội dung file. Bạn có thể tách câu bằng AI hoặc thủ công.');
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setParsingFile(false);
    }
  };

  const handleCompose = async (topic, length) => {
    if (!topic.trim()) return showAlert('error', 'Hãy nhập chủ đề bài đọc.');
    setComposing(true);
    try {
      const r = await api.post(`${aiBase}/generate-article`, { topic, level: form.level, length });
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

  const handleGenQuestions = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenQuiz(true);
    try {
      const r = await api.post(`${aiBase}/generate-questions`, { content: form.content, level: form.level });
      setForm(f => ({ ...f, questions: r.data.questions || [] }));
      showAlert('success', `Đã sinh ${r.data.questions?.length || 0} câu hỏi. Hãy kiểm tra lại trước khi lưu.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenQuiz(false);
    }
  };

  const handleGenVocabGrammar = async () => {
    if (!form.content.trim()) return showAlert('error', 'Hãy nhập nội dung bài đọc trước.');
    setGenVocab(true);
    try {
      const r = await api.post(`${aiBase}/generate-vocab-grammar`, { content: form.content, level: form.level });
      setForm(f => ({ ...f, vocab: r.data.vocab || [], grammar: r.data.grammar || [] }));
      if (r.data.grammarError) showAlert('error', `Từ vựng OK nhưng ngữ pháp lỗi: ${r.data.grammarError}`);
      else showAlert('success', `Đã sinh ${r.data.vocab?.length || 0} từ vựng & ${r.data.grammar?.length || 0} điểm ngữ pháp.`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setGenVocab(false);
    }
  };

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

  // ── Edit helpers (segments / questions / vocab / grammar) ────────────────────
  const updateSeg = (i, key, val) =>
    setForm(f => ({ ...f, segments: f.segments.map((s, idx) => idx === i ? { ...s, [key]: val } : s) }));
  const removeSeg = (i) =>
    setForm(f => ({ ...f, segments: f.segments.filter((_, idx) => idx !== i) }));
  const addSeg = () =>
    setForm(f => ({ ...f, segments: [...f.segments, { jp: '', furigana: '', vi: '' }] }));

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

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  if (loading) {
    return (
      <Layout title="Soạn thảo bài đọc">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Soạn thảo bài đọc">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-2">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại Course Builder
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/10 text-primary px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">description</span>
              Reading
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">
            {lesson?.title || 'Bài học đọc'}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <span className="material-symbols-outlined text-base">check_circle</span>
              Đã lưu
            </span>
          )}
          <Button variant="secondary" onClick={() => navigate(`${apiBase}/lessons/${lessonId}/reading-view`)}>
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem như học viên
          </Button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Đang lưu...' : 'Lưu nội dung'}
          </button>
        </div>
      </section>

      <LessonInfoPanel lesson={lesson} apiBase={apiBase} onSaved={u => setLesson(l => ({ ...l, ...u }))} />

      {/* Editor cấu trúc dùng chung với trang Luyện đọc */}
      <div className="bg-white rounded-2xl border border-outline/20 shadow-sm p-5">
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
          hidePublish
          hideTitles
        />
      </div>
    </Layout>
  );
}
