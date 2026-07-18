import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import DataTable from '../../components/ui/DataTable';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { JLPT_LEVELS, mondaiJa, mondaiVi } from '../../lib/mockExamConstants';
import {
  adminListExams, adminCreateExam, adminDeleteExam, adminPublishExam, adminUpdateExam,
  adminExamImportTemplate, adminExamImportFile, adminExamImportCommit,
} from '../../lib/mockExamApi';

export default function AdminMockExams() {
  const navigate = useNavigate();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ level: 'N5', title: '' });
  const [creating, setCreating] = useState(false);
  // Chế độ tạo đề: khung trống hoặc từ file Excel nguyên đề
  const [createMode, setCreateMode] = useState('blank'); // 'blank' | 'excel'
  const [excelFile, setExcelFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  // Popup xác nhận đổi trạng thái: { type: 'publish' | 'free', row }
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [notice, setNotice] = useState('');

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

  // ── Tạo đề từ file Excel nguyên đề ──
  const resetExcel = () => { setExcelFile(null); setExcelPreview(null); };

  const downloadExamTemplate = async () => {
    setError('');
    try {
      const blob = await adminExamImportTemplate(form.level);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jlpt-mock-exam-${form.level}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Không thể tải file mẫu.'); }
  };

  const parseExcel = async () => {
    if (!excelFile) return;
    setParsing(true); setError('');
    try {
      const r = await adminExamImportFile(form.level, excelFile);
      setExcelPreview(r);
    } catch (e) { setError(e.message); }
    finally { setParsing(false); }
  };

  const handleCreateFromExcel = async () => {
    if (!form.title.trim()) { setError('Vui lòng nhập tên đề thi.'); return; }
    setCreating(true); setError('');
    try {
      const mondais = (excelPreview.mondais || []).map(m => ({
        section_position: m.section_position,
        mondai_number:    m.mondai_number,
        mondai_type:      m.mondai_type,
        passage_text:     m.passage_text,
        questions:        m.questions.map(v => v.question),
      }));
      const r = await adminExamImportCommit({ level: form.level, title: form.title, mondais });
      navigate(`/admin/mock-exams/${r.exam_id}`);
    } catch (e) { setError(e.message); setCreating(false); }
  };

  const handleDelete = async () => {
    try { await adminDeleteExam(toDelete.id); setToDelete(null); load(); }
    catch (e) { setError(e.message); setToDelete(null); }
  };

  // Nội dung popup xác nhận theo hành động (publish/unpublish, free/premium)
  const confirmInfo = confirm && (confirm.type === 'publish'
    ? (confirm.row.is_published
      ? { title: 'Gỡ xuất bản đề thi?', icon: 'visibility_off', confirmLabel: 'Gỡ xuất bản', variant: 'danger',
          message: `Đề "${confirm.row.title}" sẽ ẩn khỏi danh sách của học viên. Các lượt đã làm vẫn xem được lịch sử.` }
      : { title: 'Xuất bản đề thi?', icon: 'publish', confirmLabel: 'Xuất bản', variant: 'primary',
          message: `Đề "${confirm.row.title}" sẽ hiển thị cho học viên và không thể sửa nội dung câu hỏi sau khi xuất bản.` })
    : (confirm.row.is_free
      ? { title: 'Chuyển sang Premium?', icon: 'workspace_premium', confirmLabel: 'Chuyển Premium', variant: 'primary',
          message: `Đề "${confirm.row.title}" sẽ chỉ dành cho tài khoản Premium — học viên free không bắt đầu được bài làm mới.` }
      : { title: 'Chuyển sang Miễn phí?', icon: 'lock_open', confirmLabel: 'Chuyển Miễn phí', variant: 'primary',
          message: `Mọi học viên đều làm được đề "${confirm.row.title}".` }));

  const handleConfirm = async () => {
    const { type, row } = confirm;
    setError(''); setNotice(''); setConfirmBusy(true);
    try {
      if (type === 'publish') {
        const r = await adminPublishExam(row.id, !row.is_published);
        // Publish trả warnings[] (lệch số câu chuẩn); unpublish trả warning (số lượt đã làm)
        if (r?.warnings?.length) setNotice(`Đã xuất bản, nhưng số câu lệch chuẩn JLPT: ${r.warnings.join(' · ')}`);
        else if (r?.warning) setNotice(r.warning);
      } else {
        await adminUpdateExam(row.id, { is_free: !row.is_free });
      }
      load();
    } catch (e) {
      setError(e.data?.details ? `${e.message} ${e.data.details.slice(0, 3).join(' · ')}${e.data.details.length > 3 ? '…' : ''}` : e.message);
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
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
      <button onClick={() => setConfirm({ type: 'free', row })} title="Bấm để đổi Miễn phí ↔ Premium"
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
          <Button onClick={() => { setForm({ level: 'N5', title: '' }); setCreateMode('blank'); resetExcel(); setShowCreate(true); }}>
            <span className="material-symbols-outlined text-lg">add</span> Tạo đề mới
          </Button>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert type="warning" onClose={() => setNotice('')}>{notice}</Alert>}

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
            <button onClick={() => setConfirm({ type: 'publish', row })} title={row.is_published ? 'Gỡ xuất bản' : 'Xuất bản'}
              className="p-1.5 text-on-muted hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-lg">{row.is_published ? 'visibility_off' : 'publish'}</span>
            </button>
          )}
        />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo đề thi thử JLPT"
        size={createMode === 'excel' && excelPreview ? 'xl' : undefined}
        footer={createMode === 'blank' ? <>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Hủy</Button>
          <Button onClick={handleCreate} loading={creating}>Tạo đề</Button>
        </> : excelPreview ? <>
          <Button variant="secondary" onClick={resetExcel}>Chọn file khác</Button>
          <Button onClick={handleCreateFromExcel} loading={creating}
            disabled={!(excelPreview.total_questions > 0)}>
            Tạo đề nháp ({excelPreview.total_questions ?? 0} câu)
          </Button>
        </> : <>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Hủy</Button>
          <Button onClick={parseExcel} loading={parsing} disabled={!excelFile}>Đọc file</Button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1.5">Cấp độ JLPT</label>
            <div className="flex gap-2">
              {JLPT_LEVELS.map(lv => (
                <button key={lv} onClick={() => { setForm(f => ({ ...f, level: lv })); resetExcel(); }}
                  className={`flex-1 py-2.5 rounded-xl font-bold transition-colors ${form.level === lv ? 'bg-sumire-purple text-white' : 'bg-surface-low text-on-muted hover:bg-outline/30'}`}>
                  {lv}
                </button>
              ))}
            </div>
          </div>
          <Input label="Tên đề thi" placeholder={`VD: Đề thi thử ${form.level} số 1`}
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          {/* Chọn cách tạo: khung trống hay từ file Excel nguyên đề */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'blank', icon: 'auto_awesome', label: 'Khung trống' },
              { key: 'excel', icon: 'upload_file', label: 'Từ file Excel' },
            ].map(m => (
              <button key={m.key} onClick={() => { setCreateMode(m.key); resetExcel(); }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors ${createMode === m.key ? 'bg-tsubaki-red/10 text-tsubaki-red border border-tsubaki-red/40' : 'bg-surface-low text-on-muted border border-transparent hover:bg-outline/30'}`}>
                <span className="material-symbols-outlined text-lg">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          {createMode === 'blank' ? (
            <div className="flex items-start gap-3 p-3 bg-surface-low rounded-xl">
              <span className="material-symbols-outlined text-sumire-purple mt-0.5">auto_awesome</span>
              <span className="text-sm">
                <span className="font-semibold text-charcoal">Tạo khung đề chuẩn {form.level}</span>
                <span className="block text-on-muted mt-0.5">Đề tự động tạo đủ các phần thi + mondai đúng format JLPT thật (chỉ cần đổ câu hỏi vào). Cấu trúc cố định, không thêm/xóa phần thi.</span>
              </span>
            </div>
          ) : !excelPreview ? (
            <div className="space-y-3">
              <Alert type="info">
                Tải file mẫu {form.level} (mỗi mondai một sheet), điền câu hỏi rồi upload — hệ thống kiểm tra và
                cho xem trước. Đề tạo ra là <b>bản nháp</b>; audio phần nghe và ảnh minh họa bổ sung sau trong trình soạn đề.
              </Alert>
              <button type="button" onClick={downloadExamTemplate}
                className="text-tsubaki-red font-semibold text-sm hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-lg">download</span> Tải file mẫu {form.level} (.xlsx)
              </button>
              <label className="block border border-dashed border-outline/60 rounded-2xl p-6 text-center cursor-pointer hover:bg-surface-low">
                <span className="material-symbols-outlined text-4xl text-on-muted block mb-1">upload_file</span>
                <span className="text-sm font-semibold text-charcoal">{excelFile ? excelFile.name : 'Chọn file .xlsx / .xls'}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => setExcelFile(e.target.files[0] || null)} />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              {(excelPreview.warnings || []).map((w, i) => <Alert key={i} type="warning">{w}</Alert>)}
              {excelPreview.errors?.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm space-y-1 max-h-48 overflow-y-auto">
                  <p className="font-semibold text-red-700">{excelPreview.errors.length} lỗi — các dòng này sẽ bị bỏ qua:</p>
                  {excelPreview.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700">Sheet "{e.sheet}"{e.row !== '-' ? ` · dòng ${e.row}` : ''}: {e.message}</p>
                  ))}
                </div>
              )}
              <div className="border border-outline/40 rounded-xl divide-y divide-outline/30 max-h-72 overflow-y-auto">
                {(excelPreview.mondais || []).map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-on-muted mr-1.5">{m.section_position}.{m.mondai_number}</span>
                      <span className="font-semibold text-charcoal">{mondaiJa(m.mondai_type)}</span>
                      <span className="text-on-muted text-xs"> · {mondaiVi(m.mondai_type)}</span>
                      {m.passage_text && <span className="material-symbols-outlined text-sm text-sumire-purple align-middle ml-1" title="Có đoạn văn">article</span>}
                    </span>
                    <span className={`shrink-0 text-xs font-semibold px-1.5 rounded ${m.questions.length ? 'bg-green-100 text-green-700' : 'bg-surface-low text-on-muted'}`}>
                      {m.questions.length} câu
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-muted">
                Tổng {excelPreview.total_questions ?? 0} câu hợp lệ. Mondai 0 câu sẽ để trống — soạn tiếp trong trình soạn đề.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!toDelete} onCancel={() => setToDelete(null)} onConfirm={handleDelete}
        title="Xóa đề thi?" message={`Xóa vĩnh viễn đề "${toDelete?.title}" cùng toàn bộ phần thi và câu hỏi. Không thể hoàn tác.`}
        confirmLabel="Xóa" />

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)} onConfirm={handleConfirm}
        loading={confirmBusy} title={confirmInfo?.title} message={confirmInfo?.message}
        icon={confirmInfo?.icon} confirmLabel={confirmInfo?.confirmLabel} variant={confirmInfo?.variant} />
    </AdminLayout>
  );
}
