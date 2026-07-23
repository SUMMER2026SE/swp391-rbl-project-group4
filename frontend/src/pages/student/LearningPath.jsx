import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import api, {
  getLearningPath, generateLearningPath, regenerateLearningPath, completeLearningStep,
} from '../../lib/api';
import { usePageContext } from '../../contexts/PageContext';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const SKILL_META = {
  vocabulary: { label: 'Từ vựng',  icon: 'translate',     color: 'bg-tsubaki-red/10 text-tsubaki-red' },
  kanji:      { label: 'Kanji',    icon: 'font_download', color: 'bg-sumire-purple/10 text-sumire-purple' },
  grammar:    { label: 'Ngữ pháp', icon: 'spellcheck',    color: 'bg-green-100 text-green-700' },
  reading:    { label: 'Đọc hiểu', icon: 'menu_book',     color: 'bg-amber-100 text-amber-700' },
  listening:  { label: 'Nghe',     icon: 'headphones',    color: 'bg-blue-100 text-blue-700' },
  mixed:      { label: 'Tổng hợp', icon: 'auto_awesome',  color: 'bg-surface-low text-on-muted' },
};

const RESOURCE_META = {
  course:     { label: 'Khóa học',  icon: 'menu_book' },
  study_list: { label: 'Danh sách', icon: 'library_books' },
  mock_exam:  { label: 'Thi thử',   icon: 'fact_check' },
};

function stepLink(step) {
  if (step.resource_type === 'course')     return `/courses/${step.resource_id}`;
  if (step.resource_type === 'mock_exam')  return `/mock-exams/${step.resource_id}`;
  if (step.resource_type === 'study_list') return `/study-lists/${step.resource_list_type || 'vocabulary'}/${step.resource_id}`;
  return '#';
}

