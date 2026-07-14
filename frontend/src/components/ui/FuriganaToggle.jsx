/**
 * FuriganaToggle — nút bật/tắt furigana dùng chung (controlled).
 * Nơi gọi tự giữ state (active) và truyền onToggle; chỉ dùng cho các mục có
 * văn bản tiếng Nhật dài cần đọc (bài đọc, ngữ pháp, kanji).
 */
export default function FuriganaToggle({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Ẩn furigana' : 'Hiển thị furigana'}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-all select-none ${active ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'}`}>
      <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
      ふりがな
    </button>
  );
}
