import { useRef, useState } from 'react';
import { formatCount } from '../../lib/format';

// Gradient nền bìa theo cấp độ (khi chưa có ảnh bìa).
const LEVEL_COVER = {
  N5:       'from-emerald-500 to-green-600',
  N4:       'from-blue-500 to-indigo-600',
  N3:       'from-amber-500 to-orange-500',
  N2:       'from-orange-500 to-rose-500',
  N1:       'from-rose-500 to-red-600',
  Business: 'from-violet-500 to-purple-600',
  mixed:    'from-violet-500 to-purple-600',
};

// Thẻ quản lý khóa học dùng chung cho Admin & Giáo viên.
// uploadCover(file) => Promise<url>; onCoverUploaded(url) cập nhật state ở cha.
export default function CourseManageCard({
  course, onManage, onEdit, onTogglePublish, onDelete,
  uploadCover, onCoverUploaded, onError,
}) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const cover = LEVEL_COVER[course.level] || 'from-tsubaki-red to-sumire-purple';

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return onError?.('Vui lòng chọn file hình ảnh.');
    setUploading(true);
    try {
      const url = await uploadCover(file);
      onCoverUploaded?.(url);
    } catch (e) {
      onError?.(e.message || 'Không thể tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const togglePublish = async () => {
    setPublishing(true);
    try { await onTogglePublish(course); } finally { setPublishing(false); }
  };

  return (
    <article className="group bg-white rounded-2xl border border-outline/30 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Cover — kéo-thả / chọn ảnh bìa */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative h-44 shrink-0 cursor-pointer bg-gradient-to-br ${cover} overflow-hidden`}
        title="Nhấp hoặc kéo-thả để đổi ảnh bìa"
      >
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { e.currentTarget.style.display = 'none'; }} />
        )}

        {/* Lớp phủ drop-zone (khi chưa có ảnh, hoặc hover/drag để đổi) */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center text-white/90 transition-all
          ${course.thumbnail_url ? 'opacity-0 group-hover:opacity-100 bg-black/35' : 'opacity-100'}
          ${dragOver ? 'opacity-100 bg-black/45 ring-2 ring-inset ring-white/70' : ''}`}>
          {uploading ? (
            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-3xl mb-0.5">{course.thumbnail_url ? 'photo_camera' : 'image'}</span>
              <p className="text-sm font-semibold">{course.thumbnail_url ? 'Đổi ảnh bìa' : 'Thả ảnh bìa'}</p>
              {!course.thumbnail_url && <p className="text-xs opacity-80">or browse files</p>}
            </>
          )}
        </div>

        {/* Badge cấp độ */}
        {course.level && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm text-charcoal shadow-sm">
            {course.level}
          </span>
        )}

        {/* Badge trạng thái */}
        <span className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-sm shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${course.is_published ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={course.is_published ? 'text-green-700' : 'text-amber-700'}>{course.is_published ? 'Xuất bản' : 'Nháp'}</span>
        </span>

        {/* Tiêu đề tiếng Nhật overlay */}
        {course.title_ja && (
          <p className="absolute bottom-3 left-4 right-4 font-display text-lg font-bold text-white drop-shadow-md truncate pointer-events-none">
            {course.title_ja}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        <h3
          onClick={() => onManage(course)}
          className="font-semibold text-charcoal text-base leading-snug line-clamp-2 mb-1 cursor-pointer hover:text-tsubaki-red transition-colors"
          title="Quản lý nội dung khóa học"
        >
          {course.title}
        </h3>
        {course.description && (
          <p className="text-sm text-on-muted line-clamp-2 flex-1">{course.description}</p>
        )}

        {/* Meta: số học viên • số bài • ngày tạo */}
        <div className="flex items-center gap-3 mt-3 text-xs text-on-muted">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">group</span>
            {formatCount(course.enrollment_count)} học viên
          </span>
          {course.lesson_count != null && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">menu_book</span>
              {course.lesson_count} bài
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <span className="material-symbols-outlined text-[15px]">calendar_today</span>
            {course.created_at ? new Date(course.created_at).toLocaleDateString('vi') : '—'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline/20">
          <button
            onClick={() => onEdit(course)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline/40 text-sm font-medium text-on-surface hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Sửa
          </button>
          <button
            onClick={togglePublish}
            disabled={publishing}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
              course.is_published
                ? 'border border-outline/40 text-on-muted hover:bg-surface-low'
                : 'bg-tsubaki-red text-white hover:bg-primary shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {publishing ? 'progress_activity' : course.is_published ? 'unpublished' : 'publish'}
            </span>
            {course.is_published ? 'Bỏ xuất bản' : 'Xuất bản'}
          </button>
          <button
            onClick={() => onDelete(course)}
            title="Xóa"
            className="p-2 rounded-xl text-on-muted hover:text-error hover:bg-red-50 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    </article>
  );
}
