import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const LESSON_TYPES = [
  { value: 'video',      label: 'Video',       icon: 'play_circle',   color: 'text-sumire-purple' },
  { value: 'reading',    label: 'Reading',     icon: 'description',   color: 'text-primary' },
  { value: 'quiz',       label: 'Quiz',        icon: 'quiz',          color: 'text-tsubaki-red' },
  { value: 'vocabulary', label: 'Vocabulary',  icon: 'style',         color: 'text-green-600' },
  { value: 'grammar',    label: 'Grammar',     icon: 'spellcheck',    color: 'text-amber-600' },
  { value: 'practice',   label: 'Practice',    icon: 'fitness_center',color: 'text-blue-600' },
];

const getLessonTypeMeta = (type) => LESSON_TYPES.find(t => t.value === type) || LESSON_TYPES[1];

const formatMeta = (lesson) => {
  if (lesson.lesson_type === 'quiz' || lesson.lesson_type === 'practice') {
    return `${lesson.lesson_type === 'quiz' ? 'Quiz' : 'Practice'} • ${lesson.question_count || 0} câu`;
  }
  if (lesson.duration_minutes > 0) {
    const m = lesson.duration_minutes;
    return `${getLessonTypeMeta(lesson.lesson_type).label} • ${m} phút`;
  }
  return getLessonTypeMeta(lesson.lesson_type).label;
};

const EMPTY_MODULE = { title: '' };
const EMPTY_LESSON = { title: '', title_ja: '', lesson_type: 'video', duration_minutes: '', question_count: '' };

// ── Sub-components ────────────────────────────────────────────────────────────

function LessonTypeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LESSON_TYPES.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium
            ${value === t.value
              ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red'
              : 'border-outline/30 hover:border-tsubaki-red/40 text-on-muted hover:text-on-surface'}`}
        >
          <span className={`material-symbols-outlined text-2xl ${value === t.value ? 'text-tsubaki-red' : t.color}`}>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LessonRow({ lesson, onEdit, onDelete, dragHandleProps }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const meta = getLessonTypeMeta(lesson.lesson_type);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-outline/20 hover:border-tsubaki-red/30 hover:bg-surface-stone transition-all group/lesson"
      {...dragHandleProps}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="material-symbols-outlined text-on-muted/40 cursor-grab text-base hidden group-hover/lesson:block">drag_indicator</span>
        <span className={`material-symbols-outlined text-xl ${meta.color}`}>{meta.icon}</span>
        <span className="font-medium text-sm text-on-surface truncate">{lesson.title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-on-muted hidden sm:block">{formatMeta(lesson)}</span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1 text-on-muted hover:text-tsubaki-red rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">more_vert</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-white border border-outline/30 rounded-xl shadow-lg min-w-[140px] py-1 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); onEdit(lesson); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-surface-low flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-base">edit</span> Chỉnh sửa
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(lesson); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-error-container/20 flex items-center gap-2 text-error"
              >
                <span className="material-symbols-outlined text-base">delete</span> Xóa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  module, courseId,
  onModuleEdit, onModuleDelete,
  onLessonAdd, onLessonEdit, onLessonDelete,
  dragProps,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lessonCount = module.lessons?.length ?? 0;
  const totalMin = (module.lessons || []).reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const durationLabel = totalMin > 0 ? `${totalMin} phút` : null;

  return (
    <div
      className="bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md group"
      {...dragProps}
    >
      {/* Module header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline/10 bg-surface-container-lowest/60">
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined text-outline/50 cursor-grab text-xl">drag_indicator</span>
          <button onClick={() => setCollapsed(v => !v)} className="flex items-center gap-2 min-w-0">
            <span className={`material-symbols-outlined text-base text-on-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}>expand_more</span>
            <div className="text-left min-w-0">
              <h3 className="font-semibold text-on-surface text-sm truncate">{module.title}</h3>
              <p className="text-xs text-on-muted">
                {lessonCount} bài học{durationLabel ? ` • ${durationLabel}` : ''}
              </p>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onModuleEdit(module)}
            className="p-1.5 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
          <button
            onClick={() => onModuleDelete(module)}
            className="p-1.5 text-on-muted hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>

      {/* Lessons */}
      {!collapsed && (
        <div className="p-4 space-y-2">
          {(module.lessons || []).map(lesson => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              onEdit={onLessonEdit}
              onDelete={onLessonDelete}
            />
          ))}
          <button
            onClick={() => onLessonAdd(module)}
            className="w-full py-3 border-2 border-dashed border-outline/25 rounded-xl text-on-muted text-sm font-medium
              hover:border-tsubaki-red/40 hover:text-tsubaki-red transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Thêm bài học
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManageCourseContent() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse]   = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Module modal state
  const [moduleModal, setModuleModal]   = useState(false);
  const [moduleForm, setModuleForm]     = useState(EMPTY_MODULE);
  const [editingModule, setEditingModule] = useState(null);
  const [savingModule, setSavingModule] = useState(false);

  // Lesson modal state
  const [lessonModal, setLessonModal]   = useState(false);
  const [lessonForm, setLessonForm]     = useState(EMPTY_LESSON);
  const [editingLesson, setEditingLesson] = useState(null);
  const [targetModule, setTargetModule] = useState(null);
  const [savingLesson, setSavingLesson] = useState(false);

  // Drag state for modules
  const dragModuleIdx = useRef(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const loadCourse = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/courses/${courseId}/builder`);
      setCourse(r.data);
      setModules(r.data.modules || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Không thể tải khóa học.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourse(); }, [courseId]);

  // ── Publish / Unpublish ──────────────────────────────────────────────────────

  const handlePublishToggle = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/admin/courses/${courseId}`, { is_published: !course.is_published });
      setCourse(prev => ({ ...prev, is_published: r.data.is_published }));
      setAlert({ type: 'success', msg: r.data.is_published ? 'Đã xuất bản khóa học.' : 'Đã đưa về bản nháp.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Module CRUD ──────────────────────────────────────────────────────────────

  const openAddModule = () => {
    setModuleForm(EMPTY_MODULE);
    setEditingModule(null);
    setModuleModal(true);
  };

  const openEditModule = (mod) => {
    setModuleForm({ title: mod.title });
    setEditingModule(mod);
    setModuleModal(true);
  };

  const saveModule = async () => {
    if (!moduleForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề module không được để trống.' });
    setSavingModule(true);
    try {
      if (editingModule) {
        await api.put(`/admin/modules/${editingModule.id}`, { title: moduleForm.title.trim() });
      } else {
        await api.post('/admin/modules', {
          course_id: courseId,
          title: moduleForm.title.trim(),
          order_index: modules.length,
        });
      }
      setModuleModal(false);
      await loadCourse();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSavingModule(false);
    }
  };

  const deleteModule = async (mod) => {
    if (!confirm(`Xóa module "${mod.title}" và tất cả bài học bên trong?`)) return;
    try {
      await api.delete(`/admin/modules/${mod.id}`);
      await loadCourse();
      setAlert({ type: 'success', msg: 'Đã xóa module.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Lesson CRUD ──────────────────────────────────────────────────────────────

  const openAddLesson = (mod) => {
    setLessonForm(EMPTY_LESSON);
    setEditingLesson(null);
    setTargetModule(mod);
    setLessonModal(true);
  };

  const openEditLesson = (lesson) => {
    setLessonForm({
      title: lesson.title || '',
      title_ja: lesson.title_ja || '',
      lesson_type: lesson.lesson_type || 'reading',
      duration_minutes: lesson.duration_minutes || '',
      question_count: lesson.question_count || '',
    });
    setEditingLesson(lesson);
    setTargetModule(null);
    setLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề bài học không được để trống.' });
    setSavingLesson(true);
    try {
      const payload = {
        title: lessonForm.title.trim(),
        title_ja: lessonForm.title_ja.trim() || null,
        lesson_type: lessonForm.lesson_type,
        duration_minutes: Number(lessonForm.duration_minutes) || 0,
        question_count: Number(lessonForm.question_count) || 0,
      };
      if (editingLesson) {
        await api.put(`/admin/lessons/${editingLesson.id}`, payload);
      } else {
        const parentModule = targetModule;
        const existingLessons = parentModule?.lessons || [];
        await api.post('/admin/lessons', {
          ...payload,
          course_id: courseId,
          module_id: parentModule?.id || null,
          order_index: existingLessons.length,
        });
      }
      setLessonModal(false);
      await loadCourse();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSavingLesson(false);
    }
  };

  const deleteLesson = async (lesson) => {
    if (!confirm(`Xóa bài học "${lesson.title}"?`)) return;
    try {
      await api.delete(`/admin/lessons/${lesson.id}`);
      await loadCourse();
      setAlert({ type: 'success', msg: 'Đã xóa bài học.' });
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  // ── Drag & drop for modules ──────────────────────────────────────────────────

  const handleModuleDragStart = (e, idx) => {
    dragModuleIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleModuleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragModuleIdx.current === null || dragModuleIdx.current === idx) return;
    const updated = [...modules];
    const [moved] = updated.splice(dragModuleIdx.current, 1);
    updated.splice(idx, 0, moved);
    dragModuleIdx.current = idx;
    setModules(updated);
  };

  const handleModuleDragEnd = async () => {
    dragModuleIdx.current = null;
    try {
      await api.patch('/admin/modules/reorder', {
        items: modules.map((m, i) => ({ id: m.id, order_index: i })),
      });
    } catch (e) {
      setAlert({ type: 'error', msg: 'Không thể lưu thứ tự module.' });
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const isQuizType = ['quiz', 'practice'].includes(lessonForm.lesson_type);

  if (loading) {
    return (
      <AdminLayout title="Quản lý nội dung khóa học">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      </AdminLayout>
    );
  }

  if (!course) {
    return (
      <AdminLayout title="Quản lý nội dung khóa học">
        <div className="text-center py-24 text-on-muted">Không tìm thấy khóa học.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Quản lý nội dung khóa học">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">
          {alert.msg}
        </Alert>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin/courses')}
            className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại danh sách
          </button>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {course.level && (
              <span className="bg-surface-container-highest/60 text-on-muted px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                {course.level}
              </span>
            )}
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${
              course.is_published
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {course.is_published ? 'Đã xuất bản' : 'Bản nháp'}
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-on-surface">{course.title}</h1>
          {course.description && (
            <p className="text-on-muted text-sm mt-1 max-w-xl">{course.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all">
            <span className="material-symbols-outlined text-base">visibility</span>
            Xem trước
          </button>
          <button
            onClick={handlePublishToggle}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${course.is_published
                ? 'bg-surface border border-outline text-on-surface hover:bg-surface-low'
                : 'bg-tsubaki-red text-white hover:shadow-lg active:scale-95'}`}
          >
            <span className="material-symbols-outlined text-base">
              {course.is_published ? 'unpublished' : 'publish'}
            </span>
            {saving ? 'Đang lưu...' : course.is_published ? 'Bỏ xuất bản' : 'Xuất bản'}
          </button>
        </div>
      </section>

      {/* ── Course builder ──────────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Module list */}
        {modules.map((mod, idx) => (
          <div
            key={mod.id}
            draggable
            onDragStart={(e) => handleModuleDragStart(e, idx)}
            onDragOver={(e) => handleModuleDragOver(e, idx)}
            onDragEnd={handleModuleDragEnd}
          >
            <ModuleCard
              module={mod}
              courseId={courseId}
              onModuleEdit={openEditModule}
              onModuleDelete={deleteModule}
              onLessonAdd={openAddLesson}
              onLessonEdit={openEditLesson}
              onLessonDelete={deleteLesson}
            />
          </div>
        ))}

        {modules.length === 0 && (
          <div className="text-center py-10 text-on-muted text-sm">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-20">inbox</span>
            Chưa có module nào. Hãy thêm module đầu tiên bên dưới.
          </div>
        )}

        {/* AI Suggestion card */}
        <div className="relative p-5 rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md border border-outline/20 shadow-sm">
          <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-sumire-purple to-tsubaki-red rounded-l-2xl" />
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-sumire-purple bg-sumire-purple/10 p-2.5 rounded-full text-2xl">auto_awesome</span>
            <div>
              <h4 className="text-sm font-bold text-sumire-purple">Gợi ý từ AI</h4>
              <p className="text-xs text-on-muted leading-relaxed mt-1">
                Dựa trên dữ liệu học viên, người học thường gặp khó khăn nhất với phần Kính ngữ (Keigo).
                Cân nhắc thêm một module chuyên về Ngôn ngữ trang trọng để tăng tỉ lệ hoàn thành khóa học.
              </p>
              <button className="mt-2 text-sumire-purple text-xs font-semibold underline underline-offset-4 hover:opacity-70 transition-opacity">
                Thêm module được gợi ý
              </button>
            </div>
          </div>
        </div>

        {/* Add New Module button */}
        <button
          onClick={openAddModule}
          className="w-full py-10 bg-white border-2 border-dashed border-outline/25 rounded-2xl flex flex-col items-center justify-center gap-2
            hover:border-tsubaki-red/50 hover:bg-surface-container-low/30 transition-all group"
        >
          <div className="w-11 h-11 rounded-full bg-surface-container-highest/50 group-hover:bg-tsubaki-red group-hover:text-white transition-all flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">add</span>
          </div>
          <span className="font-semibold text-on-muted group-hover:text-tsubaki-red transition-colors text-sm">Thêm module mới</span>
          <p className="text-xs text-outline">Xác định chương học mới trong chương trình giảng dạy</p>
        </button>
      </div>

      {/* ── Module Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={moduleModal}
        onClose={() => setModuleModal(false)}
        title={editingModule ? 'Chỉnh sửa module' : 'Thêm module mới'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleModal(false)}>Hủy</Button>
            <Button loading={savingModule} onClick={saveModule}>Lưu</Button>
          </>
        }
      >
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề module *</label>
          <input
            type="text"
            value={moduleForm.title}
            onChange={e => setModuleForm({ title: e.target.value })}
            placeholder="VD: Module 1 – Nhập môn"
            onKeyDown={e => e.key === 'Enter' && saveModule()}
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
        </div>
      </Modal>

      {/* ── Lesson Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={lessonModal}
        onClose={() => setLessonModal(false)}
        title={editingLesson ? 'Chỉnh sửa bài học' : 'Thêm bài học'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLessonModal(false)}>Hủy</Button>
            <Button loading={savingLesson} onClick={saveLesson}>Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2">Loại bài học *</label>
            <LessonTypeSelector
              value={lessonForm.lesson_type}
              onChange={v => setLessonForm(f => ({ ...f, lesson_type: v, duration_minutes: '', question_count: '' }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Việt) *</label>
            <input
              type="text"
              value={lessonForm.title}
              onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Nhập tiêu đề bài học..."
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Nhật)</label>
            <input
              type="text"
              value={lessonForm.title_ja}
              onChange={e => setLessonForm(f => ({ ...f, title_ja: e.target.value }))}
              placeholder="日本語のタイトル"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>

          {isQuizType ? (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Số câu hỏi</label>
              <input
                type="number"
                min="0"
                value={lessonForm.question_count}
                onChange={e => setLessonForm(f => ({ ...f, question_count: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Thời lượng (phút)</label>
              <input
                type="number"
                min="0"
                value={lessonForm.duration_minutes}
                onChange={e => setLessonForm(f => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
            </div>
          )}
        </div>
      </Modal>
    </AdminLayout>
  );
}
