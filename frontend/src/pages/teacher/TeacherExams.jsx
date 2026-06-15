import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const EMPTY_FORM = { title: '', title_ja: '', description: '', time_limit: '' };

/* ─── Create / Edit info modal (UC41 / UC42) ──────────────────────────────── */
function ExamFormModal({ open, onClose, exam, onSaved }) {
    const isEdit = !!exam;
    const [form, setForm]       = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    useEffect(() => {
        if (open) {
            setForm(exam
                ? { title: exam.title || '', title_ja: exam.title_ja || '', description: exam.description || '', time_limit: exam.time_limit || '' }
                : EMPTY_FORM);
            setError('');
        }
    }, [open, exam]);

    const handleSave = async () => {
        if (!form.title.trim()) return setError('Vui lòng nhập tiêu đề đề thi.');
        setLoading(true); setError('');
        const payload = {
            title: form.title.trim(),
            title_ja: form.title_ja.trim() || null,
            description: form.description.trim() || null,
            time_limit: form.time_limit ? Number(form.time_limit) : null,
        };
        try {
            if (isEdit) {
                const r = await api.put(`/exams/teacher/${exam.id}`, payload);
                onSaved(r.data, 'Đã cập nhật đề thi.');
            } else {
                const r = await api.post('/exams/teacher', payload);
                onSaved(r.data, 'Đã tạo đề thi. Tiếp theo, hãy thêm câu hỏi.');
            }
            onClose();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? 'Chỉnh sửa đề thi' : 'Tạo đề thi mới'}
               footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
                   <Button loading={loading} onClick={handleSave}>{isEdit ? 'Lưu' : 'Tạo đề thi'}</Button></>}>
            <div className="space-y-4">
                {error && <Alert>{error}</Alert>}
                <Input label="Tiêu đề" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Kiểm tra giữa kỳ N4" />
                <Input label="Tiêu đề (Tiếng Nhật, không bắt buộc)" value={form.title_ja} onChange={e => setForm(f => ({ ...f, title_ja: e.target.value }))} />
                <div>
                    <label className="block text-sm font-medium text-on-muted mb-1">Mô tả</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                              rows={3} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all" />
                </div>
                <Input label="Thời gian làm bài (giây, để trống nếu không giới hạn)" type="number" min="0"
                       value={form.time_limit} onChange={e => setForm(f => ({ ...f, time_limit: e.target.value }))} />
            </div>
        </Modal>
    );
}

/* ─── Delete confirm modal (UC43) ─────────────────────────────────────────── */
function DeleteExamModal({ exam, open, onClose, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const handleDelete = async () => {
        setLoading(true); setError('');
        try {
            await api.delete(`/exams/teacher/${exam.id}`);
            onDeleted(`Đã xóa đề thi "${exam.title}".`);
            onClose();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal open={open} onClose={onClose} title="Xác nhận xóa đề thi"
               footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
                   <Button loading={loading} onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Xóa đề thi</Button></>}>
            <div className="text-center py-2 space-y-3">
                <span className="material-symbols-outlined text-5xl text-red-400 block">delete_forever</span>
                <p className="font-semibold">Xóa đề thi <strong>"{exam?.title}"</strong>?</p>
                <p className="text-sm text-on-muted">Toàn bộ câu hỏi, lượt giao đề và kết quả làm bài liên quan sẽ bị xóa. Hành động này không thể hoàn tác.</p>
                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
        </Modal>
    );
}

/* ─── Exam card ────────────────────────────────────────────────────────────── */
function ExamCard({ exam, onEdit, onDelete }) {
    return (
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 hover:shadow-xl transition-all">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{exam.title}</h3>
                    {exam.description && <p className="text-sm text-on-muted line-clamp-2 mt-0.5">{exam.description}</p>}
                </div>
                {exam.pending_review_count > 0 && (
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
            {exam.pending_review_count} chờ chấm
          </span>
                )}
            </div>

            <div className="flex items-center gap-4 text-sm text-on-muted">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">school</span>
            {exam.assignment_count} lớp đã giao
        </span>
                {exam.time_limit > 0 && (
                    <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">timer</span>
                        {Math.floor(exam.time_limit / 60)} phút
          </span>
                )}
            </div>

            <div className="flex gap-2 pt-1 border-t border-outline/30">
                <Link to={`/teacher/quizzes/${exam.id}`} className="flex-1">
                    <Button className="w-full text-sm">
                        <span className="material-symbols-outlined text-base">tune</span> Quản lý
                    </Button>
                </Link>
                <button onClick={() => onEdit(exam)} className="p-2.5 rounded-xl border border-outline text-on-muted hover:text-tsubaki-red hover:border-tsubaki-red transition-colors">
                    <span className="material-symbols-outlined text-lg">edit</span>
                </button>
                <button onClick={() => onDelete(exam)} className="p-2.5 rounded-xl border border-outline text-on-muted hover:text-red-500 hover:border-red-300 transition-colors">
                    <span className="material-symbols-outlined text-lg">delete</span>
                </button>
            </div>
        </div>
    );
}

/* ─── Main page ────────────────────────────────────────────────────────────── */
export default function TeacherExams() {
    const [exams, setExams]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [alert, setAlert]     = useState({ type: '', msg: '' });
    const [formExam, setFormExam] = useState(undefined); // undefined = closed, null = create, object = edit
    const [deleteExam, setDeleteExam] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/exams/teacher');
            setExams(r.data || []);
        } catch (e) { setAlert({ type: 'error', msg: e.message }); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleSaved = (data, msg) => {
        setAlert({ type: 'success', msg });
        load();
    };

    return (
        <TeacherLayout title="Đề thi">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-display text-2xl font-bold">Đề thi</h1>
                    <p className="text-sm text-on-muted mt-0.5">Tạo, chỉnh sửa, giao đề thi cho lớp và chấm điểm.</p>
                </div>
                <Button onClick={() => setFormExam(null)}>
                    <span className="material-symbols-outlined text-base">add</span> Tạo đề thi
                </Button>
            </div>

            {alert.msg && <div className="mb-4"><Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert></div>}

            {loading ? (
                <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
            ) : exams.length === 0 ? (
                <div className="glass-card rounded-2xl p-10 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-muted/40 block mb-3">quiz</span>
                    <p className="font-semibold mb-1">Chưa có đề thi nào</p>
                    <p className="text-sm text-on-muted mb-4">Tạo đề thi đầu tiên, thêm câu hỏi rồi giao cho lớp học của bạn.</p>
                    <Button onClick={() => setFormExam(null)}>
                        <span className="material-symbols-outlined text-base">add</span> Tạo đề thi
                    </Button>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.map(exam => (
                        <ExamCard key={exam.id} exam={exam} onEdit={setFormExam} onDelete={setDeleteExam} />
                    ))}
                </div>
            )}

            <ExamFormModal open={formExam !== undefined} exam={formExam} onClose={() => setFormExam(undefined)} onSaved={handleSaved} />
            <DeleteExamModal exam={deleteExam} open={!!deleteExam} onClose={() => setDeleteExam(null)}
                             onDeleted={msg => { setAlert({ type: 'success', msg }); load(); }} />
        </TeacherLayout>
    );
}
