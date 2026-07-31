import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';

// Cấp quyền học khoá cho học viên theo email — giáo viên nhập danh sách email, hệ thống
// đối chiếu ra tài khoản thật rồi hiện bảng XÁC NHẬN trước khi ghi. Không đụng tới học
// viên đã tự đăng ký/đã thanh toán (backend chặn, xem services/courseGrantService.js).

const STATUS_META = {
  ok:        { label: 'Sẽ cấp quyền',            cls: 'bg-emerald-50 text-emerald-700' },
  already:   { label: 'Đã có quyền',             cls: 'bg-surface-low text-on-muted' },
  is_owner:  { label: 'Người tạo khoá',          cls: 'bg-sumire-purple/10 text-sumire-purple' },
  not_found: { label: 'Không tìm thấy tài khoản', cls: 'bg-red-50 text-error' },
};

function Avatar({ row }) {
  if (row.avatar_url) {
    return <img src={row.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  const ch = (row.full_name?.[0] || row.email?.[0] || '?').toUpperCase();
  return (
    <span className="w-8 h-8 rounded-full bg-surface-low text-on-muted flex items-center justify-center text-xs font-bold shrink-0">
      {ch}
    </span>
  );
}

export default function CourseGrantModal({ course, onClose }) {
  const confirm = useConfirm();
  const [tab, setTab]         = useState('grant');  // 'grant' | 'granted'
  const [emails, setEmails]   = useState('');
  const [preview, setPreview] = useState(null);     // null = chưa kiểm tra
  const [granted, setGranted] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const notify = (type, msg) => setAlert({ type, msg });

  const loadGranted = useCallback(async () => {
    try {
      const r = await api.get(`/teacher/courses/${course.id}/grants`);
      setGranted(r.data || []);
    } catch (e) {
      notify('error', e.data?.error || 'Không thể tải danh sách đã cấp.');
    }
  }, [course.id]);

  useEffect(() => { loadGranted(); }, [loadGranted]);

  // Bước 1 — đối chiếu email, chưa ghi gì vào DB
  const handleCheck = async () => {
    if (!emails.trim()) return notify('error', 'Hãy nhập ít nhất một email.');
    setBusy(true); setAlert({ type: '', msg: '' });
    try {
      const r = await api.post(`/teacher/courses/${course.id}/grants/preview`, { emails });
      setPreview(r.data.results || []);
    } catch (e) {
      notify('error', e.data?.error || 'Không thể kiểm tra danh sách.');
    } finally { setBusy(false); }
  };

  // Bước 2 — xác nhận cấp cho các dòng hợp lệ
  const handleGrant = async () => {
    const ids = (preview || []).filter(r => r.status === 'ok').map(r => r.user_id);
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await api.post(`/teacher/courses/${course.id}/grants`, { user_ids: ids });
      notify('success', `Đã cấp quyền cho ${r.data.granted} học viên${r.data.skipped ? `, bỏ qua ${r.data.skipped}` : ''}.`);
      setEmails(''); setPreview(null);
      loadGranted();
      setTab('granted');
    } catch (e) {
      notify('error', e.data?.error || 'Không thể cấp quyền.');
    } finally { setBusy(false); }
  };

  const handleRevoke = async (row) => {
    if (!await confirm(`Thu hồi quyền học của ${row.full_name || row.email}?`)) return;
    try {
      await api.delete(`/teacher/courses/${course.id}/grants/${row.student_id}`);
      setGranted(prev => prev.filter(g => g.student_id !== row.student_id));
      notify('success', 'Đã thu hồi quyền.');
    } catch (e) {
      notify('error', e.data?.error || 'Không thể thu hồi quyền.');
    }
  };

  const okCount = (preview || []).filter(r => r.status === 'ok').length;

  return (
    <Modal
      open={!!course}
      onClose={onClose}
      size="lg"
      title={`Cấp quyền học — ${course.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          {tab === 'grant' && (
            preview
              ? <Button loading={busy} disabled={!okCount} onClick={handleGrant}>
                  Xác nhận cấp quyền{okCount ? ` cho ${okCount} học viên` : ''}
                </Button>
              : <Button loading={busy} onClick={handleCheck}>Kiểm tra</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {alert.msg && (
          <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-low rounded-xl">
          {[
            { v: 'grant',   label: 'Cấp quyền' },
            { v: 'granted', label: `Đã cấp (${granted.length})` },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.v ? 'bg-white text-tsubaki-red shadow-sm' : 'text-on-muted hover:text-charcoal'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'grant' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">
                Email học viên — mỗi dòng một email (hoặc phân tách bằng dấu phẩy)
              </label>
              <textarea
                value={emails}
                onChange={e => { setEmails(e.target.value); setPreview(null); }}
                rows={5}
                placeholder={'hocvien1@gmail.com\nhocvien2@gmail.com'}
                className="w-full px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y"
              />
              <p className="text-xs text-on-muted mt-1">
                Tối đa 50 email mỗi lần. Học viên được cấp sẽ vào học được ngay mà không cần thanh toán.
              </p>
            </div>

            {/* Bảng xác nhận */}
            {preview && (
              <div className="border border-outline/40 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-surface-low text-xs font-semibold text-on-muted">
                  Kiểm tra {preview.length} email — {okCount} sẽ được cấp quyền
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-outline/20">
                  {preview.map((row, i) => {
                    const meta = STATUS_META[row.status] || STATUS_META.not_found;
                    return (
                      <div key={`${row.email}-${i}`} className="flex items-center gap-3 px-3 py-2">
                        <Avatar row={row} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{row.full_name || '—'}</p>
                          <p className="text-xs text-on-muted truncate">{row.email}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="border border-outline/40 rounded-xl overflow-hidden">
            {granted.length === 0 ? (
              <p className="px-3 py-8 text-sm text-on-muted text-center">
                Chưa cấp quyền cho học viên nào.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-outline/20">
                {granted.map(row => (
                  <div key={row.student_id} className="flex items-center gap-3 px-3 py-2">
                    <Avatar row={row} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{row.full_name || '—'}</p>
                      <p className="text-xs text-on-muted truncate">{row.email}</p>
                    </div>
                    <span className="text-xs text-on-muted shrink-0 hidden sm:block">
                      {row.granted_at ? new Date(row.granted_at).toLocaleDateString('vi') : ''}
                    </span>
                    <button
                      onClick={() => handleRevoke(row)}
                      title="Thu hồi quyền"
                      className="p-1.5 rounded-lg text-on-muted hover:text-error hover:bg-red-50 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
