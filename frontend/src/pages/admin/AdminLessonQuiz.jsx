import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import QuestionTypeForm from '../../components/admin/QuestionTypeForm';
import ProctoredAttemptsModal from '../../components/admin/ProctoredAttemptsModal';
import {
  EMPTY_Q_FORM, QUESTION_TYPES, TYPE_MAP, LEVEL_COLORS, DIFF_COLORS,
  formToPayload, rowToForm,
} from '../../utils/questionFormHelpers';
import api from '../../lib/api';

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const cfg = TYPE_MAP[type];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── Answer preview ────────────────────────────────────────────────────────────

function AnswerPreview({ q }) {
  const typ = q.question_type || 'single_choice';
  const opts = q.options;
  const ca = q.correct_answer_data ?? q.correct_answer;

  if (typ === 'single_choice' && Array.isArray(opts)) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {opts.map((o, i) => (
          <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full border ${o === ca ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold' : 'border-outline/40 text-on-muted'}`}>
            {String.fromCharCode(65 + i)}. {o}
          </span>
        ))}
      </div>
    );
  }
  if (typ === 'multiple_choice' && Array.isArray(opts)) {
    const correct = Array.isArray(ca) ? ca : [];
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {opts.map((o, i) => (
          <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full border ${correct.includes(o) ? 'border-violet-400 bg-violet-50 text-violet-700 font-bold' : 'border-outline/40 text-on-muted'}`}>
            {String.fromCharCode(65 + i)}. {o}
          </span>
        ))}
      </div>
    );
  }
  if (typ === 'matching' && Array.isArray(opts)) {
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {opts.map((p, i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
            {p.left} → {p.right}
          </span>
        ))}
      </div>
    );
  }
  if ((typ === 'fill_blank' || typ === 'short_answer') && ca) {
    return <p className="text-[11px] text-emerald-700 mt-1">Đáp án: {Array.isArray(ca) ? ca.join(', ') : ca}</p>;
  }
  return null;
}

// ── Bank Import Modal ─────────────────────────────────────────────────────────

function BankImportModal({ open, onClose, onImport, saving }) {
  const [bankItems, setBankItems] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [selected, setSelected]   = useState([]);

  const fetchBank = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: 1, limit: 50, status: 'approved' });
      if (filterType)  params.set('question_type', filterType);
      if (filterLevel) params.set('level', filterLevel);
      if (search)      params.set('search', search);
      const r = await api.get(`/admin/question-bank?${params}`);
      setBankItems(r.data.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [search, filterType, filterLevel]);

  useEffect(() => { if (open) { setSelected([]); fetchBank(); } }, [open, fetchBank]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <Modal open={open} onClose={onClose} title="Thêm câu hỏi từ ngân hàng đề" size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          <Button onClick={() => onImport(selected)} loading={saving} disabled={!selected.length}>
            <span className="material-symbols-outlined text-lg">download</span>
            Nhập {selected.length > 0 ? `(${selected.length})` : ''} câu hỏi
          </Button>
        </>
      }>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text" placeholder="Tìm kiếm câu hỏi..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
          <option value="">Tất cả loại</option>
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
          <option value="">Tất cả trình độ</option>
          {['N5','N4','N3','N2','N1'].map(l => <option key={l}>{l}</option>)}
        </select>
        <button onClick={fetchBank} className="px-3 py-2 rounded-xl bg-sumire-purple/10 text-sumire-purple hover:bg-sumire-purple/20 transition-colors text-sm font-medium">
          <span className="material-symbols-outlined text-[16px] align-middle">search</span>
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs text-on-muted">
        <span>{bankItems.length} câu hỏi{selected.length > 0 ? ` — đã chọn ${selected.length}` : ''}</span>
        <div className="flex gap-2">
          <button onClick={() => setSelected(bankItems.map(i => i.id))} className="hover:text-sumire-purple transition-colors">Chọn tất cả</button>
          {selected.length > 0 && <button onClick={() => setSelected([])} className="hover:text-error transition-colors">Bỏ chọn</button>}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-on-muted">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          </div>
        ) : bankItems.length === 0 ? (
          <div className="text-center py-8 text-on-muted">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">inventory_2</span>
            Không tìm thấy câu hỏi nào
          </div>
        ) : bankItems.map(item => (
          <label key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected.includes(item.id) ? 'border-sumire-purple bg-sumire-purple/5' : 'border-outline/30 hover:border-sumire-purple/40'}`}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="mt-0.5 accent-sumire-purple w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-1">
                <TypeBadge type={item.question_type} />
                {item.level && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[item.level] || 'bg-gray-100 text-gray-600'}`}>{item.level}</span>}
                {item.difficulty && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${DIFF_COLORS[item.difficulty] || ''}`}>{item.difficulty}</span>}
              </div>
              <p className="text-sm text-charcoal line-clamp-2">{item.question_text}</p>
              <AnswerPreview q={item} />
            </div>
          </label>
        ))}
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLessonQuiz() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();

  const [lesson, setLesson]       = useState(null);
  const [quiz, setQuiz]           = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [alert, setAlert]         = useState({ type: '', msg: '' });

  // Quiz settings modal
  const [settingsModal, setSettingsModal]   = useState(false);
  const [quizForm, setQuizForm]             = useState({ title: '', time_limit: '', is_published: false, mode: 'normal' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Question modal (create / edit)
  const [qModal, setQModal]   = useState(false);
  const [qForm, setQForm]     = useState(EMPTY_Q_FORM);
  const [editQId, setEditQId] = useState(null);
  const [savingQ, setSavingQ] = useState(false);

  // Bank import modal
  const [bankModal, setBankModal]   = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  // Proctored attempts modal
  const [attemptsModal, setAttemptsModal] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadLesson = async () => {
    const r = await api.get(`/admin/lessons/${lessonId}`);
    return r.data;
  };

  const loadQuiz = async () => {
    const r = await api.get(`/admin/quizzes?lesson_id=${lessonId}`);
    return (r.data || [])[0] || null;
  };

  const loadQuestions = async (quizId) => {
    const r = await api.get(`/admin/quizzes/${quizId}/questions`);
    return r.data || [];
  };

  const load = async () => {
    setLoading(true);
    try {
      const [lessonData, quizData] = await Promise.all([loadLesson(), loadQuiz()]);
      setLesson(lessonData);
      setQuiz(quizData);
      if (quizData) setQuestions(await loadQuestions(quizData.id));
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [lessonId]);

  // ── Create quiz ─────────────────────────────────────────────────────────────

  const createQuiz = async () => {
    try {
      const r = await api.post('/admin/quizzes', {
        title: lesson?.title || 'Quiz',
        lesson_id: lessonId,
        type: 'mixed',
      });
      setQuiz(r.data);
      setQuestions([]);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Quiz settings ───────────────────────────────────────────────────────────

  const openSettings = () => {
    setQuizForm({ title: quiz.title || '', time_limit: quiz.time_limit || '', is_published: quiz.is_published || false, mode: quiz.mode || 'normal' });
    setSettingsModal(true);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const r = await api.put(`/admin/quizzes/${quiz.id}`, {
        title: quizForm.title,
        time_limit: quizForm.time_limit ? Number(quizForm.time_limit) : null,
        is_published: quizForm.is_published,
        mode: quizForm.mode,
      });
      setQuiz(r.data);
      setSettingsModal(false);
      setAlert({ type: 'success', msg: 'Đã cập nhật quiz.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Questions CRUD ──────────────────────────────────────────────────────────

  const openAddQ = () => { setQForm(EMPTY_Q_FORM); setEditQId(null); setQModal(true); };
  const openEditQ = (q) => { setQForm(rowToForm(q)); setEditQId(q.id); setQModal(true); };

  const saveQuestion = async () => {
    if (!qForm.question_text.trim()) return setAlert({ type: 'error', msg: 'Nội dung câu hỏi không được để trống.' });
    setSavingQ(true);
    try {
      const payload = { ...formToPayload(qForm), quiz_id: quiz.id, order_index: questions.length };
      if (editQId) {
        await api.put(`/admin/questions/${editQId}`, payload);
      } else {
        await api.post('/admin/questions', payload);
      }
      setQModal(false);
      setQuestions(await loadQuestions(quiz.id));
      setAlert({ type: 'success', msg: editQId ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSavingQ(false);
    }
  };

  const deleteQuestion = async (q) => {
    if (!confirm(`Xóa câu hỏi này?`)) return;
    try {
      await api.delete(`/admin/questions/${q.id}`);
      setQuestions(qs => qs.filter(x => x.id !== q.id));
      setAlert({ type: 'success', msg: 'Đã xóa câu hỏi.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Import from bank ────────────────────────────────────────────────────────

  const handleImport = async (ids) => {
    if (!ids.length) return;
    setImportSaving(true);
    try {
      await api.post(`/admin/quizzes/${quiz.id}/import-from-bank`, { question_ids: ids });
      setBankModal(false);
      setQuestions(await loadQuestions(quiz.id));
      setAlert({ type: 'success', msg: `Đã nhập ${ids.length} câu hỏi.` });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setImportSaving(false);
    }
  };

  // ── Back ────────────────────────────────────────────────────────────────────

  const goBack = () => {
    if (lesson?.course_id) navigate(`/admin/courses/${lesson.course_id}/edit`);
    else navigate('/admin/courses');
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminLayout title="Quiz bài học">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Quiz bài học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* Header */}
      <section className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại Course Builder
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-tsubaki-red/10 text-tsubaki-red px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">quiz</span>
              Quiz
            </span>
            {quiz?.is_published && (
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">Đã xuất bản</span>
            )}
            {quiz?.mode === 'proctored' && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">verified_user</span>Giám sát
              </span>
            )}
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">
            {lesson?.title || 'Bài học quiz'}
          </h1>
          {lesson?.title_ja && <p className="text-on-muted text-sm mt-0.5">{lesson.title_ja}</p>}
          {quiz && (
            <p className="text-on-muted text-sm mt-1">
              {questions.length} câu hỏi
              {quiz.time_limit ? ` • ${quiz.time_limit} phút` : ''}
            </p>
          )}
        </div>

        {quiz && (
          <div className="flex items-center gap-2 shrink-0">
            {quiz.mode === 'proctored' && (
              <button
                onClick={() => setAttemptsModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400/60 text-amber-700 text-sm font-medium hover:bg-amber-50 transition-all"
              >
                <span className="material-symbols-outlined text-base">policy</span>
                Bài làm giám sát
              </button>
            )}
            <button
              onClick={() => setBankModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sumire-purple/50 text-sumire-purple text-sm font-medium hover:bg-sumire-purple/10 transition-all"
            >
              <span className="material-symbols-outlined text-base">library_add</span>
              Từ ngân hàng đề
            </button>
            <button
              onClick={openAddQ}
              className="flex items-center gap-2 px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-lg active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Thêm câu hỏi
            </button>
            <button
              onClick={openSettings}
              className="p-2.5 border border-outline rounded-xl text-on-muted hover:text-tsubaki-red hover:border-tsubaki-red/40 transition-colors"
              title="Cài đặt quiz"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
          </div>
        )}
      </section>

      {/* No quiz yet */}
      {!quiz ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-7xl text-tsubaki-red/20 mb-4">quiz</span>
          <h2 className="text-xl font-bold text-on-surface mb-2">Bài học này chưa có quiz</h2>
          <p className="text-on-muted text-sm mb-8 max-w-sm">
            Tạo quiz để thêm câu hỏi trắc nghiệm, điền trống, nối kết quả và nhiều loại khác.
          </p>
          <button
            onClick={createQuiz}
            className="flex items-center gap-2 px-8 py-3 bg-tsubaki-red text-white rounded-2xl font-semibold hover:shadow-lg active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Tạo Quiz cho bài học này
          </button>
        </div>
      ) : (
        <>
          {/* Question list */}
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-outline/20 shadow-sm">
              <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-3">help_outline</span>
              <p className="text-lg font-semibold text-charcoal mb-1">Chưa có câu hỏi nào</p>
              <p className="text-sm text-on-muted mb-6">Thêm câu hỏi mới hoặc nhập từ ngân hàng đề</p>
              <div className="flex gap-3">
                <button onClick={() => setBankModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-sumire-purple/50 text-sumire-purple text-sm font-medium hover:bg-sumire-purple/10 transition-all">
                  <span className="material-symbols-outlined text-base">library_add</span>
                  Ngân hàng đề
                </button>
                <button onClick={openAddQ} className="flex items-center gap-2 px-5 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-md transition-all">
                  <span className="material-symbols-outlined text-base">add</span>
                  Tạo câu hỏi
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white border border-outline/20 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start gap-3">
                    {/* Number */}
                    <div className="w-8 h-8 shrink-0 rounded-full bg-tsubaki-red/10 flex items-center justify-center text-xs font-bold text-tsubaki-red">
                      {idx + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <TypeBadge type={q.question_type} />
                        {q.level && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[q.level] || 'bg-gray-100 text-gray-600'}`}>{q.level}</span>}
                        {q.difficulty && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${DIFF_COLORS[q.difficulty] || ''}`}>{q.difficulty}</span>}
                        {q.bank_question_id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container text-on-muted flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">library_books</span>
                            Ngân hàng
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-on-surface leading-relaxed">{q.question}</p>
                      <AnswerPreview q={q} />
                      {q.explanation && (
                        <p className="text-xs text-on-muted mt-2 italic border-l-2 border-outline/20 pl-2">{q.explanation}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEditQ(q)}
                        className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => deleteQuestion(q)}
                        className="p-1.5 text-on-muted hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add more */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setBankModal(true)}
                  className="py-4 border-2 border-dashed border-sumire-purple/25 rounded-2xl flex items-center justify-center gap-2 text-on-muted text-sm font-medium hover:border-sumire-purple/50 hover:text-sumire-purple transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest/50 group-hover:bg-sumire-purple group-hover:text-white transition-all flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">library_add</span>
                  </div>
                  Nhập từ ngân hàng đề
                </button>
                <button
                  onClick={openAddQ}
                  className="py-4 border-2 border-dashed border-outline/25 rounded-2xl flex items-center justify-center gap-2 text-on-muted text-sm font-medium hover:border-tsubaki-red/40 hover:text-tsubaki-red transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest/50 group-hover:bg-tsubaki-red group-hover:text-white transition-all flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">add</span>
                  </div>
                  Tạo câu hỏi mới
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quiz Settings Modal */}
      <Modal
        open={settingsModal}
        onClose={() => setSettingsModal(false)}
        title="Cài đặt Quiz"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSettingsModal(false)}>Hủy</Button>
            <Button loading={savingSettings} onClick={saveSettings}>Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề Quiz</label>
            <input
              type="text" value={quizForm.title}
              onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Thời gian giới hạn (phút)</label>
            <input
              type="number" min="0" value={quizForm.time_limit}
              onChange={e => setQuizForm(f => ({ ...f, time_limit: e.target.value }))}
              placeholder="Không giới hạn"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1.5">Chế độ thi</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'normal',    icon: 'edit_note',     label: 'Thường',   desc: 'Làm bài bình thường' },
                { val: 'proctored', icon: 'verified_user', label: 'Giám sát', desc: 'Toàn màn hình + webcam' },
              ].map(m => (
                <button key={m.val} type="button"
                  onClick={() => setQuizForm(f => ({ ...f, mode: m.val }))}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${quizForm.mode === m.val ? 'border-tsubaki-red bg-tsubaki-red/5' : 'border-outline hover:border-tsubaki-red/40'}`}>
                  <span className={`material-symbols-outlined text-lg ${quizForm.mode === m.val ? 'text-tsubaki-red' : 'text-on-muted'}`}>{m.icon}</span>
                  <p className="text-sm font-semibold mt-0.5">{m.label}</p>
                  <p className="text-[11px] text-on-muted">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setQuizForm(f => ({ ...f, is_published: !f.is_published }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${quizForm.is_published ? 'bg-tsubaki-red' : 'bg-outline/30'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${quizForm.is_published ? 'left-5' : 'left-0.5'}`} />
            </div>
            <span className="text-sm text-on-surface">Xuất bản quiz</span>
          </label>
        </div>
      </Modal>

      {/* Question Modal */}
      <Modal
        open={qModal}
        onClose={() => setQModal(false)}
        title={editQId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setQModal(false)}>Hủy</Button>
            <Button loading={savingQ} onClick={saveQuestion}>Lưu câu hỏi</Button>
          </>
        }
      >
        <QuestionTypeForm form={qForm} setForm={setQForm} showMeta={false} />
      </Modal>

      {/* Bank Import Modal */}
      <BankImportModal
        open={bankModal}
        onClose={() => setBankModal(false)}
        onImport={handleImport}
        saving={importSaving}
      />

      {/* Proctored Attempts Modal */}
      {quiz && <ProctoredAttemptsModal open={attemptsModal} onClose={() => setAttemptsModal(false)} quizId={quiz.id} />}
    </AdminLayout>
  );
}
