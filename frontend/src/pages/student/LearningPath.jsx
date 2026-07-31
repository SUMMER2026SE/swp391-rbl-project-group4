import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import LearnerAnalysis from '../../components/student/LearnerAnalysis';
import api, {
  getLearningPath, generateLearningPath, regenerateLearningPath, completeLearningStep,
} from '../../lib/api';
import { usePageContext } from '../../contexts/PageContext';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const BEGINNER = 'BEGINNER';

// Trọng tâm học tập — không chọn gì = phát triển đều 4 kỹ năng
const FOCUS_OPTIONS = [
  { value: 'vocabulary', label: 'Từ vựng',  icon: 'translate' },
  { value: 'kanji',      label: 'Kanji',    icon: 'font_download' },
  { value: 'grammar',    label: 'Ngữ pháp', icon: 'spellcheck' },
  { value: 'reading',    label: 'Đọc',      icon: 'menu_book' },
  { value: 'listening',  label: 'Nghe',     icon: 'headphones' },
  { value: 'writing',    label: 'Viết',     icon: 'edit_note' },
];

// Quỹ thời gian ảnh hưởng trực tiếp tới số mốc và tiến độ (backend: timeBudget)
const TIME_PRESETS = [15, 30, 60, 120, 180];

const STRATEGY_ORDER = ['weakness_first', 'foundation_first', 'balanced', 'exam_oriented'];
const STRATEGY_NAME = {
  weakness_first:   'Tập trung khắc phục điểm yếu',
  foundation_first: 'Xây nền tảng trước',
  balanced:         'Cân bằng các kỹ năng',
  exam_oriented:    'Bám sát đề thi',
};
const nextStrategyName = (cur) => {
  const i = STRATEGY_ORDER.indexOf(cur);
  return STRATEGY_NAME[STRATEGY_ORDER[(i < 0 ? 0 : i + 1) % STRATEGY_ORDER.length]];
};

const SKILL_META = {
  vocabulary: { label: 'Từ vựng',  icon: 'translate',     color: 'bg-tsubaki-red/10 text-tsubaki-red' },
  kanji:      { label: 'Kanji',    icon: 'font_download', color: 'bg-sumire-purple/10 text-sumire-purple' },
  grammar:    { label: 'Ngữ pháp', icon: 'spellcheck',    color: 'bg-green-100 text-green-700' },
  reading:    { label: 'Đọc hiểu', icon: 'menu_book',     color: 'bg-amber-100 text-amber-700' },
  listening:  { label: 'Nghe',     icon: 'headphones',    color: 'bg-blue-100 text-blue-700' },
  mixed:      { label: 'Tổng hợp', icon: 'auto_awesome',  color: 'bg-surface-low text-on-muted' },
};

const RESOURCE_META = {
  course:     { label: 'Khóa học',   icon: 'menu_book' },
  study_list: { label: 'Danh sách',  icon: 'library_books' },
  mock_exam:  { label: 'Thi thử',    icon: 'fact_check' },
  article:    { label: 'Luyện đọc',  icon: 'article' },
  listening:  { label: 'Luyện nghe', icon: 'headphones' },
  practice:   { label: 'Luyện tập',  icon: 'draw' },
  external:   { label: 'Nguồn ngoài', icon: 'open_in_new' },
};

// Mục nguồn ngoài / trang luyện cố định không có id trong DB → dùng external_url
const isExternalStep = (s) => s.resource_type === 'external' || s.resource_type === 'practice';

