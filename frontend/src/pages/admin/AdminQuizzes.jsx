import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import FuriganaText from '../../components/ui/FuriganaText';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import QuestionTypeForm from '../../components/admin/QuestionTypeForm';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';
import {
  EMPTY_Q_FORM, formToPayload, rowToForm,
  QUESTION_TYPES, TYPE_MAP, LEVEL_COLORS, DIFF_COLORS,
} from '../../utils/questionFormHelpers';

const EMPTY_QUIZ = { title: '', title_ja: '', description: '', type: 'mixed', time_limit: '', is_published: false };

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const cfg = TYPE_MAP[type];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
      <span className="material-symbols-outlined text-[11px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── Answer preview in the question card ──────────────────────────────────────
function AnswerPreview({ q }) {
  const typ  = q.question_type || 'single_choice';
  const opts = q.options;
  const ca   = q.correct_answer_data ?? q.correct_answer;

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
  if (typ === 'ordering' && Array.isArray(ca)) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {ca.map((item, i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800">
            {i + 1}. {item}
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

  useEffect(() => { if (open) fetchBank(); }, [open, fetchBank]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectAll = () => setSelected(bankItems.map(i => i.id));
  const clearSel  = () => setSelected([]);

  const handleImport = () => { onImport(selected); };

  return (
    <Modal open={open} onClose={onClose} title="Thêm câu hỏi từ ngân hàng đề" size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          <Button onClick={handleImport} loading={saving} disabled={!selected.length}>
            <span className="material-symbols-outlined text-lg">download</span>
            Nhập {selected.length > 0 ? `(${selected.length})` : ''} câu hỏi
          </Button>
        </>
      }>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text" placeholder="Tìm kiếm câu hỏi..."
          value={search} onChange={e => setSearch(e.target.value)}
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

      {/* Select all / clear */}
      <div className="flex items-center justify-between mb-2 text-xs text-on-muted">
        <span>{bankItems.length} câu hỏi{selected.length > 0 ? ` — đã chọn ${selected.length}` : ''}</span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="hover:text-sumire-purple transition-colors">Chọn tất cả</button>
          {selected.length > 0 && <button onClick={clearSel} className="hover:text-error transition-colors">Bỏ chọn</button>}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-on-muted">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          </div>
        ) : bankItems.length === 0 ? (
          <div className="text-center py-8 text-on-muted">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">inventory_2</span>
            Không tìm thấy câu hỏi
          </div>
        ) : bankItems.map(item => (
          <label key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected.includes(item.id) ? 'border-sumire-purple bg-sumire-purple/5' : 'border-outline/30 hover:border-sumire-purple/40'}`}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="mt-0.5 accent-sumire-purple w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-1">
                <TypeBadge type={item.question_type} />
                {item.level && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[item.level] || 'bg-gray-100 text-gray-600'}`}>{item.level}</span>}
                {item.difficulty && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${DIFF_COLORS[item.difficulty] || ''}`}>{item.difficulty}</span>}
                {item.topic && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-low text-on-muted">{item.topic}</span>}
              </div>
              <p className="text-sm text-charcoal line-clamp-2">{item.question_text}</p>
              {item.reading_passages && <p className="text-[10px] text-sumire-purple mt-0.5">Bài đọc: {item.reading_passages.title}</p>}
            </div>
          </label>
        ))}
      </div>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminQuizzes() {
  const { t } = useLang();
  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [quizModal, setQuizModal] = useState(false);
  const [createQModal, setCreateQModal] = useState(false);
  const [bankModal, setBankModal]       = useState(false);
  const [editQuizId, setEditQuizId]     = useState(null);
  const [editQId, setEditQId]           = useState(null);
  const [form, setForm]   = useState(EMPTY_QUIZ);
  const [qForm, setQForm] = useState({ ...EMPTY_Q_FORM });
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions]       = useState([]);
  const [passages, setPassages]         = useState([]);
  const [saving, setSaving]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/quizzes?page=${page}&limit=${LIMIT}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuizzes(); }, [page]);

  const fetchQuestions = async (quizId) => {
    try {
      const r = await api.get(`/admin/quizzes/${quizId}/questions`);
      setQuestions(r.data || []);
    } catch {}
  };

  const fetchPassages = async () => {
    try {
      const r = await api.get('/admin/reading-passages');
      setPassages(r.data || []);
    } catch {}
  };

  // ── Quiz CRUD ──────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY_QUIZ); setEditQuizId(null); setQuizModal(true); };
  const openEdit   = (row) => {
    setForm({ title: row.title||'', title_ja: row.title_ja||'', description: row.description||'',
              type: row.type||'mixed', time_limit: row.time_limit||'', is_published: row.is_published||false });
    setEditQuizId(row.id); setQuizModal(true);
  };

  const saveQuiz = async () => {
    if (!form.title) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    setSaving(true);
    try {
      const payload = { ...form, time_limit: form.time_limit ? Number(form.time_limit) : null };
      if (editQuizId) await api.put(`/admin/quizzes/${editQuizId}`, payload);
      else            await api.post('/admin/quizzes', payload);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setQuizModal(false); fetchQuizzes();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const deleteQuiz = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/quizzes/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetchQuizzes(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  // ── Open quiz detail ───────────────────────────────────────────────────────
  const openDetail = (row) => {
    setSelectedQuiz(row);
    fetchQuestions(row.id);
    fetchPassages();
  };

  // ── Question CRUD ──────────────────────────────────────────────────────────
  const openCreateQ = () => {
    setQForm({ ...EMPTY_Q_FORM });
    setEditQId(null);
    setCreateQModal(true);
  };

  const openEditQ = (q) => {
    setQForm(rowToForm(q));
    setEditQId(q.id);
    setCreateQModal(true);
  };

  const saveQuestion = async () => {
    if (!qForm.question_text) return setAlert({ type: 'error', msg: 'Nhập nội dung câu hỏi.' });
    setSaving(true);
    try {
      const payload = formToPayload(qForm);
      const body = {
        quiz_id: selectedQuiz.id,
        question: payload.question_text,
        options:  payload.options,
        correct_answer: payload.correct_answer,
        correct_answer_data: payload.correct_answer_data,
        explanation: payload.explanation,
        question_type: payload.question_type,
        order_index: questions.length,
      };
      if (editQId) await api.put(`/admin/questions/${editQId}`, body);
      else         await api.post('/admin/questions', body);
      setAlert({ type: 'success', msg: editQId ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi.' });
      setCreateQModal(false);
      fetchQuestions(selectedQuiz.id);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const deleteQuestion = async (q) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/questions/${q.id}`); fetchQuestions(selectedQuiz.id); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  // ── Bank import ────────────────────────────────────────────────────────────
  const handleImport = async (ids) => {
    if (!ids.length) return;
    setImporting(true);
    try {
      await api.post(`/admin/quizzes/${selectedQuiz.id}/import-from-bank`, { question_ids: ids });
      setAlert({ type: 'success', msg: `Đã nhập ${ids.length} câu hỏi từ ngân hàng.` });
      setBankModal(false);
      fetchQuestions(selectedQuiz.id);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setImporting(false); }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const COLS = [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'type',  label: 'Loại', render: v => <span className="text-xs text-on-muted">{v}</span> },
    { key: 'is_published', label: 'Trạng thái', render: v => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-low text-on-muted'}`}>
        {v ? t('admin.published') : t('admin.draft')}
      </span>
    )},
  ];

  return (
    <AdminLayout title={t('admin.quizzes')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      {/* ── Quiz list ── */}
      {!selectedQuiz ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl font-bold">{t('admin.quizzes')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
            <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> {t('admin.create')}</Button>
          </div>
          <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={deleteQuiz}
            actions={(row) => (
              <button onClick={() => openDetail(row)} title="Quản lý câu hỏi"
                className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">quiz</span>
              </button>
            )} />
          {total > LIMIT && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
              <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total / LIMIT)}</span>
              <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
            </div>
          )}
        </>
      ) : (
        /* ── Quiz detail + questions ── */
        <>
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <button onClick={() => setSelectedQuiz(null)} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-2 transition-colors">
                <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách quiz
              </button>
              <h1 className="font-display text-2xl font-bold">
                {selectedQuiz.title}
                <span className="ml-2 text-on-muted text-lg font-normal">— {questions.length} câu hỏi</span>
              </h1>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setBankModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-sumire-purple text-sumire-purple text-sm font-semibold hover:bg-sumire-purple hover:text-white transition-all">
                <span className="material-symbols-outlined text-lg">inventory_2</span>
                Thêm từ ngân hàng
              </button>
              <Button onClick={openCreateQ}>
                <span className="material-symbols-outlined text-lg">add</span>
                Tạo câu hỏi mới
              </Button>
            </div>
          </div>

          {/* Questions list */}
          <div className="space-y-3">
            {questions.length === 0 && !loading && (
              <div className="text-center py-12 text-on-muted">
                <span className="material-symbols-outlined text-5xl block mb-3 opacity-20">quiz</span>
                <p className="font-medium">Chưa có câu hỏi nào</p>
                <p className="text-sm mt-1">Thêm từ ngân hàng đề hoặc tạo câu hỏi mới</p>
              </div>
            )}
            {questions.map((q, i) => (
              <div key={q.id} className="glass-card rounded-xl p-4 flex items-start gap-3 group">
                <span className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <TypeBadge type={q.question_type} />
                    {q.bank_question_id && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200">
                        <span className="material-symbols-outlined text-[10px]">link</span> Ngân hàng
                      </span>
                    )}
                  </div>
                  <FuriganaText
                    text={q.question || ''}
                    textClassName="text-sm font-semibold text-charcoal"
                    className="mb-1"
                  />
                  <AnswerPreview q={q} />
                  {q.explanation && <p className="text-[11px] text-on-muted mt-1.5 italic">💡 {q.explanation}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!q.bank_question_id && (
                    <button onClick={() => openEditQ(q)} className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                  )}
                  <button onClick={() => deleteQuestion(q)} className="p-1.5 text-on-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Quiz create/edit modal ── */}
      <Modal open={quizModal} onClose={() => setQuizModal(false)}
        title={editQuizId ? t('admin.edit') + ' quiz' : t('admin.create') + ' quiz'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuizModal(false)}>{t('admin.cancel')}</Button>
            <Button loading={saving} onClick={saveQuiz}>{t('admin.save')}</Button>
          </>
        }>
        <div className="space-y-4">
          <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input label="Tiêu đề (Tiếng Nhật)" value={form.title_ja} onChange={e => setForm({ ...form, title_ja: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Mô tả</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none" placeholder="Mô tả quiz..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Loại quiz</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                <option value="mixed">Hỗn hợp</option>
                <option value="multiple_choice">Trắc nghiệm</option>
                <option value="fill_blank">Điền khuyết</option>
                <option value="listening">Nghe hiểu</option>
                <option value="reading">Đọc hiểu</option>
              </select>
            </div>
            <Input label="Giới hạn thời gian (giây)" type="number" value={form.time_limit}
              onChange={e => setForm({ ...form, time_limit: e.target.value })} placeholder="VD: 600" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 accent-tsubaki-red" />
            <span className="text-sm font-medium">{t('admin.published')}</span>
          </label>
        </div>
      </Modal>

      {/* ── Create / edit question modal ── */}
      <Modal open={createQModal} onClose={() => setCreateQModal(false)}
        title={editQId ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi mới'} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateQModal(false)}>{t('admin.cancel')}</Button>
            <Button loading={saving} onClick={saveQuestion}>{t('admin.save')}</Button>
          </>
        }>
        <QuestionTypeForm form={qForm} setForm={setQForm} passages={passages} showMeta={false} />
      </Modal>

      {/* ── Bank import modal ── */}
      <BankImportModal
        open={bankModal}
        onClose={() => setBankModal(false)}
        onImport={handleImport}
        saving={importing}
      />
    </AdminLayout>
  );
}
