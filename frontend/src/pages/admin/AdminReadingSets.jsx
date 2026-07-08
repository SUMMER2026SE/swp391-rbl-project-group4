import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const LEVELS  = ['N5','N4','N3','N2','N1'];
const STATUSES = [
  { value: '',          label: 'Tất cả trạng thái' },
  { value: 'draft',     label: 'Nháp' },
  { value: 'review',    label: 'Đang duyệt' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'archived',  label: 'Lưu trữ' },
];
const SOURCES = [
  { value: '',             label: 'Tất cả nguồn' },
  { value: 'manual',       label: 'Thủ công' },
  { value: 'ai_generated', label: 'AI tạo' },
  { value: 'imported',     label: 'Import' },
];

function StatusBadge({ status }) {
  const map = {
    draft:     'bg-zinc-100 text-zinc-600',
    review:    'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    archived:  'bg-red-100 text-red-600',
  };
  const labels = { draft: 'Nháp', review: 'Đang duyệt', published: 'Xuất bản', archived: 'Lưu trữ' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.draft}`}>
      {labels[status] || status}
    </span>
  );
}

function LevelBadge({ level }) {
  if (!level) return <span className="text-on-muted text-xs">—</span>;
  const colors = { N5: 'bg-sky-100 text-sky-700', N4: 'bg-green-100 text-green-700', N3: 'bg-yellow-100 text-yellow-700', N2: 'bg-orange-100 text-orange-700', N1: 'bg-red-100 text-red-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${colors[level] || 'bg-zinc-100 text-zinc-600'}`}>{level}</span>;
}

function SourceBadge({ source }) {
  const map = { manual: ['bg-zinc-100 text-zinc-600', 'edit'], ai_generated: ['bg-purple-100 text-purple-700', 'auto_awesome'], imported: ['bg-blue-100 text-blue-700', 'upload'] };
  const labels = { manual: 'Thủ công', ai_generated: 'AI', imported: 'Import' };
  const [cls, icon] = map[source] || map.manual;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <span className="material-symbols-outlined text-xs leading-none" style={{ fontSize: 12 }}>{icon}</span>
      {labels[source] || source}
    </span>
  );
}

