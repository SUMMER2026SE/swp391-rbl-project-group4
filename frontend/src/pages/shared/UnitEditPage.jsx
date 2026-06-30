import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const LESSON_TYPES = [
  { value: 'video',      label: 'Video',    icon: 'play_circle', iconColor: 'text-purple-500',  badge: 'bg-purple-100 text-purple-700' },
  { value: 'reading',    label: 'Bài đọc',  icon: 'description', iconColor: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
  { value: 'vocabulary', label: 'Từ vựng',  icon: 'translate',   iconColor: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
  { value: 'kanji',      label: 'Kanji',    icon: 'draw',        iconColor: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  { value: 'grammar',    label: 'Ngữ pháp', icon: 'spellcheck',  iconColor: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  { value: 'quiz',       label: 'Quiz',     icon: 'quiz',        iconColor: 'text-slate-500',  badge: 'bg-slate-100 text-slate-600' },
];

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const typeMeta = (t) => LESSON_TYPES.find(x => x.value === t) || LESSON_TYPES[1];

const DEEP_ROUTE = { video: 'video', reading: 'reading', vocabulary: 'vocabulary', kanji: 'kanji', grammar: 'grammar', quiz: 'quiz' };

const EMPTY_ITEM = { title: '', title_ja: '', lesson_type: 'video', duration_minutes: '', question_count: '' };

// ── Type selector ──────────────────────────────────────────────────────────────

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
              ? 'border-sumire-purple bg-sumire-purple/5 text-sumire-purple'
              : 'border-outline/30 hover:border-sumire-purple/40 text-on-muted hover:text-on-surface'}`}
        >
          <span className={`material-symbols-outlined text-2xl ${value === t.value ? 'text-sumire-purple' : t.iconColor}`}>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Lesson item row ────────────────────────────────────────────────────────────

function LessonItemRow({ item, onEdit, onDelete, onDragStart, onDragOver, onDragEnd, isDragging }) {
  const meta = typeMeta(item.lesson_type);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
        ${isDragging
          ? 'opacity-40 border-sumire-purple/30 bg-surface-container/50 scale-[0.98]'
          : 'border-outline/20 bg-white hover:border-sumire-purple/30 hover:bg-surface-stone/40'}`}
    >
      <span className="material-symbols-outlined text-outline/40 hover:text-on-muted cursor-grab text-lg shrink-0 select-none">
        drag_indicator
      </span>

      <span className={`material-symbols-outlined text-xl shrink-0 ${meta.iconColor}`}>{meta.icon}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface truncate">{item.title}</p>
        {item.title_ja && <p className="text-xs text-on-muted truncate">{item.title_ja}</p>}
      </div>

      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
        {meta.label}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(item)}
          title="Soạn nội dung"
          className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button
          onClick={() => onDelete(item)}
          title="Xóa"
          className="p-1.5 text-on-muted hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    </div>
  );
}

// ── Preview mode: student card view ───────────────────────────────────────────

