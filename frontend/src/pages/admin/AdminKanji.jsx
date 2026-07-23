import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

// Admin chỉ xem kho kanji — không sửa/xóa/tạo/nhập file (kho là của giáo
// viên/hệ thống, admin không tự sửa nội dung thay giáo viên, giống quy tắc
// ở bài đăng).
export default function AdminKanji() {
  const { t } = useLang();

  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      const r = await api.get(`/kanji?${params}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page, level]);

  return (
    <AdminLayout title={t('admin.kanji')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-2xl font-bold">{t('admin.kanji')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2 flex-wrap">
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none">
            <option value="">Tất cả level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetch(); }} className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm..." className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-32" />
            <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl"><span className="material-symbols-outlined text-lg">search</span></button>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">font_download</span>
          <p className="text-lg font-semibold text-charcoal mb-1">{search ? 'Không tìm thấy kanji' : 'Chưa có kanji nào'}</p>
        </div>
      ) : (
        <div className="bg-white border border-outline/30 rounded-2xl overflow-hidden divide-y divide-outline/20">
          {data.map(row => (
            <div key={row.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-low/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-surface-low shrink-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-tsubaki-red">{row.character}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal text-sm truncate">
                  {row.meaning_vi}
                  {row.han_viet && <span className="ml-2 text-amber-600 font-normal text-xs">({row.han_viet})</span>}
                </p>
                <p className="text-xs text-on-muted truncate">{[...(row.reading_on||[]), ...(row.reading_kun||[])].join('、') || '—'}</p>
              </div>
              {row.stroke_count != null && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-on-muted shrink-0" title="Số nét">
                  <span className="material-symbols-outlined text-[15px]">gesture</span>{row.stroke_count}
                </span>
              )}
              {row.level && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full shrink-0 ${LEVEL_BADGE[row.level] || 'bg-gray-100 text-gray-600'}`}>{row.level}</span>
              )}
              <span className="hidden lg:flex items-center gap-1 text-xs text-on-muted w-28 shrink-0 truncate" title={row.creator_name ? `Tạo bởi ${row.creator_name}` : 'Hệ thống — mọi giáo viên đều sửa được'}>
                <span className="material-symbols-outlined text-[15px]">{row.creator_name ? 'person' : 'public'}</span>
                {row.creator_name || 'Hệ thống'}
              </span>
            </div>
          ))}
        </div>
      )}

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
          <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}
    </AdminLayout>
  );
}
