import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import DataTable from '../../components/ui/DataTable';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { JLPT_LEVELS } from '../../lib/mockExamConstants';
import { adminListExams, adminCreateExam, adminDeleteExam, adminPublishExam, adminUpdateExam } from '../../lib/mockExamApi';

export default function AdminMockExams() {
  const navigate = useNavigate();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ level: 'N5', title: '', use_blueprint: true });
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = () => {
    setLoading(true);
    adminListExams({ level: levelFilter || undefined, limit: 100 })
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [levelFilter]);

  const handleCreate = async () => {
    if (!form.title.trim()) { setError('Vui lòng nhập tên đề thi.'); return; }
    setCreating(true); setError('');
    try {
      const exam = await adminCreateExam(form);
      navigate(`/admin/mock-exams/${exam.id}`);
    } catch (e) { setError(e.message); setCreating(false); }
  };

  const handlePublish = async (row) => {
    setError('');
    try {
      await adminPublishExam(row.id, !row.is_published);
      load();
    } catch (e) {
      setError(e.data?.details ? `${e.message} ${e.data.details.slice(0, 3).join(' · ')}${e.data.details.length > 3 ? '…' : ''}` : e.message);
    }
  };

  const handleDelete = async () => {
    try { await adminDeleteExam(toDelete.id); setToDelete(null); load(); }
    catch (e) { setError(e.message); setToDelete(null); }
  };

  // Đổi cờ miễn phí/premium của đề (được phép cả khi đã publish)
  const handleToggleFree = async (row) => {
    setError('');
    try { await adminUpdateExam(row.id, { is_free: !row.is_free }); load(); }
    catch (e) { setError(e.message); }
  };

  const columns = [
    { key: 'level', label: 'Cấp', render: (v) => <span className="inline-flex px-2 py-0.5 rounded-md bg-sumire-purple/10 text-sumire-purple font-bold text-xs">{v}</span> },
    { key: 'title', label: 'Tên đề' },
    { key: 'question_count', label: 'Số câu', render: (v) => v ?? 0 },
    { key: 'attempt_count', label: 'Lượt làm', render: (v) => v ?? 0 },
    { key: 'is_published', label: 'Trạng thái', render: (v) => v
      ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Đã xuất bản</span>
      : <span className="inline-flex items-center gap-1 text-on-muted text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-outline" />Bản nháp</span> },
    { key: 'is_free', label: 'Quyền truy cập', render: (v, row) => (
      <button onClick={() => handleToggleFree(row)} title="Bấm để đổi Miễn phí ↔ Premium"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${v
          ? 'bg-green-50 text-green-700 hover:bg-green-100'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
        <span className="material-symbols-outlined text-sm">{v ? 'lock_open' : 'workspace_premium'}</span>
        {v ? 'Miễn phí' : 'Premium'}
      </button>
    ) },
  ];

  return (
    <AdminLayout title="Thi thử JLPT">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal">Đề thi thử JLPT</h1>
            <p className="text-sm text-on-muted mt-1">Soạn đề mô phỏng kỳ thi JLPT thật theo từng cấp độ. Chỉ admin quản lý.</p>
          </div>
          <Button onClick={() => { setForm({ level: 'N5', title: '', use_blueprint: true }); setShowCreate(true); }}>
            <span className="material-symbols-outlined text-lg">add</span> Tạo đề mới
          </Button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <div className="flex items-center gap-2">
          <button onClick={() => setLevelFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${!levelFilter ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>
            Tất cả
          </button>
          {JLPT_LEVELS.map(lv => (
            <button key={lv} onClick={() => setLevelFilter(lv)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${levelFilter === lv ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>
              {lv}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          onEdit={(row) => navigate(`/admin/mock-exams/${row.id}`)}
          onDelete={(row) => setToDelete(row)}
          actions={(row) => (
            <button onClick={() => handlePublish(row)} title={row.is_published ? 'Gỡ xuất bản' : 'Xuất bản'}
              className="p-1.5 text-on-muted hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-lg">{row.is_published ? 'visibility_off' : 'publish'}</span>
            </button>
          )}
        />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo đề thi thử JLPT"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Hủy</Button>
          <Button onClick={handleCreate} loading={creating}>Tạo đề</Button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1.5">Cấp độ JLPT</label>
            <div className="flex gap-2">
              {JLPT_LEVELS.map(lv => (
                <button key={lv} onClick={() => setForm(f => ({ ...f, level: lv }))}
                  className={`flex-1 py-2.5 rounded-xl font-bold transition-colors ${form.level === lv ? 'bg-sumire-purple text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>
                  {lv}
                </button>
              ))}
            </div>
          </div>
          <Input label="Tên đề thi" placeholder={`VD: Đề thi thử ${form.level} số 1`}
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <label className="flex items-start gap-3 p-3 bg-surface-low rounded-xl cursor-pointer">
            <input type="checkbox" checked={form.use_blueprint} className="mt-0.5"
              onChange={e => setForm(f => ({ ...f, use_blueprint: e.target.checked }))} />
            <span className="text-sm">
              <span className="font-semibold text-charcoal">Tạo khung đề chuẩn {form.level}</span>
              <span className="block text-on-muted mt-0.5">Tự động tạo các phần thi + mondai đúng format thật (chỉ cần đổ câu hỏi vào).</span>
            </span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog open={!!toDelete} onCancel={() => setToDelete(null)} onConfirm={handleDelete}
        title="Xóa đề thi?" message={`Xóa vĩnh viễn đề "${toDelete?.title}" cùng toàn bộ phần thi và câu hỏi. Không thể hoàn tác.`}
        confirmLabel="Xóa" />
    </AdminLayout>
  );
}
