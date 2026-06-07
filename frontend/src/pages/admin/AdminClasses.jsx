import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5:'bg-emerald-100 text-emerald-700', N4:'bg-sky-100 text-sky-700',
  N3:'bg-violet-100 text-violet-700',   N2:'bg-orange-100 text-orange-700',
  N1:'bg-red-100 text-red-700',
};

export default function AdminClasses() {
  const [classes, setClasses]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [detail, setDetail]     = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const LIMIT = 20;

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s) params.set('search', s);
      const r = await api.get(`/classes/admin?${params}`);
      setClasses(r.data.data || []); setTotal(r.data.total || 0);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page]);

  const openDetail = async (cls) => {
    setDetail({ ...cls, _loading: true });
    setLoadingDetail(true);
    try {
      const r = await api.get(`/classes/admin/${cls.id}`);
      setDetail(r.data);
    } catch(e) { setDetail(null); }
    finally { setLoadingDetail(false); }
  };

  return (
    <AdminLayout title="Lớp học">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Lớp học</h1>
        <span className="text-sm text-on-muted">{total} lớp</span>
      </div>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); setPage(1); load(1, search); }} className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên lớp..."
          className="flex-1 px-4 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"/>
        <button type="submit" className="px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-semibold">Tìm</button>
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low border-b border-outline/40">
              <tr>{['Tên lớp','Giáo viên','Học viên','Mã tham gia','Trạng thái',''].map(h =>
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-on-muted uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:6}).map((_,i) => (
                <tr key={i} className="border-t border-outline/40 animate-pulse">
                  {[160,120,60,100,80,60].map((w,j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-surface-low rounded" style={{width:w}}/></td>)}
                </tr>
              )) : classes.map((cls,i) => (
                <tr key={cls.id} className={`border-t border-outline/40 hover:bg-surface-low/50 transition-colors ${i%2===1?'bg-surface-low/30':''}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{cls.name}</p>
                    {cls.description && <p className="text-xs text-on-muted truncate max-w-[180px]">{cls.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{cls.teacher?.full_name || '—'}</p>
                    <p className="text-xs text-on-muted">{cls.teacher?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold">{cls.student_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono bg-surface-low px-2 py-0.5 rounded text-sm font-bold tracking-widest text-tsubaki-red">{cls.enrollment_key}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cls.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-low text-on-muted'}`}>
                      {cls.is_active ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(cls)}
                      className="px-3 py-1.5 rounded-lg border border-outline text-xs text-on-muted hover:text-tsubaki-red hover:border-tsubaki-red transition-colors font-semibold">
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && classes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-on-muted">Không có lớp học nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
          <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || 'Chi tiết lớp'}
        footer={<Button variant="secondary" onClick={() => setDetail(null)}>Đóng</Button>}>
        {loadingDetail ? (
          <div className="py-8 text-center animate-pulse text-on-muted">Đang tải...</div>
        ) : detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-surface-low rounded-xl">
                <p className="text-xs text-on-muted mb-1">Giáo viên</p>
                <p className="font-semibold">{detail.teacher?.full_name || '—'}</p>
                <p className="text-xs text-on-muted">{detail.teacher?.email}</p>
              </div>
              <div className="p-3 bg-surface-low rounded-xl">
                <p className="text-xs text-on-muted mb-1">Mã tham gia</p>
                <code className="font-mono font-bold text-lg tracking-widest text-tsubaki-red">{detail.enrollment_key}</code>
              </div>
              <div className="p-3 bg-surface-low rounded-xl">
                <p className="text-xs text-on-muted mb-1">Tổng học viên</p>
                <p className="font-bold text-xl">{(detail.enrollments || []).length}</p>
              </div>
              <div className="p-3 bg-surface-low rounded-xl">
                <p className="text-xs text-on-muted mb-1">Trạng thái</p>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${detail.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-low text-on-muted'}`}>
                  {detail.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                </span>
              </div>
            </div>

            {detail.description && (
              <div className="p-3 bg-surface-low rounded-xl text-sm">
                <p className="text-xs text-on-muted mb-1">Mô tả</p>
                <p>{detail.description}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-sm mb-2">Danh sách học viên ({(detail.enrollments||[]).length})</h3>
              {(detail.enrollments || []).length === 0 ? (
                <p className="text-on-muted text-sm text-center py-4">Chưa có học viên</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {(detail.enrollments || []).map(e => (
                    <div key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-low/50">
                      <div>
                        <p className="font-medium text-sm">{e.student?.full_name || '—'}</p>
                        <p className="text-xs text-on-muted">{e.student?.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-low text-on-muted'}`}>
                        {e.status === 'active' ? 'Đang học' : 'Vô hiệu'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
