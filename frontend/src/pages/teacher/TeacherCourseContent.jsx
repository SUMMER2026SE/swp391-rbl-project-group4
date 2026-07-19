import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import CourseForm, { EMPTY } from '../../components/teacher/CourseForm';
import { formatVnd } from '../../lib/format';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';

const LESSON_TYPES = [
  { value: 'video',      label: 'Video',    icon: 'play_circle', color: 'text-purple-500', badge: 'bg-purple-100 text-purple-700' },
  { value: 'reading',    label: 'Bài đọc',  icon: 'description', color: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
  { value: 'vocabulary', label: 'Từ vựng',  icon: 'translate',   color: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
  { value: 'kanji',      label: 'Kanji',    icon: 'draw',        color: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  { value: 'grammar',    label: 'Ngữ pháp', icon: 'spellcheck',  color: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  { value: 'quiz',       label: 'Quiz',     icon: 'quiz',        color: 'text-slate-500',  badge: 'bg-slate-100 text-slate-600' },
];
const typeMeta = (t) => LESSON_TYPES.find(x => x.value === t) || LESSON_TYPES[1];

// Loại có trình soạn chuyên sâu cho giáo viên.
const DEEP_TYPES = new Set(['video', 'reading', 'vocabulary', 'kanji', 'grammar', 'quiz']);
// Loại có nội dung có thể nhập file ngay sau khi tạo.
const IMPORT_TYPES = new Set(['vocabulary', 'kanji', 'grammar']);
// Map lesson_type → ImportFileModal type prop
const IMPORT_TYPE_MAP = { vocabulary: 'vocab', kanji: 'kanji', grammar: 'grammar' };

const EMPTY_UNIT = { title: '', title_ja: '' };
const EMPTY_ITEM = { title: '', title_ja: '', lesson_type: 'reading', duration_minutes: '', question_count: '' };

export default function TeacherCourseContent() {
  const confirm = useConfirm();
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [units, setUnits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Panel "Thông tin khóa học" (sửa inline, thay cho popup ở trang danh sách)
  const [infoOpen, setInfoOpen]     = useState(false);
  const [infoForm, setInfoForm]     = useState(EMPTY);
  const [savingInfo, setSavingInfo] = useState(false);

  // Popup "Thay đổi giá" — giá có luồng lưu riêng, tách khỏi Lưu thông tin
  const [priceModal, setPriceModal]   = useState(false);
  const [priceInput, setPriceInput]   = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const [unitModal, setUnitModal]     = useState(false);
  const [unitForm, setUnitForm]       = useState(EMPTY_UNIT);
  const [editingUnit, setEditingUnit] = useState(null);
  const [savingUnit, setSavingUnit]   = useState(false);

  // Thu gọn/mở từng "Bài học" (unit), key: unit.id — như UnitCard bên admin.
  const [collapsedUnits, setCollapsedUnits] = useState({});
  const toggleCollapse = (id) => setCollapsedUnits(c => ({ ...c, [id]: !c[id] }));

  // Item modal chỉ dùng để tạo mới — sửa thông tin làm ngay trong trang editor của mục.
  const [itemModal, setItemModal]     = useState(false);
  const [itemForm, setItemForm]       = useState(EMPTY_ITEM);
  const [targetUnit, setTargetUnit]   = useState(null);
  const [savingItem, setSavingItem]   = useState(false);

  // Post-create import flow: { id, type, title } when waiting for user choice
  const [pendingLesson, setPendingLesson] = useState(null);
  const [showImport, setShowImport]       = useState(false);

  const goToEditor = (lesson) => {
    setPendingLesson(null);
    setShowImport(false);
    navigate(`/teacher/lessons/${lesson.id}/${lesson.type}`);
  };

  const showAlert = (type, msg) => { setAlert({ type, msg }); setTimeout(() => setAlert({ type: '', msg: '' }), 4000); };

  // Giá không nằm trong form panel — chỉnh qua popup "Thay đổi giá" riêng.
  const courseToForm = (c) => ({
    title: c.title || '', title_ja: c.title_ja || '',
    description: c.description || '', description_ja: c.description_ja || '',
    level: c.level || '', thumbnail_url: c.thumbnail_url || '',
    is_published: c.is_published || false, price: '',
    reference_curriculum: c.reference_curriculum || '',
  });

  const loadCourse = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/teacher/courses/${courseId}/builder`);
      setCourse(r.data);
      setUnits(r.data.units || []);
      setInfoForm(courseToForm(r.data));
    } catch (e) { showAlert('error', e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadCourse(); }, [courseId]);

  const handlePublishToggle = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/teacher/courses/${courseId}`, { is_published: !course.is_published });
      setCourse(prev => ({ ...prev, is_published: r.data.is_published }));
      setInfoForm(f => ({ ...f, is_published: r.data.is_published }));
      showAlert('success', r.data.is_published ? 'Đã xuất bản khóa học.' : 'Đã đưa về bản nháp.');
    } catch (e) { showAlert('error', e.message); } finally { setSaving(false); }
  };

  const handleSaveInfo = async () => {
    if (!infoForm.title.trim()) return showAlert('error', 'Tiêu đề không được để trống.');

    const payload = {
      title: infoForm.title, title_ja: infoForm.title_ja,
      description: infoForm.description, description_ja: infoForm.description_ja,
      level: infoForm.level, thumbnail_url: infoForm.thumbnail_url,
      is_published: infoForm.is_published,
    };
    if (infoForm.reference_curriculum) payload.reference_curriculum = infoForm.reference_curriculum;

    setSavingInfo(true);
    try {
      const r = await api.put(`/teacher/courses/${courseId}`, payload);
      const updated = { ...course, ...r.data };
      setCourse(updated);
      setInfoForm(courseToForm(updated));
      showAlert('success', 'Đã cập nhật thông tin khóa học.');
    } catch (e) { showAlert('error', e.message); } finally { setSavingInfo(false); }
  };

  const handleCancelInfo = () => {
    setInfoForm(courseToForm(course));
    setInfoOpen(false);
  };

  const openPriceModal = () => { setPriceInput(course.price ?? ''); setPriceModal(true); };

  const handleSavePrice = async () => {
    const priceNum = Number(priceInput);
    if (priceInput === '' || !Number.isFinite(priceNum) || priceNum <= 0)
      return showAlert('error', 'Giá phải lớn hơn 0.');
    setSavingPrice(true);
    try {
      const r = await api.put(`/teacher/courses/${courseId}`, { price: priceNum });
      setCourse(prev => ({ ...prev, price: r.data.price ?? priceNum }));
      setPriceModal(false);
      showAlert('success', 'Đã cập nhật giá khóa học.');
    } catch (e) { showAlert('error', e.message); } finally { setSavingPrice(false); }
  };

  const uploadCover = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const r = await api.post('/teacher/courses/upload-cover', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.url;
  };

  // ── Units ──────────────────────────────────────────────────────────────────
  const openAddUnit  = () => { setUnitForm(EMPTY_UNIT); setEditingUnit(null); setUnitModal(true); };
  const openEditUnit = (u) => navigate(`/teacher/courses/${courseId}/units/${u.id}/edit`);

  const saveUnit = async () => {
    if (!unitForm.title.trim()) return showAlert('error', 'Tiêu đề bài học không được để trống.');
    setSavingUnit(true);
    try {
      const payload = { title: unitForm.title.trim(), title_ja: unitForm.title_ja.trim() || null };
      if (editingUnit) await api.put(`/teacher/units/${editingUnit.id}`, payload);
      else await api.post('/teacher/units', { ...payload, course_id: courseId, sort_order: units.length });
      setUnitModal(false);
      await loadCourse();
    } catch (e) { showAlert('error', e.message); } finally { setSavingUnit(false); }
  };

  const deleteUnit = async (u) => {
    if (!await confirm(`Xóa bài học "${u.title}" và tất cả mục bên trong?`)) return;
    try { await api.delete(`/teacher/units/${u.id}`); await loadCourse(); showAlert('success', 'Đã xóa bài học.'); }
    catch (e) { showAlert('error', e.message); }
  };

  // ── Lessons (Mục) ──────────────────────────────────────────────────────────
  // Mở trình soạn chuyên sâu theo loại (video/reading/vocabulary/kanji/grammar/quiz).
  const openDeepEditor = (item) => {
    navigate(`/teacher/lessons/${item.id}/${item.lesson_type}`);
  };

  const openAddItem = (unit) => { setItemForm(EMPTY_ITEM); setTargetUnit(unit); setItemModal(true); };

  const saveItem = async () => {
    if (!itemForm.title.trim()) return showAlert('error', 'Tiêu đề mục không được để trống.');
    setSavingItem(true);
    try {
      const payload = {
        title: itemForm.title.trim(), title_ja: itemForm.title_ja.trim() || null,
        lesson_type: itemForm.lesson_type,
        duration_minutes: Number(itemForm.duration_minutes) || 0,
        question_count: Number(itemForm.question_count) || 0,
      };
      const r = await api.post('/teacher/lessons', { ...payload, course_id: courseId, unit_id: targetUnit?.id, order_index: (targetUnit?.lessons || []).length });
      setItemModal(false);
      if (IMPORT_TYPES.has(payload.lesson_type)) {
        // Offer file import before going to the deep editor
        setPendingLesson({ id: r.data.id, type: payload.lesson_type, title: payload.title });
      } else if (DEEP_TYPES.has(payload.lesson_type)) {
        navigate(`/teacher/lessons/${r.data.id}/${payload.lesson_type}`);
      } else {
        await loadCourse();
      }
    } catch (e) { showAlert('error', e.message); } finally { setSavingItem(false); }
  };

  const deleteItem = async (item) => {
    if (!await confirm(`Xóa mục "${item.title}"?`)) return;
    try { await api.delete(`/teacher/lessons/${item.id}`); await loadCourse(); showAlert('success', 'Đã xóa mục.'); }
    catch (e) { showAlert('error', e.message); }
  };

  // ── Reorder (kéo-thả, giống trang builder của admin) ───────────────────────
  const dragUnitIdx = useRef(null);
  const dragItem = useRef(null); // { uIdx, iIdx }

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
      await api.patch('/teacher/units/reorder', { items: units.map((u, i) => ({ id: u.id, sort_order: i })) });
    } catch { showAlert('error', 'Không thể lưu thứ tự bài học.'); }
  };

  const handleItemDragStart = (e, uIdx, iIdx) => {
    e.stopPropagation();
    dragItem.current = { uIdx, iIdx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleItemDragOver = (e, uIdx, iIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = dragItem.current;
    if (!cur || cur.uIdx !== uIdx || cur.iIdx === iIdx) return;
    setUnits(prev => prev.map((u, i) => {
      if (i !== uIdx) return u;
      const lessons = [...(u.lessons || [])];
      const [moved] = lessons.splice(cur.iIdx, 1);
      lessons.splice(iIdx, 0, moved);
      return { ...u, lessons };
    }));
    dragItem.current = { uIdx, iIdx };
  };
  const handleItemDragEnd = async (e, uIdx) => {
    e.stopPropagation();
    dragItem.current = null;
    const lessons = units[uIdx]?.lessons || [];
    try {
      await api.patch('/teacher/lessons/reorder', { items: lessons.map((l, i) => ({ id: l.id, order_index: i })) });
    } catch { showAlert('error', 'Không thể lưu thứ tự mục.'); }
  };

  const isQuiz = itemForm.lesson_type === 'quiz';

  if (loading) return (
    <TeacherLayout title="Nội dung khóa học">
      <div className="flex items-center justify-center py-24"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span></div>
    </TeacherLayout>
  );
  if (!course) return (
    <TeacherLayout title="Nội dung khóa học"><div className="text-center py-24 text-on-muted">Không tìm thấy khóa học.</div></TeacherLayout>
  );

  return (
    <TeacherLayout title="Nội dung khóa học">
      {alert.msg && <div className="mb-5"><Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert></div>}

      {/* Header */}
      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button onClick={() => navigate('/teacher/courses')} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-3">
            <span className="material-symbols-outlined text-base">arrow_back</span> Quay lại danh sách
          </button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {course.level && <span className="bg-surface-container-highest/60 text-on-muted px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider">{course.level}</span>}
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${course.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {course.is_published ? 'Đã xuất bản' : 'Bản nháp'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-on-surface">{course.title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => window.open(`/courses/${courseId}`, '_blank')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all">
            <span className="material-symbols-outlined text-base">visibility</span> Xem trước
          </button>
          <button onClick={handlePublishToggle} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${course.is_published ? 'bg-surface border border-outline text-on-surface hover:bg-surface-low' : 'bg-tsubaki-red text-white hover:shadow-lg active:scale-95'}`}>
            <span className="material-symbols-outlined text-base">{course.is_published ? 'unpublished' : 'publish'}</span>
            {saving ? 'Đang lưu...' : course.is_published ? 'Bỏ xuất bản' : 'Xuất bản'}
          </button>
        </div>
      </section>

      {/* Thông tin khóa học (sửa inline) */}
      <section className="mb-6 bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden">
        <button onClick={() => setInfoOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-container-lowest/40 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">edit_note</span>
            </span>
            <div>
              <h3 className="font-semibold text-on-surface text-sm">Thông tin khóa học</h3>
              <p className="text-xs text-on-muted">Tiêu đề, cấp độ, giá, mô tả, trạng thái xuất bản</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-muted transition-transform" style={{ transform: infoOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </button>
        {infoOpen && (
          <div className="px-5 pb-5 border-t border-outline/10 pt-4">
            <CourseForm form={infoForm} onChange={setInfoForm} editing
              uploadCover={uploadCover} onError={(m) => showAlert('error', m)}
              onEditPrice={openPriceModal} currentPrice={course.price} />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={handleCancelInfo}>Hủy</Button>
              <Button loading={savingInfo} onClick={handleSaveInfo}>Lưu thông tin</Button>
            </div>
          </div>
        )}
      </section>

      {/* Units + lessons */}
      <div className="space-y-4">
        {units.map((unit, idx) => (
          <div
            key={unit.id}
            draggable
            onDragStart={(e) => handleUnitDragStart(e, idx)}
            onDragOver={(e) => handleUnitDragOver(e, idx)}
            onDragEnd={handleUnitDragEnd}
            className="bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline/10 bg-surface-container-lowest/40">
              <span className="material-symbols-outlined text-outline/50 cursor-grab text-xl shrink-0 mr-1" title="Kéo để đổi vị trí">drag_indicator</span>
              <button onClick={() => toggleCollapse(unit.id)} className="p-1 text-on-muted hover:text-on-surface transition-colors shrink-0">
                <span className={`material-symbols-outlined text-base transition-transform ${collapsedUnits[unit.id] ? '-rotate-90' : ''}`}>expand_more</span>
              </button>
              <button onClick={() => openEditUnit(unit)} className="flex items-center gap-3 min-w-0 text-left flex-1 group/unit">
                <span className="w-8 h-8 rounded-full bg-sumire-purple/10 text-sumire-purple text-sm font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-on-surface text-sm truncate group-hover/unit:text-sumire-purple transition-colors">{unit.title}</h3>
                  <p className="text-xs text-on-muted truncate">{unit.title_ja ? `${unit.title_ja} • ` : ''}{(unit.lessons || []).length} mục</p>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEditUnit(unit)} title="Chỉnh sửa bài học" className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors"><span className="material-symbols-outlined text-lg">edit</span></button>
                <button onClick={() => deleteUnit(unit)} className="p-1.5 text-on-muted hover:text-error hover:bg-red-50 rounded-lg transition-colors"><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
            </div>
            {!collapsedUnits[unit.id] && (
            <div className="p-4 space-y-2">
              {(unit.lessons || []).map((item, itemIdx) => {
                const meta = typeMeta(item.lesson_type);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleItemDragStart(e, idx, itemIdx)}
                    onDragOver={(e) => handleItemDragOver(e, idx, itemIdx)}
                    onDragEnd={(e) => handleItemDragEnd(e, idx)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-outline/20 hover:border-sumire-purple/30 hover:bg-surface-stone/40 transition-all group/item"
                  >
                    <span className="material-symbols-outlined text-outline/50 cursor-grab text-lg shrink-0" title="Kéo để đổi vị trí">drag_indicator</span>
                    <button onClick={() => openDeepEditor(item)} className="flex items-center gap-3 min-w-0 flex-1 text-left" title="Soạn nội dung">
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.badge}`}>
                        <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-on-surface truncate group-hover/item:text-sumire-purple transition-colors">{item.title}</p>
                        {item.title_ja && <p className="text-xs text-on-muted truncate">{item.title_ja}</p>}
                      </div>
                    </button>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>{meta.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openDeepEditor(item)} title="Sửa thông tin" className="p-1 text-on-muted hover:text-sumire-purple rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">tune</span></button>
                      <button onClick={() => deleteItem(item)} title="Xóa" className="p-1 text-on-muted hover:text-error rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => openAddItem(unit)} className="w-full py-3 border-2 border-dashed border-outline/25 rounded-xl text-sumire-purple text-sm font-medium hover:border-sumire-purple/50 hover:bg-sumire-purple/5 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">add</span> Thêm mục
              </button>
            </div>
            )}
          </div>
        ))}

        {units.length === 0 && (
          <div className="text-center py-10 text-on-muted text-sm">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-20">inbox</span>
            Chưa có bài học nào. Hãy thêm bài học đầu tiên bên dưới.
          </div>
        )}

        <button onClick={openAddUnit} className="w-full py-10 bg-white border-2 border-dashed border-outline/25 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-sumire-purple/50 hover:bg-sumire-purple/5 transition-all group">
          <div className="w-11 h-11 rounded-full bg-surface-container-highest/50 group-hover:bg-sumire-purple group-hover:text-white transition-all flex items-center justify-center"><span className="material-symbols-outlined text-2xl">add</span></div>
          <span className="font-semibold text-on-muted group-hover:text-sumire-purple transition-colors text-sm">Tạo bài học mới</span>
          <p className="text-xs text-outline">Một bài học chứa nhiều mục: Video, Bài đọc, Từ vựng, Kanji, Ngữ pháp, Quiz</p>
        </button>
      </div>

      {/* Price modal */}
      <Modal open={priceModal} onClose={() => setPriceModal(false)} title="Thay đổi giá khóa học" size="sm"
        footer={<><Button variant="secondary" onClick={() => setPriceModal(false)}>Hủy</Button><Button loading={savingPrice} onClick={handleSavePrice}>Lưu</Button></>}>
        <div>
          <Input label="Giá khóa học (₫) *" type="number" min="0" value={priceInput}
            onChange={e => setPriceInput(e.target.value)} placeholder="VD: 299000" />
          <div className="mt-1.5 flex items-start gap-2 text-xs text-on-muted bg-sumire-purple/5 border border-sumire-purple/15 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-[16px] text-sumire-purple shrink-0">info</span>
            <span>
              Kizuna Nihongo giữ lại <strong>10% hoa hồng</strong>, bạn nhận <strong>90%</strong>.
              {Number(priceInput) > 0 && <> Với giá này, bạn nhận <strong>{formatVnd(Number(priceInput) * 0.9)}</strong>/lượt mua.</>}
            </span>
          </div>
        </div>
      </Modal>

      {/* Unit modal */}
      <Modal open={unitModal} onClose={() => setUnitModal(false)} title={editingUnit ? 'Chỉnh sửa bài học' : 'Thêm bài học mới'} size="sm"
        footer={<><Button variant="secondary" onClick={() => setUnitModal(false)}>Hủy</Button><Button loading={savingUnit} onClick={saveUnit}>Lưu</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề (Tiếng Việt) *" value={unitForm.title} onChange={e => setUnitForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Bài 1 – Chào hỏi" />
          <Input label="Tiêu đề (Tiếng Nhật)" value={unitForm.title_ja} onChange={e => setUnitForm(f => ({ ...f, title_ja: e.target.value }))} placeholder="日本語のタイトル" />
        </div>
      </Modal>

      {/* Item modal (tạo mới) */}
      <Modal open={itemModal} onClose={() => setItemModal(false)} title="Thêm mục" size="md"
        footer={<><Button variant="secondary" onClick={() => setItemModal(false)}>Hủy</Button><Button loading={savingItem} onClick={saveItem}>Tạo & soạn nội dung</Button></>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2">Loại mục *</label>
            <div className="grid grid-cols-3 gap-2">
              {LESSON_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setItemForm(f => ({ ...f, lesson_type: t.value }))}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${itemForm.lesson_type === t.value ? 'border-sumire-purple bg-sumire-purple/5 text-sumire-purple' : 'border-outline/30 hover:border-sumire-purple/40 text-on-muted'}`}>
                  <span className={`material-symbols-outlined text-2xl ${itemForm.lesson_type === t.value ? 'text-sumire-purple' : t.color}`}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Input label="Tiêu đề (Tiếng Việt) *" value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} placeholder="Nhập tiêu đề mục..." />
          <Input label="Tiêu đề (Tiếng Nhật)" value={itemForm.title_ja} onChange={e => setItemForm(f => ({ ...f, title_ja: e.target.value }))} placeholder="日本語のタイトル" />
          {isQuiz ? (
            <Input label="Số câu hỏi" type="number" min="0" value={itemForm.question_count} onChange={e => setItemForm(f => ({ ...f, question_count: e.target.value }))} placeholder="0" />
          ) : (
            <Input label="Thời lượng (phút)" type="number" min="0" value={itemForm.duration_minutes} onChange={e => setItemForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="0" />
          )}
          <p className="text-xs text-on-muted">
            {IMPORT_TYPES.has(itemForm.lesson_type)
              ? 'Sau khi tạo, bạn có thể nhập nội dung từ file/JSON hoặc soạn thủ công.'
              : 'Sau khi tạo, bạn sẽ được chuyển tới trình soạn nội dung chi tiết cho mục này.'}
          </p>
        </div>
      </Modal>
      {/* Post-create choice: import or manual */}
      {pendingLesson && !showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-1">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeMeta(pendingLesson.type).badge}`}>
                <span className="material-symbols-outlined text-xl">{typeMeta(pendingLesson.type).icon}</span>
              </span>
              <div>
                <p className="text-xs text-on-muted font-medium uppercase tracking-wide">{typeMeta(pendingLesson.type).label}</p>
                <h2 className="font-semibold text-on-surface text-base">{pendingLesson.title}</h2>
              </div>
            </div>
            <p className="text-sm text-on-muted mt-3 mb-5">Bạn muốn thêm nội dung cho mục này bằng cách nào?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowImport(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-sumire-purple/30 hover:border-sumire-purple hover:bg-sumire-purple/5 transition-all text-left">
                <span className="material-symbols-outlined text-3xl text-sumire-purple">upload_file</span>
                <span className="font-semibold text-sm text-sumire-purple">Nhập file / JSON</span>
                <span className="text-xs text-on-muted text-center">Tải lên file hoặc dán JSON, AI hỗ trợ tạo nội dung</span>
              </button>
              <button
                onClick={() => goToEditor(pendingLesson)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-outline/30 hover:border-sumire-purple/40 hover:bg-surface-low transition-all text-left">
                <span className="material-symbols-outlined text-3xl text-on-muted">edit_note</span>
                <span className="font-semibold text-sm text-on-surface">Soạn thủ công</span>
                <span className="text-xs text-on-muted text-center">Thêm từng mục một trong trình soạn chi tiết</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal (post-create) */}
      {pendingLesson && showImport && (
        <ImportFileModal
          open={true}
          onClose={() => goToEditor(pendingLesson)}
          type={IMPORT_TYPE_MAP[pendingLesson.type]}
          lessonId={pendingLesson.id}
          apiBase="/teacher"
          onImported={() => goToEditor(pendingLesson)}
        />
      )}
    </TeacherLayout>
  );
}
