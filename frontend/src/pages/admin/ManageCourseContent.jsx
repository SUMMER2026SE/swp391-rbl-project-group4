import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

// Loại Mục (item). Mỗi loại mở một editor riêng theo lesson_id.
const LESSON_TYPES = [
  { value: 'video',      label: 'Video',      icon: 'play_circle',    color: 'text-purple-500', badge: 'bg-purple-100 text-purple-700' },
  { value: 'reading',    label: 'Bài đọc',    icon: 'description',    color: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
  { value: 'vocabulary', label: 'Từ vựng',    icon: 'translate',      color: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
  { value: 'kanji',      label: 'Kanji',      icon: 'draw',           color: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  { value: 'grammar',    label: 'Ngữ pháp',   icon: 'spellcheck',     color: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  { value: 'quiz',       label: 'Quiz',       icon: 'quiz',           color: 'text-slate-500',  badge: 'bg-slate-100 text-slate-600' },
];

const TYPE_ROUTE = { video: 'video', reading: 'reading', vocabulary: 'vocabulary', kanji: 'kanji', grammar: 'grammar', quiz: 'quiz' };

const getTypeMeta = (type) => LESSON_TYPES.find(t => t.value === type) || LESSON_TYPES[1];

const EMPTY_UNIT = { title: '', title_ja: '' };
const EMPTY_ITEM = { title: '', title_ja: '', lesson_type: 'reading', duration_minutes: '', question_count: '' };

// ── Type selector ───────────────────────────────────────────────────────────────

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
          <span className={`material-symbols-outlined text-2xl ${value === t.value ? 'text-sumire-purple' : t.color}`}>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, onEditContent, onEditInfo, onDelete, onDragStart, onDragOver, onDragEnd, isDragging }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const meta = getTypeMeta(item.lesson_type);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group/item
        ${isDragging
          ? 'opacity-40 bg-surface-container/50 border-sumire-purple/30 scale-[0.98]'
          : 'border-outline/20 hover:border-sumire-purple/30 hover:bg-surface-stone'}`}
    >
      <span className="material-symbols-outlined text-on-muted/30 hover:text-on-muted cursor-grab text-base shrink-0">drag_indicator</span>
      <button
        onClick={() => onEditContent(item)}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
        title="Soạn nội dung"
      >
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.badge}`}>
          <span className="material-symbols-outlined text-lg">{meta.icon}</span>
        </span>
        <div className="min-w-0">
          <p className="font-medium text-sm text-on-surface truncate group-hover/item:text-sumire-purple transition-colors">{item.title}</p>
          {item.title_ja && <p className="text-xs text-on-muted truncate">{item.title_ja}</p>}
        </div>
      </button>

      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
        {item.lesson_type === 'quiz' && item.question_count ? `${meta.label} • ${item.question_count} câu`
          : item.duration_minutes > 0 ? `${meta.label} • ${item.duration_minutes}′`
          : meta.label}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} className="p-1 text-on-muted hover:text-sumire-purple rounded-lg transition-colors">
            <span className="material-symbols-outlined text-lg">more_vert</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-white border border-outline/30 rounded-xl shadow-lg min-w-[176px] py-1 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); onEditContent(item); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-surface-low flex items-center gap-2 text-sumire-purple font-medium"
              >
                <span className="material-symbols-outlined text-base">edit_note</span> Soạn nội dung
              </button>
              <button
                onClick={() => { setMenuOpen(false); onEditInfo(item); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-surface-low flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-base">tune</span> Sửa thông tin
              </button>
              <div className="h-px bg-outline/10 mx-2 my-1" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(item); }}
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

// ── Unit card ("Bài học") ───────────────────────────────────────────────────────

