// Thẻ nội dung nghe dùng chung (Thư viện & Của tôi). Hiển thị badge loại rõ ràng
// (Hội thoại / Audio / Video / YouTube) + chip cấp độ + tiêu đề JP + meta.

const LEVEL_COLOR = { N5: '#059669', N4: '#0284c7', N3: '#7c3aed', N2: '#d97706', N1: '#ae2826' };
const LEVEL_BG    = { N5: '#d1fae5', N4: '#dbeafe', N3: '#ede9fe', N2: '#fef3c7', N1: '#fde8e8' };

// Loại nội dung → nhãn + icon.
function typeInfo(item) {
  if (item.kind === 'dialogue' || item._type === 'dialogue') return { label: 'Hội thoại', icon: 'forum' };
  if (item.source_type === 'youtube') return { label: 'YouTube', icon: 'smart_display' };
  if (item.source_type === 'video')   return { label: 'Video',   icon: 'movie' };
  return { label: 'Audio', icon: 'graphic_eq' }; // audio | tts
}

export default function ContentCard({ item, onClick, onEdit, onDelete }) {
  const t = typeInfo(item);
  const segCount = item.segments?.length ?? item.line_count ?? null;
  return (
    <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 group hover:shadow-md transition-all">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: LEVEL_BG[item.level] || '#f0f0ee' }}>
          <span className="material-symbols-outlined text-2xl" style={{ color: LEVEL_COLOR[item.level] || '#6b7280' }}>
            {t.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight truncate" style={{ fontFamily: "'Noto Sans JP',sans-serif" }}>{item.title}</p>
          {item.title_vi && <p className="text-xs text-on-muted truncate">{item.title_vi}</p>}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-low text-on-muted">{t.label}</span>
            {item.level && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: LEVEL_BG[item.level], color: LEVEL_COLOR[item.level] }}>{item.level}</span>
            )}
            {segCount != null && <span className="text-[10px] text-on-muted">{segCount} đoạn</span>}
          </div>
        </div>
      </button>
      {(onEdit || onDelete) && (
        <div className="flex gap-1 shrink-0">
          {onEdit && (
            <button onClick={onEdit} title="Sửa" className="w-8 h-8 rounded-lg hover:bg-surface-low flex items-center justify-center text-on-muted hover:text-tsubaki-red transition-colors">
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} title="Xoá" className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-tsubaki-red flex items-center justify-center text-on-muted transition-colors">
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
