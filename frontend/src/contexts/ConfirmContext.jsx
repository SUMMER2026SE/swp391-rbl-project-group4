import { createContext, useContext, useCallback, useRef, useState } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';

// Provider dùng chung cho popup xác nhận / thông báo — thay cho confirm() & alert() gốc của trình duyệt.
// useConfirm(): trả về hàm confirm(opts) => Promise<boolean> (dùng: if (!await confirm('...')) return;)
// useNotify():  trả về hàm notify(opts)  => Promise<void>    (dùng thay cho alert('...'))
const ConfirmContext = createContext(null);

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

export function useNotify() {
  return useContext(ConfirmContext).notify;
}

const NOTIFY_ICONS = { error: 'error', success: 'check_circle', info: 'info' };
const NOTIFY_STYLES = {
  error:   'bg-error-bg text-error',
  success: 'bg-green-50 text-green-600',
  info:    'bg-tsubaki-red/10 text-tsubaki-red',
};

export function ConfirmProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [notifyState, setNotifyState] = useState(null);
  const confirmResolver = useRef(null);
  const notifyResolver = useRef(null);

  const confirm = useCallback((opts) => {
    const options = typeof opts === 'string' ? { title: opts } : (opts || {});
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const closeConfirm = (result) => {
    setConfirmState(null);
    if (confirmResolver.current) { confirmResolver.current(result); confirmResolver.current = null; }
  };

  const notify = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : (opts || {});
    return new Promise((resolve) => {
      notifyResolver.current = resolve;
      setNotifyState(options);
    });
  }, []);

  const closeNotify = () => {
    setNotifyState(null);
    if (notifyResolver.current) { notifyResolver.current(); notifyResolver.current = null; }
  };

  const nVariant = notifyState?.variant || 'error';

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title || 'Xác nhận'}
        message={confirmState?.message}
        icon={confirmState?.icon}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        variant={confirmState?.variant || 'danger'}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />

      <Modal
        open={!!notifyState}
        onClose={closeNotify}
        showHeader={false}
        size="sm"
        footer={<Button onClick={closeNotify}>Đóng</Button>}
      >
        <div className="flex flex-col items-center text-center pt-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${NOTIFY_STYLES[nVariant]}`}>
            <span className="material-symbols-outlined text-3xl">{NOTIFY_ICONS[nVariant]}</span>
          </div>
          {notifyState?.title && <h2 className="font-display text-lg font-bold text-charcoal mb-2">{notifyState.title}</h2>}
          {notifyState?.message && <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{notifyState.message}</p>}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