function stepLink(step) {
  if (isExternalStep(step))                return step.external_url || '#';
  if (step.resource_type === 'course')     return `/courses/${step.resource_id}`;
  if (step.resource_type === 'mock_exam')  return `/mock-exams/${step.resource_id}`;
  if (step.resource_type === 'article')    return `/reading/${step.resource_id}`;
  if (step.resource_type === 'listening')  return '/listening';
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
  const [form, setForm]         = useState({ current_level: '', target_level: '', study_goal: '', daily_minutes: '', focus_skills: [] });
  const [generating, setGenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [editMode, setEditMode] = useState(false);   // mở lại form để tạo lộ trình KHÁC

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
        // Trọng tâm: khi đổi cách tiếp cận thì giữ nguyên lựa chọn của lộ trình hiện tại
        focus_skills:  form.focus_skills.length ? form.focus_skills : (regenerate ? (data?.path?.focus_skills || []) : []),
      };
      const res = regenerate ? await regenerateLearningPath(body) : await generateLearningPath(body);
      setData(res);
      setEditMode(false);
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

  // ── Setup: chưa có lộ trình, HOẶC người dùng chọn "Tạo lộ trình khác" ────────
  if (!data || editMode) {
    return (
      <StudentLayout title="Lộ trình học">
        <div className="max-w-xl mx-auto">
          {editMode && (
            <button onClick={() => setEditMode(false)}
              className="mb-4 inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Quay lại lộ trình hiện tại
            </button>
          )}
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
                  <option value={BEGINNER}>Người mới (chưa biết gì)</option>
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

            {/* Trọng tâm — quyết định lộ trình phủ đủ 4 kỹ năng hay chỉ ôn một mảng */}
            <div>
              <label className="block text-sm font-semibold text-on-muted mb-1.5">Trọng tâm học tập</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setForm({ ...form, focus_skills: [] })}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    form.focus_skills.length === 0
                      ? 'bg-sumire-purple text-white border-sumire-purple'
                      : 'bg-white border-outline hover:border-sumire-purple'}`}>
                  Phát triển đều 4 kỹ năng
                </button>
                {FOCUS_OPTIONS.map(o => {
                  const on = form.focus_skills.includes(o.value);
                  return (
                    <button key={o.value} type="button"
                      onClick={() => setForm({
                        ...form,
                        focus_skills: on ? form.focus_skills.filter(s => s !== o.value) : [...form.focus_skills, o.value],
                      })}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border inline-flex items-center gap-1.5 transition-colors ${
                        on ? 'bg-sumire-purple text-white border-sumire-purple'
                           : 'bg-white border-outline hover:border-sumire-purple'}`}>
                      <span className="material-symbols-outlined text-[16px]">{o.icon}</span>{o.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-on-muted mt-1.5">
                {form.focus_skills.length === 0
                  ? 'Lộ trình sẽ có cả khóa học, luyện đọc, luyện nghe và luyện viết.'
                  : `Chỉ tập trung: ${form.focus_skills.map(s => FOCUS_OPTIONS.find(o => o.value === s)?.label).join(', ')}.`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-muted mb-1.5">Thời gian học mỗi ngày</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {TIME_PRESETS.map(m => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, daily_minutes: String(m) })}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                      String(form.daily_minutes) === String(m)
                        ? 'bg-sumire-purple text-white border-sumire-purple'
                        : 'bg-white border-outline hover:border-sumire-purple'}`}>
                    {m >= 60 ? `${m / 60} giờ` : `${m} phút`}
                  </button>
                ))}
              </div>
              <input type="number" value={form.daily_minutes} onChange={e => setForm({ ...form, daily_minutes: e.target.value })}
                placeholder="Hoặc nhập số phút" min="0"
                className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors" />
              <p className="text-xs text-on-muted mt-1">Ảnh hưởng trực tiếp tới số mốc và tốc độ tiến độ của lộ trình.</p>
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

      {/* Phân tích năng lực — cơ sở dữ liệu thật của lộ trình bên dưới */}
      <LearnerAnalysis snapshot={path.learner_snapshot} />

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
                  {step.resource_type === 'external' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                      Nguồn ngoài{step.external_source ? ` · ${step.external_source}` : ''}
                    </span>
                  )}
                  {step.estimated_days > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-on-muted ml-auto">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      ≈ {step.estimated_days} ngày
                    </span>
                  )}
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
                  ) : step.resource_type === 'external' ? (
                    // Nguồn ngoài mở tab mới để không mất lộ trình đang xem
                    <a href={stepLink(step)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-tsubaki-red hover:underline">
                      Mở nguồn học <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>
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

      {/* Trước đây chỉ có nút "Tạo lại" mơ hồ — nay tách rõ 2 ý định khác nhau của người dùng */}
      <Modal open={confirmRegen} onClose={() => setConfirmRegen(false)} title="Bạn muốn làm gì?" size="md"
        footer={<Button variant="secondary" onClick={() => setConfirmRegen(false)}>Hủy</Button>}>
        <div className="space-y-3">
          <button
            onClick={() => runGenerate(true)}
            className="w-full text-left p-4 rounded-xl border border-outline hover:border-sumire-purple hover:bg-sumire-purple/5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-sumire-purple">autorenew</span>
              <div>
                <p className="font-semibold text-charcoal">Đổi cách tiếp cận</p>
                <p className="text-sm text-on-muted mt-0.5">
                  Giữ nguyên trình độ, mục tiêu và trọng tâm — AI xây lại lộ trình theo một hướng khác,
                  dựa trên dữ liệu học tập mới nhất của bạn.
                </p>
                {data?.path?.learner_snapshot?.strategy && (
                  <p className="text-xs mt-2 inline-flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-surface-low text-on-muted">
                      {STRATEGY_NAME[data.path.learner_snapshot.strategy] || 'Hiện tại'}
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-on-muted">trending_flat</span>
                    <span className="px-2 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-semibold">
                      {nextStrategyName(data.path.learner_snapshot.strategy)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              setForm({
                current_level: data?.path?.current_level || '',
                target_level:  data?.path?.target_level || '',
                study_goal:    data?.path?.study_goal || '',
                daily_minutes: data?.path?.daily_minutes ? String(data.path.daily_minutes) : '',
                focus_skills:  data?.path?.focus_skills || [],
              });
              setConfirmRegen(false);
              setEditMode(true);
            }}
            className="w-full text-left p-4 rounded-xl border border-outline hover:border-sumire-purple hover:bg-sumire-purple/5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-sumire-purple">tune</span>
              <div>
                <p className="font-semibold text-charcoal">Tạo lộ trình khác</p>
                <p className="text-sm text-on-muted mt-0.5">
                  Đổi trình độ, mục tiêu, trọng tâm kỹ năng hoặc thời gian học mỗi ngày rồi tạo lộ trình mới.
                </p>
              </div>
            </div>
          </button>

          <p className="text-xs text-on-muted pt-1">
            Lộ trình hiện tại sẽ được lưu trữ. Tiến độ đã hoàn thành không chuyển sang lộ trình mới.
          </p>
        </div>
      </Modal>
    </StudentLayout>
  );
}