export default function LearningPath() {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [data, setData]         = useState(null);      // { path, steps, progress } | null
  const [error, setError]       = useState('');
  const [busyStep, setBusyStep] = useState(null);

  // Setup form (shown when no active path)
  const [form, setForm]         = useState({ current_level: '', target_level: '', study_goal: '', daily_minutes: '' });
  const [generating, setGenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  // Cho trợ lý AI biết lộ trình đang hiển thị
  usePageContext({
    tab: 'Lộ trình học',
    title: data?.path ? `Lộ trình ${data.path.current_level} → ${data.path.target_level}` : 'Chưa có lộ trình',
    data: data?.path ? {
      current_level: data.path.current_level, target_level: data.path.target_level,
      progress: data.progress,
      nextStep: (data.steps || []).find(s => s.status !== 'completed')?.title || null,
    } : { hasPath: false },
  }, [data]);

  const loadPath = async () => {
    setLoading(true);
    try {
      const res = await getLearningPath();
      if (res.path) {
        setData(res);
      } else {
        setData(null);
        // Prefill setup from the student profile.
        try {
          const dash = await api.get('/users/dashboard').then(r => r.data);
          const p = dash?.profile || {};
          setForm(f => ({
            ...f,
            current_level: (p.current_level || '').trim(),
            target_level:  (p.jlpt_target_level || '').trim(),
            study_goal:    p.study_goal || '',
            daily_minutes: p.daily_study_minutes || '',
          }));
        } catch { /* prefill is best-effort */ }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPath(); }, []);

  const runGenerate = async (regenerate) => {
    // When regenerating from the roadmap, fall back to the current path's values.
    const current = form.current_level || data?.path?.current_level || '';
    if (!current) return setError('Vui lòng chọn trình độ hiện tại.');
    setError('');
    setGenerating(true);
    setConfirmRegen(false);
    try {
      const body = {
        current_level: current,
        target_level:  form.target_level || data?.path?.target_level || undefined,
        study_goal:    form.study_goal || data?.path?.study_goal || undefined,
        daily_minutes: form.daily_minutes ? Number(form.daily_minutes) : (data?.path?.daily_minutes || undefined),
      };
      const res = regenerate ? await regenerateLearningPath(body) : await generateLearningPath(body);
      setData(res);
    } catch (e) {
      if (e.status === 403) setError('Bạn đã dùng hết lượt tạo lộ trình tháng này. Nâng cấp Premium để tạo không giới hạn.');
      else setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleStep = async (step) => {
    setBusyStep(step.id);
    try {
      const next = step.status === 'completed' ? 'pending' : 'completed';
      const res = await completeLearningStep(step.id, next);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyStep(null);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StudentLayout title="Lộ trình học">
        <div className="flex items-center justify-center py-32">
          <span className="material-symbols-outlined animate-spin text-4xl text-tsubaki-red">progress_activity</span>
        </div>
      </StudentLayout>
    );
  }

  // ── Generating (AI in progress) ──────────────────────────────────────────────
  if (generating) {
    return (
      <StudentLayout title="Lộ trình học">
        <div className="glass-card rounded-3xl py-20 px-6 text-center max-w-xl mx-auto">
          <span className="material-symbols-outlined animate-spin text-5xl text-sumire-purple mb-4 block">auto_awesome</span>
          <h2 className="font-display text-xl font-bold mb-2">Đang thiết kế lộ trình của bạn…</h2>
          <p className="text-sm text-on-muted">AI đang phân tích trình độ và mục tiêu để chọn học liệu phù hợp nhất. Vui lòng chờ trong giây lát.</p>
        </div>
      </StudentLayout>
    );
  }

  // ── Setup (no active path) ───────────────────────────────────────────────────
  if (!data) {
    return (
      <StudentLayout title="Lộ trình học">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <span className="material-symbols-outlined text-5xl text-sumire-purple mb-2 block">route</span>
            <h1 className="font-display text-2xl font-bold mb-1">Tạo lộ trình học cá nhân hoá</h1>
            <p className="text-sm text-on-muted">AI sẽ xây dựng lộ trình riêng cho bạn, từ trình độ hiện tại đến mục tiêu, dựa trên điểm mạnh/yếu của bạn.</p>
          </div>

          {error && <div className="mb-4"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

          <div className="glass-card rounded-2xl p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-on-muted mb-1.5">Trình độ hiện tại</label>
                <select value={form.current_level} onChange={e => setForm({ ...form, current_level: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                  <option value="">-- Chọn --</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-on-muted mb-1.5">Mục tiêu</label>
                <select value={form.target_level} onChange={e => setForm({ ...form, target_level: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                  <option value="">-- Tự động --</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <p className="text-xs text-on-muted mt-1">Bỏ trống để tăng 1 cấp.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-muted mb-1.5">Mục tiêu học tập (tùy chọn)</label>
              <textarea value={form.study_goal} onChange={e => setForm({ ...form, study_goal: e.target.value })}
                rows={2} placeholder="Ví dụ: Thi đậu N3 trong 6 tháng, cải thiện kanji…"
                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple resize-y transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-muted mb-1.5">Thời gian học mỗi ngày (phút, tùy chọn)</label>
              <input type="number" value={form.daily_minutes} onChange={e => setForm({ ...form, daily_minutes: e.target.value })}
                placeholder="30" min="0"
                className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors" />
            </div>

            <Button variant="purple" className="w-full" onClick={() => runGenerate(false)}>
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
              Tạo lộ trình
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // ── Roadmap (active path) ────────────────────────────────────────────────────
  const { path, steps, progress } = data;
  return (
    <StudentLayout title="Lộ trình học">
      {error && <div className="mb-4"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold text-sumire-purple uppercase tracking-widest mb-1">Lộ trình cá nhân hoá</p>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              {path.current_level}
              <span className="material-symbols-outlined text-on-muted">trending_flat</span>
              {path.target_level}
            </h1>
            {path.study_goal && <p className="text-sm text-on-muted mt-1 italic">{path.study_goal}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setConfirmRegen(true)}>
            <span className="material-symbols-outlined text-lg">refresh</span>
            Tạo lại
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-semibold text-charcoal">Tiến độ</span>
            <span className="text-on-muted">{progress.completed}/{progress.total} bước · {progress.pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-low overflow-hidden">
            <div className="h-full rounded-full bg-sumire-purple transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-2">
        {steps.map((step, i) => {
          const skill = SKILL_META[step.skill_focus] || SKILL_META.mixed;
          const rmeta = RESOURCE_META[step.resource_type] || {};
          const done  = step.status === 'completed';
          const isLast = i === steps.length - 1;
          return (
            <div key={step.id} className="relative flex gap-4 pb-5">
              {/* Rail */}
              {!isLast && <div className="absolute left-[15px] top-9 bottom-0 w-0.5 bg-outline/40" />}
              {/* Node */}
              <button onClick={() => toggleStep(step)} disabled={busyStep === step.id}
                title={done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
                className={`relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${done ? 'bg-green-500 text-white' : 'bg-white border-2 border-outline text-on-muted hover:border-sumire-purple'}`}>
                {busyStep === step.id
                  ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  : done ? <span className="material-symbols-outlined text-lg">check</span> : i + 1}
              </button>

              {/* Card */}
              <div className={`flex-1 glass-card rounded-2xl p-5 ${done ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${skill.color}`}>
                    <span className="material-symbols-outlined text-[14px]">{skill.icon}</span>{skill.label}
                  </span>
                  {step.resource_level && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low border border-outline text-on-muted font-semibold">{step.resource_level}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-on-muted">
                    <span className="material-symbols-outlined text-[14px]">{rmeta.icon}</span>{rmeta.label}
                  </span>
                </div>

                <h3 className="font-display font-bold text-base mb-1">{step.title}</h3>
                {step.description && <p className="text-sm text-on-muted mb-2">{step.description}</p>}
                {step.rationale && (
                  <p className="text-xs text-sumire-purple/80 italic mb-3 flex items-start gap-1">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">tips_and_updates</span>
                    {step.rationale}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  {step.resource_missing ? (
                    <span className="text-xs text-on-muted italic">Học liệu không còn khả dụng.</span>
                  ) : (
                    <button onClick={() => navigate(stepLink(step))}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-tsubaki-red hover:underline">
                      Bắt đầu <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  )}
                  {done && <span className="text-xs font-semibold text-green-600">Đã hoàn thành</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={confirmRegen} onClose={() => setConfirmRegen(false)} title="Tạo lại lộ trình?" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmRegen(false)}>Hủy</Button>
          <Button variant="purple" onClick={() => runGenerate(true)}>Tạo lại</Button>
        </>}>
        <p className="text-sm text-on-muted">
          Lộ trình hiện tại sẽ được lưu trữ và thay bằng một lộ trình mới do AI tạo. Tiến độ hiện tại sẽ không chuyển sang lộ trình mới.
        </p>
      </Modal>
    </StudentLayout>
  );
}
