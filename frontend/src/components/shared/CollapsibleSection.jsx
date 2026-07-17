// Khung panel thu gọn dùng chung (icon tròn + tiêu đề + mô tả + mũi tên expand),
// tách từ InfoPanel/ManagePanel của StudyListDetail để tái dùng cho trình soạn khóa học.
export default function CollapsibleSection({ icon, title, subtitle, open, onToggle, className = '', children }) {
  return (
    <section className={`bg-white border border-outline/30 shadow-sm rounded-2xl overflow-hidden ${className}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-low/40 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">{icon}</span>
          </span>
          <div>
            <h3 className="font-semibold text-on-surface text-sm">{title}</h3>
            <p className="text-xs text-on-muted">{subtitle}</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-muted transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-outline/10 pt-4 space-y-4">{children}</div>
      )}
    </section>
  );
}
