import { useEffect } from 'react';

const SIZE_CLASSES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md', showHeader = true }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${SIZE_CLASSES[size] || SIZE_CLASSES.md} max-h-[90vh] flex flex-col`}>
        {/* Header */}
        {showHeader && (
          <div className="flex items-center justify-between p-6 border-b border-outline/30">
            <h2 className="font-display text-lg font-bold text-charcoal">{title}</h2>
            <button onClick={onClose} className="text-on-muted hover:text-charcoal transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {/* Footer */}
        {footer && <div className="p-6 border-t border-outline/30 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
