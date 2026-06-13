import { useEffect, useState } from 'react';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

const EMPTY_FORM = { name: '', description: '' };

function ClassCard({ cls, onManage, onEdit, onDelete }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 hover:shadow-xl transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg truncate">{cls.name}</h3>
          {cls.description && <p className="text-sm text-on-muted line-clamp-2 mt-0.5">{cls.description}</p>}
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${cls.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-low text-on-muted'}`}>
          {cls.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-on-muted">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">group</span>
          {cls.student_count} học viên
        </span>
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">key</span>
          <code className="font-mono bg-surface-low px-2 py-0.5 rounded-lg font-bold tracking-widest text-tsubaki-red">{cls.enrollment_key}</code>
        </span>
      </div>

      <div className="flex gap-2 pt-1 border-t border-outline/30">
        <Button onClick={() => onManage(cls)} className="flex-1 text-sm">
          <span className="material-symbols-outlined text-base">manage_accounts</span> Quản lý học viên
        </Button>
        <button onClick={() => onEdit(cls)} className="p-2.5 rounded-xl border border-outline text-on-muted hover:text-tsubaki-red hover:border-tsubaki-red transition-colors">
          <span className="material-symbols-outlined text-lg">edit</span>
        </button>
        <button onClick={() => onDelete(cls.id)} className="p-2.5 rounded-xl border border-outline text-on-muted hover:text-red-500 hover:border-red-300 transition-colors">
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    </div>
  );
}
/* ─── Delete Class Confirm Modal (UC34) ──────────────────────────────────── */
function DeleteClassModal({ cls, open, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true); setError('');
    try {
      await api.delete(`/classes/teacher/${cls.id}`);
      onDeleted(`Đã xóa lớp "${cls.name}".`);
      onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
      <Modal open={open} onClose={onClose} title="Xác nhận xóa lớp"
             footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
               <Button loading={loading} onClick={handleDelete}
                       className="bg-red-500 hover:bg-red-600 text-white">Xóa lớp</Button></>}>
        <div className="text-center py-2 space-y-3">
          <span className="material-symbols-outlined text-5xl text-red-400 block">delete_forever</span>
          <p className="font-semibold">Xóa lớp <strong>"{cls?.name}"</strong>?</p>
          <p className="text-sm text-on-muted">Toàn bộ học viên sẽ bị xóa khỏi lớp. Hành động này không thể hoàn tác.</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </Modal>
  );
}
function StudentsModal({ cls, open, onClose }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState({ type:'', msg:'' });
  const [toggling, setToggling] = useState(null);

  const load = async () => {
    if (!cls) return;
    setLoading(true);
    try {
      const r = await api.get(`/classes/teacher/${cls.id}/students`);
      setStudents(r.data || []);
    } catch(e) { setAlert({ type:'error', msg:'Không thể tải danh sách.' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open && cls) load(); }, [open, cls]);

  const toggleStatus = async (enrollment) => {
    const newStatus = enrollment.status === 'active' ? 'inactive' : 'active';
    setToggling(enrollment.id);
    try {
      await api.put(`/classes/teacher/enrollments/${enrollment.id}`, { status: newStatus });
      load();
    } catch(e) { setAlert({ type:'error', msg:e.message }); }
    finally { setToggling(null); }
  };
  // UC36: Xóa học viên khỏi lớp
  const removeStudent = async (enrollment) => {
    setRemoving(enrollment.id);
    try {
      await api.delete(`/classes/teacher/enrollments/${enrollment.id}`);
      setAlert({ type: 'success', msg: `Đã xóa ${enrollment.student?.full_name || 'học viên'} khỏi lớp.` });
      setConfirm(null);
      load();
    } catch (e) { setAlert({ type: 'error', msg: e.response?.data?.error || e.message }); }
    finally { setRemoving(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Học viên — ${cls?.name || ''}`}
      footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({type:'',msg:''})} className="mb-3">{alert.msg}</Alert>}
      {/* Confirm xóa học viên inline */}
      {confirmRemove && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-700 mb-2">
              Xóa <strong>{confirmRemove.student?.full_name || confirmRemove.student?.email}</strong> khỏi lớp?
            </p>
            <div className="flex gap-2">
              <Button onClick={() => removeStudent(confirmRemove)} loading={removing === confirmRemove.id}
                      className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5">Xóa</Button>
              <Button variant="secondary" onClick={() => setConfirm(null)} className="text-xs px-3 py-1.5">Huỷ</Button>
            </div>
          </div>
      )}
      {loading ? (
        <div className="py-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : students.length === 0 ? (
        <div className="py-10 text-center">
          <span className="material-symbols-outlined text-4xl text-on-muted/20 block mb-2">group_off</span>
          <p className="text-on-muted text-sm">Chưa có học viên nào tham gia lớp này.</p>
          <p className="text-xs text-on-muted mt-1">Chia sẻ mã lớp <code className="font-mono bg-surface-low px-1.5 py-0.5 rounded font-bold text-tsubaki-red">{cls?.enrollment_key}</code> cho học viên.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map(e => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-low/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-tsubaki-red/10 flex items-center justify-center text-tsubaki-red font-bold text-sm shrink-0">
                  {(e.student?.full_name?.[0] || e.student?.email?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{e.student?.full_name || '—'}</p>
                  <p className="text-xs text-on-muted">{e.student?.email}</p>
                </div>
              </div>
              <button onClick={() => toggleStatus(e)} disabled={toggling === e.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
                  e.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600'
                    : 'bg-surface-low text-on-muted hover:bg-emerald-100 hover:text-emerald-700'
                }`}>
                {e.status === 'active' ? 'Đang học' : 'Vô hiệu'}
              </button>
              {/* UC36 */}
              <button onClick={() => setConfirm(e)} title="Xóa khỏi lớp"
                      className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                <span className="material-symbols-outlined text-base">person_remove</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function TeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type:'', msg:'' });
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [managed, setManaged] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/classes/teacher'); setClasses(r.data || []); }
    catch(e) { setAlert({ type:'error', msg:'Không thể tải lớp học.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true); };
  const openEdit = (cls) => { setForm({ name: cls.name, description: cls.description || '' }); setEditId(cls.id); setModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return setAlert({ type:'error', msg:'Tên lớp là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/classes/teacher/${editId}`, form);
      else        await api.post('/classes/teacher', form);
      setAlert({ type:'success', msg:'Đã lưu.' }); setModal(false); load();
    } catch(e) { setAlert({ type:'error', msg:e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa lớp này? Toàn bộ học viên sẽ bị xóa khỏi lớp.')) return;
    try { await api.delete(`/classes/teacher/${id}`); load(); }
    catch(e) { setAlert({ type:'error', msg:e.message }); }
  };

  return (
    <TeacherLayout title="Lớp học">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Lớp học</h1>
        {/* UC33 */}
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-lg">add</span> Tạo lớp
        </Button>
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Tạo lớp</Button>
      </div>

      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({type:'',msg:''})} className="mb-4">{alert.msg}</Alert>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({length:3}).map((_,i) => <div key={i} className="glass-card rounded-2xl h-48 animate-pulse bg-surface-low"/>)}
        </div>
      ) : classes.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">groups</span>
          <h2 className="font-bold text-lg mb-1">Chưa có lớp học nào</h2>
          <p className="text-on-muted text-sm mb-4">Tạo lớp học đầu tiên và chia sẻ mã tham gia cho học viên.</p>
          <Button onClick={openCreate}>Tạo lớp ngay</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <ClassCard key={cls.id} cls={cls} onManage={c => setManaged(c)} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Sửa lớp' : 'Tạo lớp mới'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <Input label="Tên lớp *" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Ví dụ: N5 — Lớp sáng thứ 2"/>
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Mô tả</label>
            <textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})} rows={3}
              placeholder="Mô tả ngắn về lớp học..."
              className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none"/>
          </div>
          <p className="text-xs text-on-muted bg-surface-low rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
            Mã tham gia sẽ được tạo tự động sau khi bạn lưu lớp học.
          </p>
        </div>
      </Modal>

      <StudentsModal cls={managed} open={!!managed} onClose={() => setManaged(null)} />
    </TeacherLayout>
  );
}
