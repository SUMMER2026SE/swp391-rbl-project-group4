import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

const WINDOW_LABELS = {
    upcoming: { label: 'Chưa mở',     cls: 'bg-surface-low text-on-muted' },
    open:     { label: 'Đang mở',     cls: 'bg-emerald-100 text-emerald-700' },
    closed:   { label: 'Đã đóng',     cls: 'bg-red-100 text-red-600' },
};

function ExamCard({ a }) {
    const win = WINDOW_LABELS[a.window_status] || WINDOW_LABELS.open;
    const canTake = a.window_status === 'open' && a.attempts_remaining > 0;
    const last = a.latest_attempt;
    const lastScore = last ? (last.manual_score ?? last.score) : null;

    return (
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="font-bold text-lg truncate">{a.exam?.title}</h3>
                    <p className="text-sm text-on-muted mt-0.5">{a.class?.name}</p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${win.cls}`}>{win.label}</span>
            </div>

            <div className="flex items-center gap-4 text-sm text-on-muted">
                {a.end_time && (
                    <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">event</span>
            Hạn: {new Date(a.end_time).toLocaleString('vi-VN')}
          </span>
                )}
                <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">repeat</span>
                    {a.attempts_used}/{a.max_attempts} lần
        </span>
            </div>

            {last && (
                <div className="text-sm">
                    {last.status === 'pending_review'
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Đang chờ giáo viên chấm</span>
                        : <span>Kết quả gần nhất: <strong className="text-tsubaki-red">{lastScore}/{last.total_questions}</strong></span>}
                </div>
            )}

            <div className="pt-1 border-t border-outline/30">
                {canTake ? (
                    <Link to={`/exams/${a.id}`}>
                        <Button className="w-full text-sm">
                            <span className="material-symbols-outlined text-base">edit_note</span> {a.attempts_used > 0 ? 'Làm lại' : 'Làm bài'}
                        </Button>
                    </Link>
                ) : (
                    <Button className="w-full text-sm" variant="secondary" disabled>
                        {a.window_status === 'upcoming' ? 'Chưa đến thời gian làm bài'
                            : a.window_status === 'closed' ? 'Đã hết thời gian làm bài'
                                : 'Đã hết số lần làm bài'}
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function Exams() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');

    useEffect(() => {
        api.get('/exams/student')
            .then(r => setAssignments(r.data || []))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <StudentLayout title="Đề thi">
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold">Đề thi được giao</h1>
                <p className="text-sm text-on-muted mt-0.5">Các đề thi giáo viên giao cho lớp học của bạn.</p>
            </div>

            {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

            {loading ? (
                <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>
            ) : assignments.length === 0 ? (
                <div className="glass-card rounded-2xl p-10 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-muted/40 block mb-3">quiz</span>
                    <p className="font-semibold mb-1">Chưa có đề thi nào được giao</p>
                    <p className="text-sm text-on-muted">Khi giáo viên giao đề thi cho lớp của bạn, đề thi sẽ xuất hiện ở đây.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignments.map(a => <ExamCard key={a.id} a={a} />)}
                </div>
            )}
        </StudentLayout>
    );
}