function PreviewCard({ unit, items, sortOrder }) {
  return (
    <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 px-6 py-5 border-b border-outline/10">
        <div className="w-9 h-9 rounded-full bg-sumire-purple/10 text-sumire-purple text-sm font-bold flex items-center justify-center shrink-0">
          {sortOrder}
        </div>
        <div>
          <h3 className="font-semibold text-on-surface">{unit.title}</h3>
          {unit.title_ja && <p className="text-sm text-on-muted">{unit.title_ja}</p>}
        </div>
      </div>
      <div className="divide-y divide-outline/10">
        {items.map(item => {
          const meta = typeMeta(item.lesson_type);
          return (
            <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-stone/30 transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.badge}`}>
                <span className="material-symbols-outlined text-lg">{meta.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{item.title}</p>
                {item.title_ja && <p className="text-xs text-on-muted truncate">{item.title_ja}</p>}
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
                {meta.label}
              </span>
              <span className="material-symbols-outlined text-on-muted/40 text-base shrink-0">chevron_right</span>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-on-muted">
            <span className="material-symbols-outlined text-3xl block mb-2 opacity-20">inbox</span>
            Chưa có mục học nào.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UnitEditPage() {
  const { courseId, unitId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [course, setCourse]     = useState(null);
  const [unit, setUnit]         = useState(null);
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [preview, setPreview]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Unit info form
  const [form, setForm] = useState({ title: '', title_ja: '', description: '', level: '', sort_order: '' });
  const [formDirty, setFormDirty] = useState(false);

  // Add/edit lesson item modal
  const [itemModal, setItemModal]     = useState(false);
  const [itemForm, setItemForm]       = useState(EMPTY_ITEM);
  const [savingItem, setSavingItem]   = useState(false);

  // Drag state for lesson items
  const dragIdx = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`${apiBase}/courses/${courseId}/builder`);
      const courseData = r.data;
      setCourse(courseData);
      const foundUnit = (courseData.units || []).find(u => String(u.id) === String(unitId));
      if (!foundUnit) { setErrorMsg('Không tìm thấy bài học.'); return; }
      setUnit(foundUnit);
      setItems(foundUnit.lessons || []);
      setForm({
        title:       foundUnit.title       || '',
        title_ja:    foundUnit.title_ja    || '',
        description: foundUnit.description || '',
        level:       foundUnit.level       || courseData.level || '',
        sort_order:  foundUnit.sort_order  !== undefined ? String(foundUnit.sort_order) : '',
      });
    } catch (e) {
      setErrorMsg(e.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [courseId, unitId]);

  const setField = (key, val) => { setForm(f => ({ ...f, [key]: val })); setFormDirty(true); };

  // ── Save unit info ─────────────────────────────────────────────────────────

  const saveUnitInfo = async () => {
    if (!form.title.trim()) { setErrorMsg('Tiêu đề bài học không được để trống.'); return false; }
    try {
      await api.put(`${apiBase}/units/${unitId}`, {
        title:       form.title.trim(),
        title_ja:    form.title_ja.trim() || null,
        description: form.description.trim() || null,
        level:       form.level || null,
        sort_order:  Number(form.sort_order) || 0,
      });
      setFormDirty(false);
      return true;
    } catch (e) {
      setErrorMsg(e.message || 'Không thể lưu thông tin bài học.');
      return false;
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setErrorMsg('');
    await saveUnitInfo();
    setSaving(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setErrorMsg('');
    const ok = await saveUnitInfo();
    if (ok) {
      try {
        await api.put(`${apiBase}/courses/${courseId}`, { is_published: true });
        setCourse(c => ({ ...c, is_published: true }));
      } catch (e) {
        setErrorMsg(e.message || 'Không thể xuất bản khóa học.');
      }
    }
    setPublishing(false);
  };

  const handleCancel = () => navigate(`${apiBase}/courses/${courseId}/edit`);

  // ── Lesson item CRUD ───────────────────────────────────────────────────────

  const openAddItem = () => { setItemForm(EMPTY_ITEM); setItemModal(true); };

  const saveItem = async () => {
    if (!itemForm.title.trim()) { setErrorMsg('Tiêu đề mục không được để trống.'); return; }
    setSavingItem(true);
    setErrorMsg('');
    try {
      const payload = {
        title:            itemForm.title.trim(),
        title_ja:         itemForm.title_ja.trim() || null,
        lesson_type:      itemForm.lesson_type,
        duration_minutes: Number(itemForm.duration_minutes) || 0,
        question_count:   Number(itemForm.question_count)   || 0,
        course_id:        courseId,
        unit_id:          unitId,
        order_index:      items.length,
      };
      const res = await api.post(`${apiBase}/lessons`, payload);
      setItemModal(false);
      const seg = DEEP_ROUTE[payload.lesson_type];
      if (seg) navigate(`${apiBase}/lessons/${res.data.id}/${seg}`);
      else await load();
    } catch (e) {
      setErrorMsg(e.message || 'Không thể tạo mục.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleEditItem = (item) => {
    const seg = DEEP_ROUTE[item.lesson_type];
    if (seg) navigate(`${apiBase}/lessons/${item.id}/${seg}`);
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Xóa mục "${item.title}"?`)) return;
    try {
      await api.delete(`${apiBase}/lessons/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e) {
      setErrorMsg(e.message || 'Không thể xóa mục.');
    }
  };

  // ── Drag reorder ───────────────────────────────────────────────────────────

  const handleDragStart = (e, idx) => {
    e.stopPropagation();
    dragIdx.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const updated = [...items];
    const [moved] = updated.splice(dragIdx.current, 1);
    updated.splice(idx, 0, moved);
    dragIdx.current = idx;
    setDraggingIdx(idx);
    setItems(updated);
  };

  const handleDragEnd = async () => {
    setDraggingIdx(null);
    dragIdx.current = null;
    try {
      await api.patch(`${apiBase}/lessons/reorder`, {
        items: items.map((l, i) => ({ id: l.id, order_index: i })),
      });
    } catch {
      // non-critical — order may not be persisted but UI stays consistent
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isPublished = course?.is_published;
  const backPath = `${apiBase}/courses/${courseId}/edit`;

  if (loading) {
    return (
      <Layout title="Chỉnh sửa bài học">
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-sumire-purple text-5xl">progress_activity</span>
        </div>
      </Layout>
    );
  }

  if (errorMsg && !unit) {
    return (
      <Layout title="Chỉnh sửa bài học">
        <div className="text-center py-24 text-on-muted">{errorMsg}</div>
      </Layout>
    );
  }

  return (
    <Layout title="Chỉnh sửa bài học">
      {/* Error banner */}
      {errorMsg && (
        <div className="mb-5 flex items-center gap-3 bg-error-container/20 border border-error/20 text-error rounded-xl px-4 py-3 text-sm">
          <span className="material-symbols-outlined text-base">error</span>
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="hover:opacity-70"><span className="material-symbols-outlined text-base">close</span></button>
        </div>
      )}

      {/* Breadcrumb + toggle */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 text-sm text-on-muted hover:text-sumire-purple transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {course?.title} — Bài học
        </button>

        {preview ? (
          <button
            onClick={() => setPreview(false)}
            className="flex items-center gap-2 px-4 py-2 bg-sumire-purple text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-base">visibility</span>
            Quay lại chỉnh sửa
          </button>
        ) : (
          <button
            onClick={() => setPreview(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-base">visibility</span>
            Xem trước dưới góc nhìn học viên
          </button>
        )}
      </div>

      {/* Page heading */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-2xl font-bold text-on-surface">Chỉnh sửa bài học</h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {isPublished ? 'Đã xuất bản' : 'Nháp'}
          </span>
        </div>
        <p className="text-sm text-on-muted">Soạn nội dung bài học và sắp xếp các mục học cho học viên.</p>
      </div>

      {/* ── Preview mode ── */}
      {preview ? (
        <div className="pb-8">
          <div className="mb-4 flex items-center gap-2 bg-sumire-purple/8 border border-sumire-purple/20 text-sumire-purple rounded-xl px-4 py-3 text-sm">
            <span className="material-symbols-outlined text-base">info</span>
            Đây là giao diện học viên sẽ nhìn thấy. {!isPublished && 'Nội dung chưa được xuất bản.'}
          </div>
          <PreviewCard unit={unit} items={items} sortOrder={form.sort_order || unit?.sort_order} />
        </div>
      ) : (
        /* ── Edit mode ── */
        <div className="space-y-5 pb-28">

          {/* Section 1: Unit info */}
          <section className="bg-white border border-outline/30 rounded-2xl p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface mb-5">
              <span className="material-symbols-outlined text-sumire-purple text-xl">edit</span>
              Thông tin bài học
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title VI */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1.5">
                  Tiêu đề (Tiếng Việt) <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="VD: Bài 1 – Chào hỏi"
                  className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
                />
              </div>

              {/* Title JA */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1.5">Tiêu đề (Tiếng Nhật)</label>
                <input
                  type="text"
                  value={form.title_ja}
                  onChange={e => setField('title_ja', e.target.value)}
                  placeholder="日本語のタイトル"
                  className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-on-surface mb-1.5">Mô tả ngắn</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Mô tả nội dung và mục tiêu của bài học..."
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors resize-y"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1.5">Cấp độ (Level)</label>
                <select
                  value={form.level}
                  onChange={e => setField('level', e.target.value)}
                  className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors bg-white appearance-none"
                >
                  <option value="">-- Chọn cấp độ --</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Sort order */}
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1.5">Thứ tự bài học</label>
                <input
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={e => setField('sort_order', e.target.value)}
                  placeholder="1"
                  className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Lesson items */}
          <section className="bg-white border border-outline/30 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface">
                <span className="material-symbols-outlined text-tsubaki-red text-xl">list</span>
                Nội dung bài học
              </h2>
              <span className="text-sm text-on-muted font-medium">{items.length} mục</span>
            </div>
            {items.length > 0 && (
              <p className="text-xs text-on-muted mb-4">
                Kéo thả <span className="inline-block align-middle">⠿</span> để sắp xếp lại thứ tự các mục học.
              </p>
            )}

            <div className="space-y-2 mt-4">
              {items.map((item, idx) => (
                <LessonItemRow
                  key={item.id}
                  item={item}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  isDragging={draggingIdx === idx}
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                />
              ))}

              <button
                onClick={openAddItem}
                className="w-full py-3.5 border-2 border-dashed border-outline/25 rounded-xl text-sumire-purple text-sm font-medium
                  hover:border-sumire-purple/50 hover:bg-sumire-purple/5 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Thêm mục học
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 right-0 left-0 md:left-64 z-20 bg-white/95 backdrop-blur-sm border-t border-outline/20 px-6 py-4 flex items-center justify-end gap-3">
        <button
          onClick={handleCancel}
          className="px-5 py-2.5 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all"
        >
          Hủy
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">save</span>
          {saving ? 'Đang lưu...' : 'Lưu nháp'}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-medium hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">upload</span>
          {publishing ? 'Đang xuất bản...' : 'Xuất bản'}
        </button>
      </div>

      {/* Add lesson item modal */}
      <Modal
        open={itemModal}
        onClose={() => setItemModal(false)}
        title="Thêm mục học"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setItemModal(false)}>Hủy</Button>
            <Button loading={savingItem} onClick={saveItem}>Tạo &amp; soạn nội dung</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2">Loại mục *</label>
            <LessonTypeSelector
              value={itemForm.lesson_type}
              onChange={v => setItemForm(f => ({ ...f, lesson_type: v, duration_minutes: '', question_count: '' }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Việt) *</label>
            <input
              type="text"
              value={itemForm.title}
              onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Nhập tiêu đề mục..."
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Nhật)</label>
            <input
              type="text"
              value={itemForm.title_ja}
              onChange={e => setItemForm(f => ({ ...f, title_ja: e.target.value }))}
              placeholder="日本語のタイトル"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
            />
          </div>
          {itemForm.lesson_type === 'quiz' ? (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Số câu hỏi</label>
              <input
                type="number" min="0"
                value={itemForm.question_count}
                onChange={e => setItemForm(f => ({ ...f, question_count: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Thời lượng (phút)</label>
              <input
                type="number" min="0"
                value={itemForm.duration_minutes}
                onChange={e => setItemForm(f => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors"
              />
            </div>
          )}
          <p className="text-xs text-on-muted">Sau khi tạo, bạn sẽ được chuyển tới trình soạn nội dung chi tiết.</p>
        </div>
      </Modal>
    </Layout>
  );
}