export default function AdminReadingSets() {
  const navigate = useNavigate();
  const [sets,    setSets]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', jlpt_level: '', source_type: '' });
  const [pending, setPending] = useState(filters);
  const [importing, setImporting] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filters.search)      params.set('search', filters.search);
      if (filters.status)      params.set('status', filters.status);
      if (filters.jlpt_level)  params.set('jlpt_level', filters.jlpt_level);
      if (filters.source_type) params.set('source_type', filters.source_type);
      const { data } = await api.get(`/admin/reading-sets?${params}`);
      setSets(data.sets || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const applyFilters = () => { setFilters(pending); setPage(1); };
  const clearFilters = () => {
    const empty = { search: '', status: '', jlpt_level: '', source_type: '' };
    setFilters(empty); setPending(empty); setPage(1);
  };

  const handleDuplicate = async (id) => {
    if (!confirm('Tạo bản sao của bài đọc này?')) return;
    try {
      const { data } = await api.post(`/admin/reading-sets/${id}/duplicate`);
      navigate(`/admin/reading-sets/${data.readingSet.id}/edit`);
    } catch (e) { alert('Lỗi: ' + e.message); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Xóa bài đọc "${title}"?\nThao tác này không thể hoàn tác.`)) return;
    try {
      await api.delete(`/admin/reading-sets/${id}`);
      load();
    } catch (e) { alert('Lỗi: ' + e.message); }
  };

  const handlePublish = async (id) => {
    try {
      await api.post(`/admin/reading-sets/${id}/publish`);
      load();
    } catch (e) {
      const errs = e.response?.data?.errors;
      alert(errs ? 'Không thể xuất bản:\n' + errs.join('\n') : e.message);
    }
  };

  const handleUnpublish = async (id) => {
    try {
      await api.post(`/admin/reading-sets/${id}/unpublish`);
      load();
    } catch (e) { alert('Lỗi: ' + e.message); }
  };

  const handleExport = async (id, title) => {
    try {
      const { data } = await api.get(`/admin/reading-sets/${id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `reading-set-${title.slice(0, 30).replace(/\s+/g, '-')}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert('Lỗi export: ' + e.message); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { data } = await api.post('/admin/reading-sets/import', json);
      navigate(`/admin/reading-sets/${data.readingSet.id}/edit`);
    } catch (err) { alert('Import thất bại: ' + err.message); }
    setImporting(false);
    e.target.value = '';
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout title="Bộ bài đọc">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Bộ bài đọc JLPT</h1>
          <p className="text-sm text-on-muted mt-0.5">{total} bộ bài đọc</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-outline text-sm font-medium hover:bg-surface-low transition-colors ${importing ? 'opacity-50' : ''}`}>
              <span className="material-symbols-outlined text-base">upload</span>
              Import JSON
            </span>
          </label>
          <button
            onClick={() => navigate('/admin/reading-sets/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-tsubaki-red text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-base">add</span>
            Tạo bài đọc mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-outline/30 rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={pending.search}
            onChange={e => setPending(p => ({ ...p, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            placeholder="Tìm theo tiêu đề..."
            className="flex-1 min-w-48 px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red"
          />
          <select value={pending.status} onChange={e => setPending(p => ({ ...p, status: e.target.value }))}
            className="px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red">
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={pending.jlpt_level} onChange={e => setPending(p => ({ ...p, jlpt_level: e.target.value }))}
            className="px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red">
            <option value="">Tất cả cấp độ</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={pending.source_type} onChange={e => setPending(p => ({ ...p, source_type: e.target.value }))}
            className="px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red">
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={applyFilters} className="px-4 py-2 bg-tsubaki-red text-white rounded-lg text-sm font-medium hover:opacity-90">
            Lọc
          </button>
          <button onClick={clearFilters} className="px-4 py-2 border border-outline rounded-lg text-sm hover:bg-surface-low">
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sets.length === 0 ? (
          <div className="text-center py-20 text-on-muted">
            <span className="material-symbols-outlined text-5xl opacity-20 block mb-3">menu_book</span>
            <p className="font-medium">Chưa có bộ bài đọc nào</p>
            <button onClick={() => navigate('/admin/reading-sets/new')}
              className="mt-4 px-5 py-2 bg-tsubaki-red text-white rounded-lg text-sm font-semibold hover:opacity-90">
              Tạo bài đọc đầu tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-outline/20 bg-surface/50">
                <tr className="text-left text-xs text-on-muted uppercase tracking-wide">
                  <th className="px-5 py-3 font-semibold">Tiêu đề</th>
                  <th className="px-4 py-3 font-semibold">Cấp</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Nguồn</th>
                  <th className="px-4 py-3 font-semibold text-center">Đoạn</th>
                  <th className="px-4 py-3 font-semibold text-center">Câu hỏi</th>
                  <th className="px-4 py-3 font-semibold">Cập nhật</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/10">
                {sets.map(s => (
                  <tr key={s.id} className="hover:bg-surface-low/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-charcoal line-clamp-1">{s.title}</div>
                      {s.topic && <div className="text-xs text-on-muted mt-0.5">{s.topic}</div>}
                    </td>
                    <td className="px-4 py-4"><LevelBadge level={s.jlpt_level} /></td>
                    <td className="px-4 py-4"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-4"><SourceBadge source={s.source_type} /></td>
                    <td className="px-4 py-4 text-center tabular-nums">{s.passage_count}</td>
                    <td className="px-4 py-4 text-center tabular-nums">{s.question_count}</td>
                    <td className="px-4 py-4 text-on-muted tabular-nums text-xs">
                      {new Date(s.updated_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/reading-sets/${s.id}/edit`)}
                          title="Chỉnh sửa"
                          className="p-1.5 rounded-lg hover:bg-surface-low text-on-muted hover:text-tsubaki-red transition-colors">
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => window.open(`/reading/${s.id}`, '_blank')}
                          title="Xem trước (giao diện học sinh)"
                          className="p-1.5 rounded-lg hover:bg-surface-low text-on-muted hover:text-blue-600 transition-colors">
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>
                        {s.status === 'published' ? (
                          <button onClick={() => handleUnpublish(s.id)} title="Hủy xuất bản"
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
                            <span className="material-symbols-outlined text-base">unpublished</span>
                          </button>
                        ) : (
                          <button onClick={() => handlePublish(s.id)} title="Xuất bản"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                            <span className="material-symbols-outlined text-base">publish</span>
                          </button>
                        )}
                        <button onClick={() => handleDuplicate(s.id)} title="Nhân đôi"
                          className="p-1.5 rounded-lg hover:bg-surface-low text-on-muted hover:text-purple-600 transition-colors">
                          <span className="material-symbols-outlined text-base">content_copy</span>
                        </button>
                        <button onClick={() => handleExport(s.id, s.title)} title="Export JSON"
                          className="p-1.5 rounded-lg hover:bg-surface-low text-on-muted hover:text-blue-600 transition-colors">
                          <span className="material-symbols-outlined text-base">download</span>
                        </button>
                        <button onClick={() => handleDelete(s.id, s.title)} title="Xóa"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-on-muted hover:text-red-600 transition-colors">
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-outline text-sm disabled:opacity-40 hover:bg-surface-low">
            ← Trước
          </button>
          <span className="px-4 py-1.5 text-sm text-on-muted">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 rounded-lg border border-outline text-sm disabled:opacity-40 hover:bg-surface-low">
            Tiếp →
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
