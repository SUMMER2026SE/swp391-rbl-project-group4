export default function Alert({ type = 'error', children, onClose }) {
  const styles = {
    error:   'bg-error-bg text-error border-error/30',
    success: 'bg-green-50 text-green-800 border-green-200',
    info:    'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  const icons = { error: 'error', success: 'check_circle', info: 'info', warning: 'warning' };

  if (!children) return null;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${styles[type]}`}>
      <span className={`material-symbols-outlined text-lg ${type === 'success' ? 'fill' : ''} shrink-0 mt-0.5`}>{icons[type]}</span>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      )}
    </div>
  );
}
