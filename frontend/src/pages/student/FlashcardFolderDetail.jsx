import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import api from '../../lib/api';

export default function FlashcardFolderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [folder, setFolder]   = useState(null);
  const [sets, setSets]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Modal thêm học phần
  const [addOpen, setAddOpen]       = useState(false);
  const [allSets, setAllSets]       = useState([]);
  const [selected, setSelected]     = useState({});
  const [loadingAll, setLoadingAll] = useState(false);
  const [adding, setAdding]         = useState(false);

  const fetchFolder = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/flashcards/folders/${id}`);
      const data = r.data.data || r.data;
      setFolder(data);
      setSets(data.sets || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFolder(); }, [id]);

  const openAddModal = async () => {
    setAddOpen(true);
    setSelected({});
    setLoadingAll(true);
    try {
      const r = await api.get('/flashcards/sets');
      const list = r.data.data || r.data || [];
      const existing = new Set(sets.map(s => s.id));
      setAllSets(list.filter(s => !existing.has(s.id)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingAll(false);
    }
  };

  const addSelected = async () => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (!ids.length) return;
    setAdding(true);
    try {
      await Promise.all(ids.map(setId =>
        api.post(`/flashcards/folders/${id}/sets`, { set_id: setId })
      ));
      setAddOpen(false);
      fetchFolder();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeSet = async (setId) => {
    try {
      await api.delete(`/flashcards/folders/${id}/sets/${setId}`);
      setSets(s => s.filter(x => x.id !== setId));
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <StudentLayout title="Thẻ ghi nhớ">
        <div className="flex justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      <Link to="/flashcards" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-4">
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Quay lại
      </Link>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-tsubaki-red/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-tsubaki-red text-2xl">folder</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface truncate">{folder?.name}</h1>
            <p className="text-sm text-on-muted">{sets.length} học phần</p>
          </div>
        </div>
        <Button variant="primary" onClick={openAddModal} className="shrink-0">
          <span className="material-symbols-outlined text-lg">add</span>
          Thêm học phần vào thư mục
        </Button>
      </div>

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* ── Danh sách học phần ──────────────────────────────────── */}
      {sets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">folder_open</span>
          <p className="font-semibold text-on-surface mb-1">Thư mục này chưa có học phần nào</p>
          <p className="text-on-muted text-sm">Thêm học phần để bắt đầu ôn tập</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map(s => (
            <div key={s.id} className="glass-card rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display text-base font-bold text-on-surface line-clamp-2 leading-snug">{s.title}</h3>
                <button
                  onClick={() => removeSet(s.id)}
                  title="Gỡ khỏi thư mục"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-on-muted hover:text-error hover:bg-error-bg/30 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-lg">bookmark_remove</span>
                </button>
              </div>
              <span className="inline-flex items-center gap-1 self-start text-xs font-semibold text-on-muted bg-surface-low px-2.5 py-1 rounded-lg mb-3">
                <span className="material-symbols-outlined text-sm">layers</span>
                {s.card_count || 0} thẻ
              </span>
              {s.description && (
                <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-2 flex-grow mb-4">{s.description}</p>
              )}
              <button
                onClick={() => navigate(`/flashcards/${s.id}`)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-tsubaki-red border border-tsubaki-red/30 rounded-xl py-2 hover:bg-tsubaki-red/5 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">school</span>
                Học ngay
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal thêm học phần ─────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm học phần vào thư mục"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Hủy</Button>
            <Button variant="primary" loading={adding} onClick={addSelected}
              disabled={!Object.values(selected).some(Boolean)}>
              Thêm
            </Button>
          </>
        }
      >
        {loadingAll ? (
          <div className="flex justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span>
          </div>
        ) : allSets.length === 0 ? (
          <p className="text-center text-sm text-on-muted py-8">Không còn học phần nào để thêm.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {allSets.map(s => (
              <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-low cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!selected[s.id]}
                  onChange={e => setSelected(sel => ({ ...sel, [s.id]: e.target.checked }))}
                  className="accent-tsubaki-red w-4 h-4"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{s.title}</p>
                  <p className="text-xs text-on-muted">{s.card_count || 0} thẻ</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </StudentLayout>
  );
}
