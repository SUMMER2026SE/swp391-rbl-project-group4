import Modal from './Modal';
import Button from './Button';

// Popup xác nhận dùng chung — thay cho window.confirm() của trình duyệt.
export default function ConfirmDialog({
  open,
  title,
  message,
  icon = 'delete',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const danger = variant === 'danger';
  return (
    <Modal
      open={open}
      onClose={onCancel}
      showHeader={false}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center pt-2">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
          danger ? 'bg-error-bg text-error' : 'bg-tsubaki-red/10 text-tsubaki-red'
        }`}>
          <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
        <h2 className="font-display text-lg font-bold text-charcoal mb-2">{title}</h2>
        {message && <p className="text-sm text-on-surface-variant leading-relaxed">{message}</p>}
      </div>
    </Modal>
  );
}
