import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

// ── Tier badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier, daysLeft }) {
  if (tier === 'premium') {
    const urgent = daysLeft !== null && daysLeft <= 5;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
        ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
        <span className="material-symbols-outlined text-sm">workspace_premium</span>
        Premium
        {daysLeft !== null && (
          <span className={`ml-0.5 font-semibold ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
            · {daysLeft}n
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <span className="material-symbols-outlined text-sm">person</span>
      Miễn phí
    </span>
  );
}

// ── Grant modal ───────────────────────────────────────────────────────────────

function GrantModal({ user, onClose, onSuccess }) {
  const [days, setDays]       = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/subscriptions/grant', { user_id: user.id, duration_days: days });
      onSuccess(user.id);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const isPremium = user.tier === 'premium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold mb-1">
          {isPremium ? 'Gia hạn Premium' : 'Cấp Premium'}
        </h3>
        <p className="text-sm text-on-muted mb-5 truncate">
          {user.full_name || user.email}
          {isPremium && user.current_period_end && (
            <span className="ml-2 text-amber-600">
              · Hết hạn {new Date(user.current_period_end).toLocaleDateString('vi-VN')}
            </span>
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold mb-2">
            {isPremium ? 'Gia hạn thêm (ngày)' : 'Thời hạn (ngày)'}
          </label>
          <div className="flex gap-2 mb-5">
            {[7, 30, 90, 365].map(d => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors
                  ${days === d ? 'bg-amber-400 text-white border-amber-400' : 'border-outline hover:bg-surface-low'}`}>
                {d}n
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-5">
            <input
              type="number" min="1" max="3650" value={days}
              onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 px-3 py-2 border border-outline rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <span className="text-sm text-on-muted">ngày</span>
            {isPremium && user.current_period_end && (
              <span className="text-xs text-on-muted ml-auto">
                → {new Date(
                    Math.max(new Date(user.current_period_end).getTime(), Date.now()) + days * 86_400_000
                  ).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low transition-colors">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-60">
              {loading
                ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : isPremium ? 'Gia hạn' : 'Cấp Premium'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSubscriptions() {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [tier,    setTier]    = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);   // user to grant/extend
  const [toast,    setToast]    = useState('');
  const searchRef = useRef(null);
  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page, limit: LIMIT, ...(search ? { search } : {}), ...(tier ? { tier } : {}) });
    api.get(`/admin/subscriptions/users?${q}`)
      .then(r => { setUsers(r.data.users || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, tier]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  const searchTimeout = useRef(null);
  const handleSearchChange = (val) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  };

  const handleGrantSuccess = (userId) => {
    setSelected(null);
    showToast('Đã cấp Premium thành công!');
    // Optimistically update tier in list
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, tier: 'premium' }
        : u
    ));
    // Reload to get accurate expiry
    setTimeout(load, 500);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const pages = Math.ceil(total / LIMIT);

  const premiumCount = users.filter(u => u.tier === 'premium').length;

  return (
    <AdminLayout title="Quản lý đăng ký">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Quản lý đăng ký</h1>
            <p className="text-sm text-on-muted mt-0.5">
              {total} tài khoản
              {premiumCount > 0 && <span className="ml-2 text-amber-600 font-semibold">· {premiumCount} Premium trên trang này</span>}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-lg">search</span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Tìm tên hoặc email..."
              defaultValue={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-outline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-tsubaki-red/30"
            />
          </div>
          <div className="flex gap-2">
            {[
              { value: '',        label: 'Tất cả' },
              { value: 'premium', label: '⭐ Premium' },
              { value: 'free',    label: 'Miễn phí' },
            ].map(f => (
              <button key={f.value}
                onClick={() => { setTier(f.value); setPage(1); }}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors
                  ${tier === f.value ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline hover:bg-surface-low'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-outline/20 text-left text-xs text-on-muted uppercase tracking-wide">
                    <th className="px-5 py-3.5 font-semibold">Người dùng</th>
                    <th className="px-5 py-3.5 font-semibold">Tier</th>
                    <th className="px-5 py-3.5 font-semibold">Hết hạn</th>
                    <th className="px-5 py-3.5 font-semibold">Nguồn</th>
                    <th className="px-5 py-3.5 font-semibold">Ngày tạo TK</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-on-muted py-14">
                        <span className="material-symbols-outlined text-3xl block mb-2 opacity-30">group</span>
                        Không tìm thấy tài khoản nào.
                      </td>
                    </tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="border-b border-outline/10 hover:bg-surface-low/50 transition-colors">
                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0
                            ${u.tier === 'premium' ? 'bg-amber-400' : 'bg-tsubaki-red'}`}>
                            {u.avatar_url
                              ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                              : (u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{u.full_name || '—'}</p>
                            <p className="text-xs text-on-muted truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="px-5 py-4">
                        <TierBadge tier={u.tier} daysLeft={u.days_left} />
                      </td>

                      {/* Expiry */}
                      <td className="px-5 py-4">
                        {u.current_period_end ? (
                          <div>
                            <p className="font-medium tabular-nums">
                              {new Date(u.current_period_end).toLocaleDateString('vi-VN')}
                            </p>
                            {u.days_left !== null && (
                              <p className={`text-xs ${u.days_left <= 5 ? 'text-red-500 font-semibold' : 'text-on-muted'}`}>
                                Còn {u.days_left} ngày
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-on-muted">—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-5 py-4">
                        {u.sub_source ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                            ${u.sub_source === 'admin_grant' ? 'bg-purple-100 text-purple-700'
                              : u.sub_source === 'sepay'     ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'}`}>
                            {u.sub_source === 'admin_grant' ? 'Admin' : u.sub_source === 'sepay' ? 'SePay' : u.sub_source}
                          </span>
                        ) : <span className="text-on-muted">—</span>}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-on-muted tabular-nums text-xs">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setSelected(u)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors
                            ${u.tier === 'premium'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-amber-400 hover:bg-amber-500 text-white shadow-sm shadow-amber-200'
                            }`}>
                          <span className="material-symbols-outlined text-sm">
                            {u.tier === 'premium' ? 'add_circle' : 'workspace_premium'}
                          </span>
                          {u.tier === 'premium' ? 'Gia hạn' : 'Cấp Premium'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-outline/20 text-sm">
                <span className="text-on-muted">{total} tài khoản · Trang {page}/{pages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-outline disabled:opacity-40 hover:bg-surface-low transition-colors">
                    ← Trước
                  </button>
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                    className="px-3 py-1.5 rounded-lg border border-outline disabled:opacity-40 hover:bg-surface-low transition-colors">
                    Tiếp →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grant modal */}
      {selected && (
        <GrantModal
          user={selected}
          onClose={() => setSelected(null)}
          onSuccess={handleGrantSuccess}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {toast}
        </div>
      )}
    </AdminLayout>
  );
}
