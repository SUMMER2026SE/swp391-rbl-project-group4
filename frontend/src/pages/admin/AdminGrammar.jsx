import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';
import { renderMarkdown } from '../../lib/renderPreview';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const EMPTY  = { title: '', title_ja: '', course_id: '', content: '', is_published: false };

const TOOLBAR = [
  { icon: 'format_h2',            title: 'Tiêu đề',    before: '## ',  after: '' },
  { icon: 'format_h3',            title: 'Tiêu đề nhỏ',before: '### ', after: '' },
  { icon: 'format_bold',          title: 'In đậm',     before: '**',   after: '**' },
  { icon: 'format_italic',        title: 'In nghiêng', before: '*',    after: '*' },
  { icon: 'format_quote',         title: 'Trích dẫn',  before: '> ',   after: '' },
  { icon: 'format_list_bulleted', title: 'Danh sách',  before: '- ',   after: '' },
  { icon: 'horizontal_rule',      title: 'Đường kẻ',   before: '\n---\n', after: '' },
];

export default function AdminGrammar() {
  const textareaRef = useRef(null);

  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [search, setSearch]   = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const [courses, setCourses]   = useState([]);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState('edit');

  // Load courses for dropdown
  useEffect(() => {
    api.get('/admin/courses?limit=100')
      .then(r => setCourses(r.data.data || []))
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT, lesson_type: 'grammar' });
      if (search) params.set('search', search);
      const r = await api.get(`/admin/lessons?${params}`);
      let rows = r.data.data || [];
      if (levelFilter) rows = rows.filter(l => l.courses?.level === levelFilter);
      setData(rows);
      setTotal(levelFilter ? rows.length : (r.data.total || 0));
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, levelFilter]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setTab('edit'); setModal(true); };
  const openEdit   = (row) => {
    setForm({
      title: row.title || '',
      title_ja: row.title_ja || '',
      course_id: row.course_id || '',
      content: row.content || '',
      is_published: row.is_published || false,
    });
    setEditId(row.id);
    setTab('edit');
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.title) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (!form.course_id) return setAlert({ type: 'error', msg: 'Vui lòng chọn khóa học.' });
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/admin/lessons/${editId}`, { ...form, lesson_type: 'grammar' });
      } else {
        await api.post('/admin/lessons', { ...form, lesson_type: 'grammar' });
      }
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật bài ngữ pháp.' : 'Đã tạo bài ngữ pháp mới.' });
      setModal(false);
      fetchData();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Xóa bài "${row.title}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await api.delete(`/admin/lessons/${row.id}`);
      setAlert({ type: 'success', msg: 'Đã xóa bài ngữ pháp.' });
      fetchData();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    }
  };

  const insertAtCursor = (before, after = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const selected = form.content.slice(start, end);
    const newText = form.content.slice(0, start) + before + selected + after + form.content.slice(end);
    setForm(f => ({ ...f, content: newText }));
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd   = start + before.length + selected.length;
    }, 0);
  };

  const COLS = [
    {
      key: 'title',
      label: 'Tiêu đề',
      render: (v, row) => (
        <div>
          <p className="font-semibold text-on-surface">{v}</p>
          {row.title_ja && <p className="text-xs text-on-muted">{row.title_ja}</p>}
        </div>
      ),
    },
    {
      key: 'courses',
      label: 'Khóa học / Level',
      render: (v) => (
        <div className="flex items-center gap-2">
          {v?.level && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{v.level}</span>
          )}
          <span className="text-sm text-on-muted truncate max-w-[160px]">{v?.title || '—'}</span>
        </div>
      ),
    },
    {
      key: 'is_published',
      label: 'Trạng thái',
      render: (v) => v
        ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Đã xuất bản</span>
        : <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted font-semibold">Bản nháp</span>,
    },
    {
      key: 'content',
      label: 'Nội dung',
      render: (v) => v
        ? <span className="text-xs text-on-muted">{v.length} ký tự</span>
        : <span className="text-xs text-on-muted italic">Chưa có</span>,
    },
  ];

  return (
    <AdminLayout title="Quản lý Ngữ pháp">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">
          {alert.msg}
        </Alert>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-2xl font-bold">
          Ngữ pháp <span className="text-on-muted text-lg font-normal">({total})</span>
        </h1>
        <div className="flex gap-2 flex-wrap">
          <select
            value={levelFilter}
            onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-outline rounded-xl text-sm outline-none"
          >
            <option value="">Tất cả level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetchData(); }} className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
              className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-36"
            />
            <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl">
              <span className="material-symbols-outlined text-lg">search</span>
            </button>
          </form>
          <Button onClick={openCreate}>
            <span className="material-symbols-outlined text-lg">add</span> Tạo bài mới
          </Button>
        </div>
      </div>

      <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete} />

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total / LIMIT)}</span>
          <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      {/* ── Create / Edit modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Chỉnh sửa bài ngữ pháp' : 'Tạo bài ngữ pháp mới'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button>
            <Button loading={saving} onClick={handleSave}>Lưu</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Title */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tiêu đề *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ví dụ: Cấu trúc 〜てください"
            />
            <Input
              label="Tiêu đề tiếng Nhật"
              value={form.title_ja}
              onChange={e => setForm(f => ({ ...f, title_ja: e.target.value }))}
              placeholder="〜てください"
            />
          </div>

          {/* Course */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Khóa học *</label>
            <select
              value={form.course_id}
              onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.level ? `[${c.level}] ` : ''}{c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Published */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
              className="w-4 h-4 rounded accent-tsubaki-red"
            />
            <span className="text-sm font-medium text-on-surface">Xuất bản (hiển thị cho học sinh)</span>
          </label>

          {/* Content editor */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Nội dung ngữ pháp</label>
            <div className="border border-outline rounded-xl overflow-hidden">
              {/* Tabs */}
              <div className="flex items-center justify-between border-b border-outline/20 px-3 py-1.5 bg-surface-stone/30">
                <div className="flex gap-1">
                  {[{ id: 'edit', label: 'Soạn thảo' }, { id: 'preview', label: 'Xem trước' }].map(t => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors
                        ${tab === t.id ? 'bg-tsubaki-red/10 text-tsubaki-red' : 'text-on-muted hover:bg-surface-container-low'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {tab === 'edit' && (
                  <div className="flex gap-0.5">
                    {TOOLBAR.map(btn => (
                      <button key={btn.icon} type="button" onClick={() => insertAtCursor(btn.before, btn.after)}
                        title={btn.title}
                        className="p-1 text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 rounded transition-colors">
                        <span className="material-symbols-outlined text-[16px]">{btn.icon}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {tab === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={'## Cấu trúc\n\nV + てください\n\n---\n\n## Cách dùng\n\n...\n\n## Ví dụ\n\n> 窓を開けてください。'}
                  className="w-full p-4 text-sm font-mono outline-none resize-none leading-relaxed"
                  style={{ minHeight: '220px' }}
                />
              ) : (
                <div className="p-4 min-h-[220px] text-sm leading-relaxed text-on-surface overflow-y-auto">
                  {form.content ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: `<p class="mb-3">${renderMarkdown(form.content)}</p>` }}
                    />
                  ) : (
                    <p className="text-on-muted italic text-center pt-8">Chưa có nội dung</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
