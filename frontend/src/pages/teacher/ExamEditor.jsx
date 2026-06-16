import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const TYPE_LABELS = {
    single_choice:   'Chọn 1 đáp án',
    multiple_choice: 'Chọn nhiều đáp án',
    matching:        'Nối kết quả',
    ordering:        'Sắp xếp thứ tự',
    fill_blank:      'Điền vào chỗ trống',
    short_answer:    'Trả lời ngắn',
};

const STATUS_LABELS = {
    graded:          { label: 'Đã chấm',      cls: 'bg-emerald-100 text-emerald-700' },
    pending_review:  { label: 'Chờ chấm',     cls: 'bg-amber-100 text-amber-700' },
};

const PROCTOR_VI = {
    fullscreen_exit: 'Thoát toàn màn hình',
    tab_hidden:      'Rời tab/cửa sổ',
    no_face:         'Không thấy mặt',
    multiple_faces:  'Nhiều người',
    looking_away:    'Không nhìn màn hình',
    camera_lost:     'Mất webcam',
};

function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(val) {
    return val ? new Date(val).toISOString() : null;
}

/* ════════════════════════ Tab: Câu hỏi ═══════════════════════════════════ */

function AddFromBankModal({ open, onClose, examId, existingBankIds, onAdded }) {
    const [items, setItems]     = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [search, setSearch]   = useState('');
    const [level, setLevel]     = useState('');
    const [source, setSource]   = useState('mine'); // 'mine' = ngân hàng riêng | 'global' = ngân hàng chung
    const [loading, setLoading] = useState(false);
    const [adding, setAdding]   = useState(false);
    const [error, setError]     = useState('');

    const load = async () => {
        setLoading(true); setError('');
        try {
            const params = { limit: 50, status: 'approved' };
            if (search) params.search = search;
            if (level)  params.level  = level;
            const url = source === 'global' ? '/teacher/global-question-bank' : '/teacher/question-bank';
            const r = await api.get(url, { params });
            setItems((r.data?.data || []).filter(q => !existingBankIds.has(q.id)));
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (open) { setSelected(new Set()); load(); } }, [open, search, level, source]);

    const toggle = (id) => setSelected(s => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const handleAdd = async () => {
        if (selected.size === 0) return;
        setAdding(true); setError('');
        try {
            await api.post(`/exams/teacher/${examId}/import-from-bank`, { question_ids: [...selected], source });
            onAdded(`Đã thêm ${selected.size} câu hỏi.`);
            onClose();
        } catch (e) { setError(e.message); }
        finally { setAdding(false); }
    };

    return (
        <Modal open={open} onClose={onClose} title="Thêm câu hỏi từ ngân hàng đề" size="lg"
               footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
                   <Button loading={adding} disabled={selected.size === 0} onClick={handleAdd}>Thêm {selected.size > 0 ? `(${selected.size})` : ''}</Button></>}>
            <div className="space-y-4">
                {/* Chọn nguồn: ngân hàng riêng của GV hoặc ngân hàng chung (admin duyệt) */}
                <div className="flex gap-2">
                    {[['mine','Ngân hàng của tôi'],['global','Ngân hàng chung']].map(([v, l]) => (
                        <button key={v} onClick={() => setSource(v)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${source===v ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red' : 'border-outline text-on-muted hover:bg-surface-low'}`}>
                            {l}
                        </button>
                    ))}
                </div>
                {error && <Alert>{error}</Alert>}
                <div className="flex gap-2">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm câu hỏi…"
                           className="flex-1 px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
                    <select value={level} onChange={e => setLevel(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                        <option value="">Mọi cấp độ</option>
                        {['N5','N4','N3','N2','N1'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-on-muted text-center py-8">Không có câu hỏi phù hợp (hoặc đã được thêm hết).</p>
                ) : (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {items.map(q => (
                            <label key={q.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.has(q.id) ? 'border-tsubaki-red bg-tsubaki-red/5' : 'border-outline hover:bg-surface-low'}`}>
                                <input type="checkbox" className="mt-1" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{q.question_text}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted">{TYPE_LABELS[q.question_type] || q.question_type}</span>
                                        {q.level && <span className="text-xs px-2 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-bold">{q.level}</span>}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}

function QuestionsTab({ exam, onChanged }) {
    const [showAdd, setShowAdd] = useState(false);
    const [alert, setAlert]     = useState({ type: '', msg: '' });
    const [deleting, setDeleting] = useState(null);

    const questions = exam.questions || [];
    const existingBankIds = new Set(questions.map(q => q.bank_question_id).filter(Boolean));

    const handleDelete = async (q) => {
        setDeleting(q.id);
        try {
            await api.delete(`/exams/teacher/questions/${q.id}`);
            onChanged();
        } catch (e) { setAlert({ type: 'error', msg: e.message }); }
        finally { setDeleting(null); }
    };

    return (
        <div className="space-y-4">
            {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert>}

            <div className="flex items-center justify-between">
                <p className="text-sm text-on-muted">{questions.length} câu hỏi</p>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <span className="material-symbols-outlined text-base">add</span> Thêm từ ngân hàng đề
                </Button>
            </div>

            {questions.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-muted/40 block mb-2">help</span>
                    <p className="text-sm text-on-muted">Đề thi chưa có câu hỏi nào. Thêm câu hỏi từ ngân hàng đề riêng của bạn.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {questions.map((q, i) => (
                        <div key={q.id} className="glass-card rounded-xl p-4 flex items-start gap-3">
                            <span className="shrink-0 w-7 h-7 rounded-full bg-surface-low flex items-center justify-center text-xs font-bold text-on-muted">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{q.question}</p>
                                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted">{TYPE_LABELS[q.question_type] || q.question_type}</span>
                            </div>
                            <button onClick={() => handleDelete(q)} disabled={deleting === q.id}
                                    className="shrink-0 p-2 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                                <span className="material-symbols-outlined text-lg">{deleting === q.id ? 'progress_activity' : 'delete'}</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <AddFromBankModal open={showAdd} onClose={() => setShowAdd(false)} examId={exam.id} existingBankIds={existingBankIds}
                              onAdded={msg => { setAlert({ type: 'success', msg }); onChanged(); }} />
        </div>
    );
}

/* ════════════════════════ Tab: Giao đề (UC44) ═════════════════════════════ */

const EMPTY_ASSIGN = { class_id: '', start_time: '', end_time: '', max_attempts: 1 };

function AssignModal({ open, onClose, examId, classes, assignment, onSaved }) {
    const isEdit = !!assignment;
    const [form, setForm]       = useState(EMPTY_ASSIGN);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    useEffect(() => {
        if (open) {
            setForm(assignment
                ? { class_id: assignment.class_id, start_time: toLocalInput(assignment.start_time), end_time: toLocalInput(assignment.end_time), max_attempts: assignment.max_attempts || 1 }
                : EMPTY_ASSIGN);
            setError('');
        }
    }, [open, assignment]);

    const handleSave = async () => {
        if (!isEdit && !form.class_id) return setError('Vui lòng chọn lớp học.');
        const start_time = fromLocalInput(form.start_time);
        const end_time   = fromLocalInput(form.end_time);
        if (start_time && end_time && new Date(start_time) >= new Date(end_time))
            return setError('Thời gian bắt đầu phải trước thời gian kết thúc.');

        setLoading(true); setError('');
        try {
            if (isEdit) {
                const r = await api.put(`/exams/teacher/assignments/${assignment.id}`, { start_time, end_time, max_attempts: Number(form.max_attempts) || 1 });
                onSaved(r.data, 'Đã cập nhật lượt giao đề.');
            } else {
                const r = await api.post(`/exams/teacher/${examId}/assign`, { class_id: form.class_id, start_time, end_time, max_attempts: Number(form.max_attempts) || 1 });
                onSaved(r.data, 'Đã giao đề thi cho lớp.');
            }
            onClose();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal open={open} onClose={onClose} title={isEdit ? 'Chỉnh sửa lượt giao đề' : 'Giao đề thi cho lớp'}
               footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
                   <Button loading={loading} onClick={handleSave}>{isEdit ? 'Lưu' : 'Giao đề'}</Button></>}>
            <div className="space-y-4">
                {error && <Alert>{error}</Alert>}
                {!isEdit && (
                    <div>
                        <label className="block text-sm font-medium text-on-muted mb-1">Lớp học</label>
                        <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                            <option value="">— Chọn lớp —</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Bắt đầu" type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                    <Input label="Kết thúc" type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
                <Input label="Số lần làm bài tối đa" type="number" min="1" value={form.max_attempts}
                       onChange={e => setForm(f => ({ ...f, max_attempts: e.target.value }))} />
                <p className="text-xs text-on-muted">Để trống thời gian bắt đầu/kết thúc nếu không muốn giới hạn.</p>
            </div>
        </Modal>
    );
}

function AssignTab({ exam, classes }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alert, setAlert]     = useState({ type: '', msg: '' });
    const [modal, setModal]     = useState(undefined); // undefined=closed, null=create, object=edit
    const [removing, setRemoving] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get(`/exams/teacher/${exam.id}/assignments`);
            setAssignments(r.data || []);
        } catch (e) { setAlert({ type: 'error', msg: e.message }); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [exam.id]);

    const handleRemove = async (a) => {
        setRemoving(a.id);
        try {
            await api.delete(`/exams/teacher/assignments/${a.id}`);
            load();
        } catch (e) { setAlert({ type: 'error', msg: e.message }); }
        finally { setRemoving(null); }
    };

    const fmt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '—';

    return (
        <div className="space-y-4">
            {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert>}

            <div className="flex items-center justify-between">
                <p className="text-sm text-on-muted">{assignments.length} lượt giao đề</p>
                <Button size="sm" onClick={() => setModal(null)} disabled={(exam.questions || []).length === 0}>
                    <span className="material-symbols-outlined text-base">send</span> Giao đề cho lớp
                </Button>
            </div>
            {(exam.questions || []).length === 0 && (
                <p className="text-xs text-amber-600">Hãy thêm câu hỏi cho đề thi trước khi giao cho lớp.</p>
            )}

            {loading ? (
                <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div>
            ) : assignments.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-muted/40 block mb-2">send</span>
                    <p className="text-sm text-on-muted">Đề thi này chưa được giao cho lớp nào.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {assignments.map(a => (
                        <div key={a.id} className="glass-card rounded-xl p-4 flex items-center gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm">{a.class?.name || '—'}</p>
                                <p className="text-xs text-on-muted mt-0.5">
                                    {fmt(a.start_time)} → {fmt(a.end_time)} · Tối đa {a.max_attempts} lần
                                </p>
                            </div>
                            <button onClick={() => setModal(a)} className="p-2 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-surface-low transition-colors">
                                <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => handleRemove(a)} disabled={removing === a.id}
                                    className="p-2 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                                <span className="material-symbols-outlined text-lg">{removing === a.id ? 'progress_activity' : 'delete'}</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <AssignModal open={modal !== undefined} onClose={() => setModal(undefined)} examId={exam.id} classes={classes} assignment={modal}
                         onSaved={(_, msg) => { setAlert({ type: 'success', msg }); load(); }} />
        </div>
    );
}

/* ════════════════════════ Tab: Kết quả & Chấm điểm (UC45 / UC46) ═════════ */

function GradeModal({ open, onClose, attemptId, onGraded }) {
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(false);
    const [score, setScore]     = useState('');
    const [feedback, setFeedback] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState('');

    useEffect(() => {
        if (!open || !attemptId) return;
        setLoading(true); setError(''); setAiSuggestions(null);
        api.get(`/exams/teacher/attempts/${attemptId}`)
            .then(r => {
                setAttempt(r.data);
                setScore(String(r.data.manual_score ?? r.data.score ?? 0));
                setFeedback(r.data.feedback || '');
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [open, attemptId]);

    const handleAiSuggest = async () => {
        setAiLoading(true); setError('');
        try {
            const r = await api.post(`/exams/teacher/attempts/${attemptId}/ai-grade`);
            setAiSuggestions(r.data.suggestions || []);
            setScore(String(r.data.suggested_score));
        } catch (e) { setError(e.message); }
        finally { setAiLoading(false); }
    };

    const handleSave = async () => {
        const s = Number(score);
        if (Number.isNaN(s) || s < 0 || s > (attempt?.total_questions || 0)) {
            return setError(`Điểm phải từ 0 đến ${attempt?.total_questions}.`);
        }
        setSaving(true); setError('');
        try {
            await api.put(`/exams/teacher/attempts/${attemptId}/grade`, { manual_score: s, feedback: feedback || null });
            onGraded('Đã lưu kết quả chấm điểm.');
            onClose();
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    const shortAnswerQs = (attempt?.questions || []).filter(q => q.question_type === 'short_answer');

    return (
        <Modal open={open} onClose={onClose} title="Chấm điểm bài làm" size="lg"
               footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
                   <Button loading={saving} onClick={handleSave}>Lưu kết quả</Button></>}>
            {loading || !attempt ? (
                <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div>
            ) : (
                <div className="space-y-4">
                    {error && <Alert>{error}</Alert>}
                    <div>
                        <p className="font-semibold">{attempt.student?.full_name || attempt.student?.email}</p>
                        <p className="text-sm text-on-muted">{attempt.exam_title} · Lần {attempt.attempt_number} · Tự chấm: {attempt.score}/{attempt.total_questions}</p>
                    </div>

                    {/* Log giám sát (đề thi chế độ giám sát) */}
                    {attempt.mode === 'proctored' && (
                        <div className="rounded-xl border border-outline p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-base text-tsubaki-red">policy</span>
                                <p className="text-sm font-semibold">Giám sát</p>
                                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${attempt.violation_count > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {attempt.violation_count > 0 ? `${attempt.violation_count} vi phạm` : 'Không vi phạm'}
                                </span>
                            </div>
                            {Array.isArray(attempt.proctor_events) && attempt.proctor_events.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {attempt.proctor_events.map((ev, i) => (
                                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                                            {PROCTOR_VI[ev.type] || ev.type} · {ev.at ? new Date(ev.at).toLocaleTimeString('vi-VN') : ''}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {Array.isArray(attempt.snapshot_urls) && attempt.snapshot_urls.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {attempt.snapshot_urls.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer">
                                            <img src={url} alt="snapshot" className="w-20 h-16 rounded-lg object-cover border border-outline/30 hover:ring-2 hover:ring-tsubaki-red" />
                                        </a>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-on-muted">Không có ảnh webcam.</p>}
                        </div>
                    )}

                    {shortAnswerQs.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold">Câu hỏi tự luận</p>
                                <Button size="sm" variant="purple" loading={aiLoading} onClick={handleAiSuggest}>
                                    <span className="material-symbols-outlined text-base">auto_awesome</span> AI gợi ý chấm
                                </Button>
                            </div>
                            {shortAnswerQs.map((q, i) => {
                                const ai = aiSuggestions?.[i];
                                return (
                                    <div key={q.id} className="rounded-xl border border-outline p-3 space-y-1">
                                        <p className="text-sm font-medium">{q.question}</p>
                                        <p className="text-sm text-on-muted">Đáp án học sinh: <span className="font-medium text-charcoal">{attempt.answers?.[q.id] || '(không trả lời)'}</span></p>
                                        {q.correct_answer && <p className="text-xs text-on-muted">Đáp án mẫu: {q.correct_answer}</p>}
                                        {ai && (
                                            <p className="text-xs px-2 py-1 rounded-lg bg-sumire-purple/10 text-sumire-purple inline-block">
                                                AI: {ai.score === 1 ? 'Đúng' : 'Sai'} — {ai.comment}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Input label={`Điểm (0–${attempt.total_questions})`} type="number" min="0" max={attempt.total_questions} value={score} onChange={e => setScore(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-on-muted mb-1">Nhận xét cho học sinh</label>
                        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
                                  className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all" />
                    </div>
                </div>
            )}
        </Modal>
    );
}

function ResultsTab({ exam }) {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [alert, setAlert]       = useState({ type: '', msg: '' });
    const [gradingId, setGradingId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get(`/exams/teacher/${exam.id}/attempts`);
            setAttempts(r.data || []);
        } catch (e) { setAlert({ type: 'error', msg: e.message }); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [exam.id]);

    return (
        <div className="space-y-4">
            {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert>}
            <p className="text-sm text-on-muted">{attempts.length} bài làm</p>

            {loading ? (
                <div className="flex justify-center py-8"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div>
            ) : attempts.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-on-muted/40 block mb-2">fact_check</span>
                    <p className="text-sm text-on-muted">Chưa có học sinh nào làm đề thi này.</p>
                </div>
            ) : (
                <div className="overflow-x-auto glass-card rounded-2xl">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-on-muted border-b border-outline/30">
                            <th className="p-3 font-medium">Học sinh</th>
                            <th className="p-3 font-medium">Lớp</th>
                            <th className="p-3 font-medium">Lần</th>
                            <th className="p-3 font-medium">Điểm</th>
                            <th className="p-3 font-medium">Trạng thái</th>
                            <th className="p-3 font-medium">Vi phạm</th>
                            <th className="p-3 font-medium">Nộp lúc</th>
                            <th className="p-3 font-medium"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {attempts.map(a => {
                            const finalScore = a.manual_score ?? a.score;
                            const st = STATUS_LABELS[a.status] || STATUS_LABELS.graded;
                            return (
                                <tr key={a.id} className="border-b border-outline/10 last:border-0">
                                    <td className="p-3 font-medium">{a.student?.full_name || a.student?.email || '—'}</td>
                                    <td className="p-3 text-on-muted">{a.assignment?.class?.name || '—'}</td>
                                    <td className="p-3 text-on-muted">{a.attempt_number}</td>
                                    <td className="p-3 font-semibold">{finalScore}/{a.total_questions}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                                    <td className="p-3">
                                        {a.violation_count > 0
                                            ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-[13px]">warning</span>{a.violation_count}</span>
                                            : <span className="text-on-muted">—</span>}
                                    </td>
                                    <td className="p-3 text-on-muted">{a.completed_at ? new Date(a.completed_at).toLocaleString('vi-VN') : '—'}</td>
                                    <td className="p-3">
                                        <button onClick={() => setGradingId(a.id)} className="text-tsubaki-red font-semibold hover:underline">
                                            {a.status === 'pending_review' ? 'Chấm điểm' : 'Xem / sửa'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            <GradeModal open={!!gradingId} attemptId={gradingId} onClose={() => setGradingId(null)}
                        onGraded={msg => { setAlert({ type: 'success', msg }); load(); }} />
        </div>
    );
}

/* ════════════════════════ Main page ═══════════════════════════════════════ */

const TABS = [
    { key: 'questions', label: 'Câu hỏi',          icon: 'list_alt' },
    { key: 'assign',    label: 'Giao đề',          icon: 'send' },
    { key: 'results',   label: 'Kết quả & Chấm điểm', icon: 'fact_check' },
];

export default function ExamEditor() {
    const { id } = useParams();
    const [exam, setExam]       = useState(null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [tab, setTab]         = useState('questions');

    const load = async () => {
        try {
            const [examRes, classesRes] = await Promise.all([
                api.get(`/exams/teacher/${id}`),
                api.get('/classes/teacher'),
            ]);
            setExam(examRes.data);
            setClasses(classesRes.data || []);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [id]);

    const changeMode = async (mode) => {
        if (!exam || exam.mode === mode) return;
        setExam(e => ({ ...e, mode }));
        try { await api.put(`/exams/teacher/${id}`, { mode }); }
        catch { setExam(e => ({ ...e, mode: mode === 'proctored' ? 'normal' : 'proctored' })); }
    };

    if (loading) return <TeacherLayout title="Đề thi"><div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></TeacherLayout>;
    if (error || !exam) return <TeacherLayout title="Đề thi"><Alert>{error || 'Không tìm thấy đề thi.'}</Alert></TeacherLayout>;

    return (
        <TeacherLayout title={exam.title}>
            <Link to="/teacher/quizzes" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3">
                <span className="material-symbols-outlined text-base">arrow_back</span> Quay lại danh sách đề thi
            </Link>
            <h1 className="font-display text-2xl font-bold mb-1">{exam.title}</h1>
            {exam.description && <p className="text-sm text-on-muted mb-3">{exam.description}</p>}

            {/* Chế độ thi: thường / giám sát */}
            <div className="flex items-center gap-2 mb-5">
                <span className="text-sm text-on-muted">Hình thức:</span>
                {[['normal','Thường','edit_note'],['proctored','Giám sát','verified_user']].map(([v, l, ic]) => (
                    <button key={v} onClick={() => changeMode(v)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${exam.mode === v ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red' : 'border-outline text-on-muted hover:bg-surface-low'}`}>
                        <span className="material-symbols-outlined text-base">{ic}</span>{l}
                    </button>
                ))}
            </div>

            <div className="flex gap-2 mb-5 border-b border-outline/30">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                tab === t.key ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'
                            }`}>
                        <span className="material-symbols-outlined text-base">{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'questions' && <QuestionsTab exam={exam} onChanged={load} />}
            {tab === 'assign'    && <AssignTab exam={exam} classes={classes} />}
            {tab === 'results'   && <ResultsTab exam={exam} />}
        </TeacherLayout>
    );
}