function UnitCard({ unit, index, onUnitEdit, onUnitDelete, onItemAdd, onItemEditContent, onItemEditInfo, onItemDelete, onItemsReorder, dragProps }) {
  const [collapsed, setCollapsed] = useState(false);
  const [localItems, setLocalItems] = useState(unit.lessons || []);
  const dragItemIdx = useRef(null);
  const [draggingItemIdx, setDraggingItemIdx] = useState(null);

  useEffect(() => { setLocalItems(unit.lessons || []); }, [unit.lessons]);

  const totalMin = localItems.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  const handleItemDragStart = (e, idx) => {
    e.stopPropagation();
    dragItemIdx.current = idx;
    setDraggingItemIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleItemDragOver = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragItemIdx.current === null || dragItemIdx.current === idx) return;
    const updated = [...localItems];
    const [moved] = updated.splice(dragItemIdx.current, 1);
    updated.splice(idx, 0, moved);
    dragItemIdx.current = idx;
    setDraggingItemIdx(idx);
    setLocalItems(updated);
  };
  const handleItemDragEnd = async (e) => {
    e.stopPropagation();
    setDraggingItemIdx(null);
    dragItemIdx.current = null;
    await onItemsReorder(localItems.map((l, i) => ({ id: l.id, order_index: i })));
  };

  return (
    <div className="bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md group" {...dragProps}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline/10 bg-surface-container-lowest/40">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="material-symbols-outlined text-outline/50 cursor-grab text-xl shrink-0">drag_indicator</span>
          <button onClick={() => setCollapsed(v => !v)} className="p-1 text-on-muted hover:text-on-surface transition-colors shrink-0">
            <span className={`material-symbols-outlined text-base transition-transform ${collapsed ? '-rotate-90' : ''}`}>expand_more</span>
          </button>
          <span className="w-8 h-8 rounded-full bg-sumire-purple/10 text-sumire-purple text-sm font-bold flex items-center justify-center shrink-0">{(index ?? 0) + 1}</span>
          <button onClick={() => onUnitEdit(unit)} className="flex-1 min-w-0 text-left group/unitname">
            <h3 className="font-semibold text-on-surface text-sm truncate group-hover/unitname:text-sumire-purple transition-colors">{unit.title}</h3>
            <p className="text-xs text-on-muted truncate">
              {unit.title_ja ? `${unit.title_ja} • ` : ''}{localItems.length} mục{totalMin > 0 ? ` • ${totalMin} phút` : ''}
            </p>
          </button>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onUnitEdit(unit)} className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors" title="Chỉnh sửa bài học">
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
          <button onClick={() => onUnitDelete(unit)} className="p-1.5 text-on-muted hover:text-error hover:bg-error-container/20 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="p-4 space-y-2">
          {localItems.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              onEditContent={onItemEditContent}
              onEditInfo={onItemEditInfo}
              onDelete={onItemDelete}
              isDragging={draggingItemIdx === idx}
              onDragStart={(e) => handleItemDragStart(e, idx)}
              onDragOver={(e) => handleItemDragOver(e, idx)}
              onDragEnd={handleItemDragEnd}
            />
          ))}
          <button
            onClick={() => onItemAdd(unit)}
            className="w-full py-3 border-2 border-dashed border-outline/25 rounded-xl text-sumire-purple text-sm font-medium
              hover:border-sumire-purple/50 hover:bg-sumire-purple/5 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Thêm mục
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

  const [course, setCourse] = useState(null);
  const [units, setUnits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Unit modal
  const [unitModal, setUnitModal]     = useState(false);
  const [unitForm, setUnitForm]       = useState(EMPTY_UNIT);
  const [editingUnit, setEditingUnit] = useState(null);
  const [savingUnit, setSavingUnit]   = useState(false);

  // Item modal
  const [itemModal, setItemModal]     = useState(false);
  const [itemForm, setItemForm]       = useState(EMPTY_ITEM);
  const [editingItem, setEditingItem] = useState(null);
  const [targetUnit, setTargetUnit]   = useState(null);
  const [savingItem, setSavingItem]   = useState(false);

  const dragUnitIdx = useRef(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const loadCourse = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/courses/${courseId}/builder`);
      setCourse(r.data);
      setUnits(r.data.units || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Không thể tải khóa học.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadCourse(); }, [courseId]);

  // ── Publish / Preview ────────────────────────────────────────────────────────
  const handlePublishToggle = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/admin/courses/${courseId}`, { is_published: !course.is_published });
      setCourse(prev => ({ ...prev, is_published: r.data.is_published }));
      setAlert({ type: 'success', msg: r.data.is_published ? 'Đã xuất bản khóa học.' : 'Đã đưa về bản nháp.' });
    } catch (e) { setAlert({ type: 'error', msg: e.message }); } finally { setSaving(false); }
  };
  const handlePreview = () => window.open(`/courses/${courseId}`, '_blank');

  // ── Unit CRUD ──────────────────────────────────────────────────────────────
  const openAddUnit = () => { setUnitForm(EMPTY_UNIT); setEditingUnit(null); setUnitModal(true); };
  const openEditUnit = (u) => navigate(`/admin/courses/${courseId}/units/${u.id}/edit`);

  const saveUnit = async () => {
    if (!unitForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề bài học không được để trống.' });
    setSavingUnit(true);
    try {
      const payload = { title: unitForm.title.trim(), title_ja: unitForm.title_ja.trim() || null };
      if (editingUnit) await api.put(`/admin/units/${editingUnit.id}`, payload);
      else await api.post('/admin/units', { ...payload, course_id: courseId, sort_order: units.length });
      setUnitModal(false);
      await loadCourse();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); } finally { setSavingUnit(false); }
  };

  const deleteUnit = async (u) => {
    if (!confirm(`Xóa bài học "${u.title}" và tất cả mục bên trong?`)) return;
    try {
      await api.delete(`/admin/units/${u.id}`);
      await loadCourse();
      setAlert({ type: 'success', msg: 'Đã xóa bài học.' });
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  // ── Item CRUD ──────────────────────────────────────────────────────────────
  const openItemEditor = (item) => {
    const seg = TYPE_ROUTE[item.lesson_type];
    if (seg) navigate(`/admin/lessons/${item.id}/${seg}`);
  };

  const openAddItem = (unit) => {
    setItemForm(EMPTY_ITEM);
    setEditingItem(null);
    setTargetUnit(unit);
    setItemModal(true);
  };

  const openEditItem = (item) => {
    setItemForm({
      title: item.title || '',
      title_ja: item.title_ja || '',
      lesson_type: item.lesson_type || 'reading',
      duration_minutes: item.duration_minutes || '',
      question_count: item.question_count || '',
    });
    setEditingItem(item);
    setTargetUnit(null);
    setItemModal(true);
  };

  const saveItem = async () => {
    if (!itemForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề mục không được để trống.' });
    setSavingItem(true);
    try {
      const payload = {
        title: itemForm.title.trim(),
        title_ja: itemForm.title_ja.trim() || null,
        lesson_type: itemForm.lesson_type,
        duration_minutes: Number(itemForm.duration_minutes) || 0,
        question_count: Number(itemForm.question_count) || 0,
      };
      if (editingItem) {
        await api.put(`/admin/lessons/${editingItem.id}`, payload);
        setItemModal(false);
        await loadCourse();
      } else {
        const existing = targetUnit?.lessons || [];
        const res = await api.post('/admin/lessons', {
          ...payload,
          course_id: courseId,
          unit_id: targetUnit?.id,
          order_index: existing.length,
        });
        setItemModal(false);
        const seg = TYPE_ROUTE[payload.lesson_type];
        if (seg) navigate(`/admin/lessons/${res.data.id}/${seg}`);
        else await loadCourse();
      }
    } catch (e) { setAlert({ type: 'error', msg: e.message }); } finally { setSavingItem(false); }
  };

  const deleteItem = async (item) => {
    if (!confirm(`Xóa mục "${item.title}"?`)) return;
    try {
      await api.delete(`/admin/lessons/${item.id}`);
      await loadCourse();
      setAlert({ type: 'success', msg: 'Đã xóa mục.' });
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  // ── Reorder ──────────────────────────────────────────────────────────────────
  const handleUnitDragStart = (e, idx) => { dragUnitIdx.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const handleUnitDragOver = (e, idx) => {
    e.preventDefault();
    if (dragUnitIdx.current === null || dragUnitIdx.current === idx) return;
    const updated = [...units];
    const [moved] = updated.splice(dragUnitIdx.current, 1);
    updated.splice(idx, 0, moved);
    dragUnitIdx.current = idx;
    setUnits(updated);
  };
  const handleUnitDragEnd = async () => {
    dragUnitIdx.current = null;
    try {
      await api.patch('/admin/units/reorder', { items: units.map((u, i) => ({ id: u.id, sort_order: i })) });
    } catch (e) { setAlert({ type: 'error', msg: 'Không thể lưu thứ tự bài học.' }); }
  };

  const handleItemsReorder = async (items) => {
    try { await api.patch('/admin/lessons/reorder', { items }); }
    catch (e) { setAlert({ type: 'error', msg: 'Không thể lưu thứ tự mục.' }); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  const isQuiz = itemForm.lesson_type === 'quiz';

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
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">{alert.msg}</Alert>
      )}

      {/* Header */}
      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button onClick={() => navigate('/admin/courses')} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3">
            <span className="material-symbols-outlined text-base">arrow_back</span> Quay lại danh sách
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {course.level && (
              <span className="bg-surface-container-highest/60 text-on-muted px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">{course.level}</span>
            )}
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {course.is_published ? 'Đã xuất bản' : 'Bản nháp'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-on-surface">{course.title}</h1>
          {course.description && <p className="text-on-muted text-sm mt-1 max-w-xl">{course.description}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={handlePreview} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all">
            <span className="material-symbols-outlined text-base">visibility</span> Xem trước
          </button>
          <button
            onClick={handlePublishToggle}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${course.is_published ? 'bg-surface border border-outline text-on-surface hover:bg-surface-low' : 'bg-tsubaki-red text-white hover:shadow-lg active:scale-95'}`}
          >
            <span className="material-symbols-outlined text-base">{course.is_published ? 'unpublished' : 'publish'}</span>
            {saving ? 'Đang lưu...' : course.is_published ? 'Bỏ xuất bản' : 'Xuất bản'}
          </button>
        </div>
      </section>

      {/* Builder */}
      <div className="space-y-4">
        {units.map((unit, idx) => (
          <div
            key={unit.id}
            draggable
            onDragStart={(e) => handleUnitDragStart(e, idx)}
            onDragOver={(e) => handleUnitDragOver(e, idx)}
            onDragEnd={handleUnitDragEnd}
          >
            <UnitCard
              unit={unit}
              index={idx}
              onUnitEdit={openEditUnit}
              onUnitDelete={deleteUnit}
              onItemAdd={openAddItem}
              onItemEditContent={openItemEditor}
              onItemEditInfo={openEditItem}
              onItemDelete={deleteItem}
              onItemsReorder={handleItemsReorder}
            />
          </div>
        ))}

        {units.length === 0 && (
          <div className="text-center py-10 text-on-muted text-sm">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-20">inbox</span>
            Chưa có bài học nào. Hãy thêm bài học đầu tiên bên dưới.
          </div>
        )}

        <button
          onClick={openAddUnit}
          className="w-full py-10 bg-white border-2 border-dashed border-outline/25 rounded-2xl flex flex-col items-center justify-center gap-2
            hover:border-sumire-purple/50 hover:bg-sumire-purple/5 transition-all group"
        >
          <div className="w-11 h-11 rounded-full bg-surface-container-highest/50 group-hover:bg-sumire-purple group-hover:text-white transition-all flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">add</span>
          </div>
          <span className="font-semibold text-on-muted group-hover:text-sumire-purple transition-colors text-sm">Tạo bài học mới</span>
          <p className="text-xs text-outline">Một bài học chứa nhiều mục: Video, Bài đọc, Từ vựng, Kanji, Ngữ pháp, Quiz</p>
        </button>
      </div>

      {/* Unit modal */}
      <Modal
        open={unitModal}
        onClose={() => setUnitModal(false)}
        title={editingUnit ? 'Chỉnh sửa bài học' : 'Thêm bài học mới'}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setUnitModal(false)}>Hủy</Button><Button loading={savingUnit} onClick={saveUnit}>Lưu</Button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Việt) *</label>
            <input
              type="text" value={unitForm.title}
              onChange={e => setUnitForm(f => ({ ...f, title: e.target.value }))}
              placeholder="VD: Bài 1 – Chào hỏi"
              onKeyDown={e => e.key === 'Enter' && saveUnit()}
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Nhật)</label>
            <input
              type="text" value={unitForm.title_ja}
              onChange={e => setUnitForm(f => ({ ...f, title_ja: e.target.value }))}
              placeholder="日本語のタイトル"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
        </div>
      </Modal>

      {/* Item modal */}
      <Modal
        open={itemModal}
        onClose={() => setItemModal(false)}
        title={editingItem ? 'Chỉnh sửa mục' : 'Thêm mục'}
        size="md"
        footer={<><Button variant="secondary" onClick={() => setItemModal(false)}>Hủy</Button><Button loading={savingItem} onClick={saveItem}>Lưu</Button></>}
      >
        <div className="space-y-4">
          {!editingItem && (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-2">Loại mục *</label>
              <LessonTypeSelector
                value={itemForm.lesson_type}
                onChange={v => setItemForm(f => ({ ...f, lesson_type: v, duration_minutes: '', question_count: '' }))}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Việt) *</label>
            <input
              type="text" value={itemForm.title}
              onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Nhập tiêu đề mục..."
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Tiêu đề (Tiếng Nhật)</label>
            <input
              type="text" value={itemForm.title_ja}
              onChange={e => setItemForm(f => ({ ...f, title_ja: e.target.value }))}
              placeholder="日本語のタイトル"
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
            />
          </div>
          {isQuiz ? (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Số câu hỏi</label>
              <input
                type="number" min="0" value={itemForm.question_count}
                onChange={e => setItemForm(f => ({ ...f, question_count: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Thời lượng (phút)</label>
              <input
                type="number" min="0" value={itemForm.duration_minutes}
                onChange={e => setItemForm(f => ({ ...f, duration_minutes: e.target.value }))}
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
