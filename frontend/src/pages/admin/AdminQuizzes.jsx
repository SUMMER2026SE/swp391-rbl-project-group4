import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const EMPTY_QUIZ = { title: '', title_ja: '', description: '', type: 'multiple_choice', time_limit: '', is_published: false };
const EMPTY_Q    = { question: '', options: ['', '', '', ''], correct_answer: '', explanation: '', order_index: 0 };

export default function AdminQuizzes() {
  const { t } = useLang();
  const [data, setData]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [quizModal, setQuizModal] = useState(false);
  const [qModal, setQModal]       = useState(false);
  const [form, setForm]           = useState(EMPTY_QUIZ);
  const [qForm, setQForm]         = useState({ ...EMPTY_Q, quiz_id: '' });
  const [editId, setEditId]       = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [alert, setAlert]         = useState({ type: '', msg: '' });
  const [page, setPage]           = useState(1);
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
      const r = await api.get(`/quizzes/${quizId}`);
      setQuestions(r.data.questions || []);
    } catch (e) {}
  };

  const openQuiz   = (row) => { setForm({ title: row.title||'', title_ja: row.title_ja||'', description: row.description||'', type: row.type||'multiple_choice', time_limit: row.time_limit||'', is_published: row.is_published||false }); setEditId(row.id); setQuizModal(true); };
  const openCreate = () => { setForm(EMPTY_QUIZ); setEditId(null); setQuizModal(true); };

  const openQuestions = (row) => { setSelectedQuiz(row); fetchQuestions(row.id); };
  const openAddQ      = () => { setQForm({ ...EMPTY_Q, quiz_id: selectedQuiz.id, options: ['','','',''] }); setQModal(true); };

  const saveQuiz = async () => {
    if (!form.title) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    setSaving(true);
    try {
      const payload = { ...form, time_limit: form.time_limit ? Number(form.time_limit) : null };
      if (editId) await api.put(`/admin/quizzes/${editId}`, payload);
      else        await api.post('/admin/quizzes', payload);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setQuizModal(false); fetchQuizzes();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const saveQuestion = async () => {
    if (!qForm.question || !qForm.correct_answer) return setAlert({ type: 'error', msg: 'Câu hỏi và đáp án đúng là bắt buộc.' });
    setSaving(true);
    try {
      const payload = { ...qForm, options: qForm.options.filter(Boolean) };
      await api.post('/admin/questions', payload);
      setAlert({ type: 'success', msg: 'Đã thêm câu hỏi.' }); setQModal(false); fetchQuestions(selectedQuiz.id);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const deleteQuiz = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/quizzes/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetchQuizzes(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const deleteQuestion = async (q) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/questions/${q.id}`); fetchQuestions(selectedQuiz.id); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const COLS = [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'type',  label: 'Loại' },
    { key: 'is_published', label: 'Trạng thái', render: v => <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${v ? 'bg-green-100 text-green-700' : 'bg-surface-low text-on-muted'}`}>{v ? t('admin.published') : t('admin.draft')}</span> },
  ];

  return (
    <AdminLayout title={t('admin.quizzes')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      {!selectedQuiz ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display text-2xl font-bold">{t('admin.quizzes')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
            <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> {t('admin.create')}</Button>
          </div>
          <DataTable columns={COLS} data={data} loading={loading} onEdit={openQuiz} onDelete={deleteQuiz}
            actions={(row) => (
              <button onClick={() => openQuestions(row)} title="Câu hỏi"
                className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-lg">quiz</span>
              </button>
            )} />
          {total > LIMIT && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
              <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
              <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <button onClick={() => setSelectedQuiz(null)} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-2 transition-colors">
                <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách quiz
              </button>
              <h1 className="font-display text-2xl font-bold">{selectedQuiz.title} — Câu hỏi ({questions.length})</h1>
            </div>
            <Button onClick={openAddQ}><span className="material-symbols-outlined text-lg">add</span> Thêm câu hỏi</Button>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="glass-card rounded-xl p-4 flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-2">{q.question}</p>
                  {q.options && <div className="flex flex-wrap gap-1">{q.options.map((o, j) => <span key={j} className={`text-xs px-2 py-0.5 rounded-full border ${o === q.correct_answer ? 'border-green-400 bg-green-50 text-green-700 font-bold' : 'border-outline text-on-muted'}`}>{o}</span>)}</div>}
                </div>
                <button onClick={() => deleteQuestion(q)} className="p-1 text-on-muted hover:text-error transition-colors shrink-0">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
            {questions.length === 0 && <div className="text-center py-8 text-on-muted"><span className="material-symbols-outlined text-4xl block mb-2 opacity-30">quiz</span>Chưa có câu hỏi</div>}
          </div>
        </>
      )}

      {/* Quiz modal */}
      <Modal open={quizModal} onClose={() => setQuizModal(false)} title={editId ? t('admin.edit') : t('admin.create') + ' quiz'}
        footer={<><Button variant="secondary" onClick={() => setQuizModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={saveQuiz}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <Input label="Tiêu đề (JA)" value={form.title_ja} onChange={e => setForm({...form, title_ja: e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Loại quiz</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="multiple_choice">Multiple Choice</option>
                <option value="fill_blank">Fill in the Blank</option>
              </select>
            </div>
            <Input label="Giới hạn thời gian (giây)" type="number" value={form.time_limit} onChange={e => setForm({...form, time_limit: e.target.value})} placeholder="300" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} className="w-4 h-4 accent-tsubaki-red" />
            <span className="text-sm font-medium">{t('admin.published')}</span>
          </label>
        </div>
      </Modal>

      {/* Question modal */}
      <Modal open={qModal} onClose={() => setQModal(false)} title="Thêm câu hỏi"
        footer={<><Button variant="secondary" onClick={() => setQModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={saveQuestion}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Câu hỏi *</label>
            <textarea value={qForm.question} onChange={e => setQForm({...qForm, question: e.target.value})} rows={2} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2">Các lựa chọn</label>
            {qForm.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-6 text-xs font-bold text-on-muted">{String.fromCharCode(65+i)}.</span>
                <input value={opt} onChange={e => { const o = [...qForm.options]; o[i] = e.target.value; setQForm({...qForm, options: o}); }}
                  className="flex-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" placeholder={`Lựa chọn ${String.fromCharCode(65+i)}`} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Đáp án đúng *</label>
            <select value={qForm.correct_answer} onChange={e => setQForm({...qForm, correct_answer: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="">-- Chọn đáp án --</option>
              {qForm.options.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{String.fromCharCode(65+i)}. {opt}</option>)}
            </select>
          </div>
          <Input label="Giải thích (tùy chọn)" value={qForm.explanation} onChange={e => setQForm({...qForm, explanation: e.target.value})} />
        </div>
      </Modal>
    </AdminLayout>
  );
}
