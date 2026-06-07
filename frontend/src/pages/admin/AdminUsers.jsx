import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

export default function AdminUsers() {
  const { t } = useLang();
  const [data, setData]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [alert, setAlert]   = useState({ type: '', msg: '' });
  const [editModal, setEditModal] = useState(false);
  const [editRow, setEditRow]     = useState(null);
  const [editForm, setEditForm]   = useState({ full_name: '', phone: '', role: 'student' });
  const [saving, setSaving] = useState(false);
  const [pwModal, setPwModal]   = useState(false);
  const [pwTarget, setPwTarget] = useState(null);
  const [pwForm, setPwForm]     = useState({ password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const LIMIT = 20;

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      const r = await api.get(`/admin/users?${params}`);
      setData(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [page]);

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({ full_name: row.full_name || '', phone: row.phone || '', role: row.role || 'student' });
    setEditModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${editRow.id}`, editForm);
      setAlert({ type: 'success', msg: 'Đã cập nhật.' });
      setEditModal(false);
      fetch();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const openPwModal = (row) => {
    setPwTarget(row);
    setPwForm({ password: '', confirm: '' });
    setPwModal(true);
  };

  const handleResetPassword = async () => {
    if (pwForm.password.length < 8)
      return setAlert({ type: 'error', msg: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    if (pwForm.password !== pwForm.confirm)
      return setAlert({ type: 'error', msg: 'Mật khẩu xác nhận không khớp.' });
    setPwSaving(true);
    try {
      await api.put(`/admin/users/${pwTarget.id}/password`, { password: pwForm.password });
      setAlert({ type: 'success', msg: `Đã đặt lại mật khẩu cho ${pwTarget.full_name || pwTarget.email}.` });
      setPwModal(false);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setPwSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try {
      await api.delete(`/admin/users/${row.id}`);
      setAlert({ type: 'success', msg: 'Đã xóa.' });
      fetch();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  const COLUMNS = [
    { key: 'full_name',  label: 'Họ tên' },
    { key: 'email',      label: 'Email' },
    { key: 'phone',      label: 'SĐT' },
    {
      key: 'role', label: 'Vai trò',
      render: v => {
        const styles = {
          admin:   'bg-sumire-purple text-white',
          teacher: 'bg-tsubaki-red text-white',
          student: 'bg-surface-low text-on-muted',
        };
        const labels = { admin: 'Admin', teacher: 'Giáo viên', student: 'Học viên' };
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${styles[v] || styles.student}`}>
            {labels[v] || 'Học viên'}
          </span>
        );
      },
    },
    { key: 'created_at', label: 'Ngày tạo', render: v => v ? new Date(v).toLocaleDateString('vi') : '—' },
  ];

  return (
    <AdminLayout title={t('admin.users')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.users')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <form onSubmit={e => { e.preventDefault(); setPage(1); fetch(); }} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl"><span className="material-symbols-outlined text-lg">search</span></button>
        </form>
      </div>

      <DataTable
        columns={COLUMNS} data={data} loading={loading}
        onEdit={openEdit} onDelete={handleDelete}
        actions={row => (
          <button onClick={() => openPwModal(row)} title="Đặt lại mật khẩu"
            className="p-1.5 text-on-muted hover:text-sumire-purple hover:bg-sumire-purple/10 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-lg">lock_reset</span>
          </button>
        )}
      />

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page} / {Math.ceil(total / LIMIT)}</span>
          <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      <Modal open={pwModal} onClose={() => setPwModal(false)}
        title={`Đặt lại mật khẩu — ${pwTarget?.full_name || pwTarget?.email || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwModal(false)}>Huỷ</Button>
            <Button loading={pwSaving} onClick={handleResetPassword}>Đặt lại mật khẩu</Button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-on-muted">
            Nhập mật khẩu mới cho tài khoản <strong>{pwTarget?.email}</strong>.
            Người dùng có thể đăng nhập ngay bằng mật khẩu này.
          </p>
          <Input label="Mật khẩu mới" type="password" value={pwForm.password}
            onChange={e => setPwForm({ ...pwForm, password: e.target.value })}
            placeholder="Tối thiểu 8 ký tự" />
          <Input label="Xác nhận mật khẩu" type="password" value={pwForm.confirm}
            onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
            placeholder="Nhập lại mật khẩu mới" />
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Chỉnh sửa người dùng"
        footer={<><Button variant="secondary" onClick={() => setEditModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <Input label="Họ tên" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
          <Input label="SĐT" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Vai trò</label>
            <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
              <option value="student">Student</option>
              <option value="teacher">Teacher (Giáo viên)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
