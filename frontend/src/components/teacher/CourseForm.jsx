import { useRef, useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { formatVnd } from '../../lib/format';

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Business'];

export const EMPTY = {
  title: '', title_ja: '', description: '', description_ja: '',
  level: '', thumbnail_url: '', is_published: false,
  price: '', reference_curriculum: '',
};

// Form thông tin khóa học dùng chung: tạo mới (TeacherCourses) & sửa (TeacherCourseContent, ManageCourseContent).
// uploadCover(file) => Promise<url> (tùy chọn): nếu truyền, hiện thêm nút tải ảnh bìa từ máy.
// onEditPrice + currentPrice (tùy chọn): giá hiển thị chỉ đọc, chỉnh qua popup riêng ở trang cha.
// hidePrice (tùy chọn): ẩn hoàn toàn khối giá — dùng cho admin (khóa admin luôn miễn phí).
export default function CourseForm({ form, onChange, editing, uploadCover, onError, onEditPrice, currentPrice, hidePrice }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const validThumb = form.thumbnail_url && /^https?:\/\/.+/.test(form.thumbnail_url);
  const priceNum = Number(form.price);
  const showPayout = Number.isFinite(priceNum) && priceNum > 0;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCover(file);
      onChange({ ...form, thumbnail_url: url });
    } catch (err) {
      onError?.(err.message || 'Không thể tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {validThumb && (
        <div className="relative h-36 rounded-xl overflow-hidden bg-surface-low">
          <img src={form.thumbnail_url} alt="preview" className="w-full h-full object-cover"
            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }} />
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">Preview</span>
        </div>
      )}

      <Input label="Tiêu đề (Tiếng Việt) *" value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })} placeholder="Nhập tên khóa học..." />
      <Input label="Tiêu đề (Tiếng Nhật)" value={form.title_ja}
        onChange={e => onChange({ ...form, title_ja: e.target.value })} placeholder="コース名を入力..." />

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
        <select value={form.level} onChange={e => onChange({ ...form, level: e.target.value })}
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all">
          <option value="">-- Chọn cấp độ --</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {hidePrice ? null : onEditPrice ? (
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Giá khóa học</label>
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-low border border-outline rounded-xl">
            <span className="text-sm font-semibold text-on-surface">
              {currentPrice > 0 ? formatVnd(currentPrice) : 'Chưa đặt giá'}
            </span>
            <Button type="button" size="sm" onClick={onEditPrice} className="shrink-0">
              <span className="material-symbols-outlined text-[18px]">sell</span> Thay đổi giá
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Input
            label={editing ? 'Giá khóa học (₫)' : 'Giá khóa học (₫) *'}
            type="number" min="0" value={form.price}
            onChange={e => onChange({ ...form, price: e.target.value })} placeholder="VD: 299000" />
          <div className="mt-1.5 flex items-start gap-2 text-xs text-on-muted bg-sumire-purple/5 border border-sumire-purple/15 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-[16px] text-sumire-purple shrink-0">info</span>
            <span>
              Kizuna Nihongo giữ lại <strong>10% hoa hồng</strong>, bạn nhận <strong>90%</strong>.
              {showPayout && <> Với giá này, bạn nhận <strong>{formatVnd(priceNum * 0.9)}</strong>/lượt mua.</>}
            </span>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <Input label={uploadCover ? 'Ảnh bìa — dán URL hoặc tải ảnh lên' : 'URL Thumbnail (hoặc tải ảnh bìa trực tiếp trên thẻ)'} value={form.thumbnail_url}
              onChange={e => onChange({ ...form, thumbnail_url: e.target.value })} placeholder="https://example.com/image.jpg" />
          </div>
          {uploadCover && (
            <>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl border border-outline text-sm font-medium text-on-surface hover:border-tsubaki-red hover:text-tsubaki-red transition-colors disabled:opacity-60">
                <span className={`material-symbols-outlined text-[18px] ${uploading ? 'animate-spin' : ''}`}>{uploading ? 'progress_activity' : 'upload'}</span>
                {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
              </button>
            </>
          )}
        </div>
      </div>
      <Input label="Giáo trình tham chiếu" value={form.reference_curriculum}
        onChange={e => onChange({ ...form, reference_curriculum: e.target.value })} placeholder="VD: Minna no Nihongo Shokyu 1" />

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả (Tiếng Việt)</label>
        <textarea value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} rows={3}
          placeholder="Mô tả nội dung và mục tiêu khóa học..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Trạng thái</label>
        <button type="button" onClick={() => onChange({ ...form, is_published: !form.is_published })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            form.is_published ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' : 'bg-surface-low border-outline text-on-muted hover:bg-outline/20'}`}>
          <span className="material-symbols-outlined text-[18px]">{form.is_published ? 'public' : 'draft'}</span>
          {form.is_published ? 'Xuất bản (học viên thấy được)' : 'Bản nháp'}
        </button>
        <p className="text-xs text-on-muted mt-1">Nhớ thêm bài học trước khi xuất bản để học viên có nội dung học.</p>
      </div>
    </div>
  );
}
