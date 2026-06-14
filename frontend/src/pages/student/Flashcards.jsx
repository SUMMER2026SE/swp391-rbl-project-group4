import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import api from '../../lib/api';

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-pulse space-y-3">
      <div className="h-5 bg-surface-container rounded-full w-3/4" />
      <div className="h-3 bg-surface-container rounded-full w-1/4" />
      <div className="h-3 bg-surface-container rounded-full w-full" />
      <div className="h-3 bg-surface-container rounded-full w-2/3" />
    </div>
  );
}

// ── Menu kebab dùng chung cho card ──
function KebabMenu({ onEdit, onDelete, onAddToFolder }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-on-muted hover:text-charcoal w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-low transition-colors"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-outline/30 z-20 overflow-hidden">
            {onAddToFolder && (
              <button
                onClick={() => { setOpen(false); onAddToFolder(); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-low transition-colors"
              >
                <span className="material-symbols-outlined text-lg">create_new_folder</span> Thêm vào thư mục
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-low transition-colors"
            >
              <span className="material-symbols-outlined text-lg">edit</span> Sửa
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error hover:bg-error-bg/30 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">delete</span> Xóa
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Flashcards() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('sets'); // 'sets' | 'folders'
  const [sets, setSets]       = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Modal tạo/sửa thư mục
  const [folderModal, setFolderModal] = useState(null); // null | { id?, name }
  const [savingFolder, setSavingFolder] = useState(false);

  // Modal thêm học phần vào thư mục
  const [addToFolderSet, setAddToFolderSet] = useState(null); // null | set
  const [selectedFolders, setSelectedFolders] = useState({}); // { folderId: bool }
  const [addingToFolder, setAddingToFolder] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [setsRes, foldersRes] = await Promise.all([
        api.get('/flashcards/sets'),
        api.get('/flashcards/folders'),
      ]);
      setSets(setsRes.data.data || setsRes.data || []);
      setFolders(foldersRes.data.data || foldersRes.data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDeleteSet = async (id) => {
    if (!window.confirm('Xóa học phần này? Hành động không thể hoàn tác.')) return;
    try {
      await api.delete(`/flashcards/sets/${id}`);
      setSets(s => s.filter(x => x.id !== id));
    } catch (e) { setError(e.message); }
  };

  const handleDeleteFolder = async (id) => {
    if (!window.confirm('Xóa thư mục này? Các học phần bên trong không bị xóa.')) return;
    try {
      await api.delete(`/flashcards/folders/${id}`);
      setFolders(f => f.filter(x => x.id !== id));
    } catch (e) { setError(e.message); }
  };

  const saveFolder = async () => {
    const name = folderModal.name.trim();
    if (!name) return;
    setSavingFolder(true);
    try {
      if (folderModal.id) {
        await api.put(`/flashcards/folders/${folderModal.id}`, { name });
      } else {
        await api.post('/flashcards/folders', { name });
      }
      setFolderModal(null);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingFolder(false);
    }
  };

  const openAddToFolder = (set) => {
    setAddToFolderSet(set);
    setSelectedFolders({});
  };

  const confirmAddToFolder = async () => {
    const ids = Object.keys(selectedFolders).filter(k => selectedFolders[k]);
    if (!ids.length) return;
    setAddingToFolder(true);
    try {
      await Promise.all(ids.map(fid =>
        api.post(`/flashcards/folders/${fid}/sets`, { set_id: addToFolderSet.id })
      ));
      setAddToFolderSet(null);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingToFolder(false);
    }
  };

  const percent = (s) =>
    s.card_count ? Math.round((s.mastered_count || 0) / s.card_count * 100) : 0;

  return (
    <StudentLayout title="Thẻ ghi nhớ">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-display-mobile font-bold text-on-surface mb-2 tracking-tight">
            Thẻ ghi nhớ
          </h1>
          <p className="text-on-surface-variant text-base">Tạo và ôn tập từ vựng của bạn</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button variant="secondary" onClick={() => setFolderModal({ name: '' })}>
            <span className="material-symbols-outlined text-lg">create_new_folder</span>
            Tạo thư mục
          </Button>
          <Button variant="primary" onClick={() => navigate('/flashcards/new')}>
            <span className="material-symbols-outlined text-lg">add</span>
            Tạo học phần
          </Button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-6 border-b border-outline/30 mb-8">
        {[['sets', 'Học phần'], ['folders', 'Thư mục']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-3 -mb-px text-sm font-semibold border-b-2 transition-colors ${
              tab === key
                ? 'border-tsubaki-red text-tsubaki-red'
                : 'border-transparent text-on-muted hover:text-charcoal'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : tab === 'sets' ? (
        sets.length === 0 ? (
          <EmptyState icon="style" title="Chưa có học phần nào"
            hint="Tạo học phần đầu tiên để bắt đầu ôn tập"
            action={<Button variant="primary" onClick={() => navigate('/flashcards/new')}>Tạo học phần</Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sets.map(s => (
              <div
                key={s.id}
                onClick={() => navigate(`/flashcards/${s.id}`)}
                className="text-left glass-card rounded-2xl p-5 cursor-pointer border-2 border-transparent hover:border-tsubaki-red hover:-translate-y-1 transition-all duration-300 flex flex-col group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-base font-bold text-on-surface group-hover:text-tsubaki-red transition-colors line-clamp-2 leading-snug">
                    {s.title}
                  </h3>
                  <KebabMenu
                    onAddToFolder={() => openAddToFolder(s)}
                    onEdit={() => navigate(`/flashcards/${s.id}/edit`)}
                    onDelete={() => handleDeleteSet(s.id)}
                  />
                </div>
                <span className="inline-flex items-center gap-1 self-start text-xs font-semibold text-on-muted bg-surface-low px-2.5 py-1 rounded-lg mb-3">
                  <span className="material-symbols-outlined text-sm">layers</span>
                  {s.card_count || 0} thẻ
                </span>
                {s.description && (
                  <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-2 flex-grow">
                    {s.description}
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-outline/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-on-muted">Tiến độ</span>
                    <span className="text-xs font-bold text-tsubaki-red">{percent(s)}%</span>
                  </div>
                  <div className="w-full bg-surface-low rounded-full h-2">
                    <div className="bg-tsubaki-red h-2 rounded-full transition-all" style={{ width: `${percent(s)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        folders.length === 0 ? (
          <EmptyState icon="folder" title="Chưa có thư mục nào"
            hint="Tạo thư mục để gom các học phần lại với nhau"
            action={<Button variant="secondary" onClick={() => setFolderModal({ name: '' })}>Tạo thư mục</Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders.map(f => (
              <div
                key={f.id}
                onClick={() => navigate(`/flashcards/folders/${f.id}`)}
                className="text-left glass-card rounded-2xl p-5 cursor-pointer border-2 border-transparent hover:border-tsubaki-red hover:-translate-y-1 transition-all duration-300 flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-tsubaki-red/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-tsubaki-red text-2xl">folder</span>
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="font-display text-base font-bold text-on-surface group-hover:text-tsubaki-red transition-colors line-clamp-2 leading-snug">
                    {f.name}
                  </h3>
                  <p className="text-xs text-on-muted mt-1">{f.set_count || 0} học phần</p>
                </div>
                <KebabMenu
                  onEdit={() => setFolderModal({ id: f.id, name: f.name })}
                  onDelete={() => handleDeleteFolder(f.id)}
                />
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Modal tạo/sửa thư mục ───────────────────────────────── */}
      <Modal
        open={!!folderModal}
        onClose={() => setFolderModal(null)}
        title={folderModal?.id ? 'Đổi tên thư mục' : 'Tạo thư mục mới'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFolderModal(null)}>Hủy</Button>
            <Button variant="primary" loading={savingFolder} onClick={saveFolder}>
              {folderModal?.id ? 'Lưu' : 'Tạo'}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium text-on-muted mb-1">Tên thư mục</label>
        <input
          autoFocus
          value={folderModal?.name || ''}
          onChange={e => setFolderModal(m => ({ ...m, name: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') saveFolder(); }}
          placeholder="Ví dụ: Từ vựng N3 Cơ bản"
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
        />
      </Modal>

      {/* ── Modal thêm học phần vào thư mục ──────────────────────── */}
      <Modal
        open={!!addToFolderSet}
        onClose={() => setAddToFolderSet(null)}
        title="Thêm vào thư mục"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddToFolderSet(null)}>Hủy</Button>
            <Button variant="primary" loading={addingToFolder} onClick={confirmAddToFolder}
              disabled={!Object.values(selectedFolders).some(Boolean)}>
              Thêm
            </Button>
          </>
        }
      >
        {folders.length === 0 ? (
          <p className="text-center text-sm text-on-muted py-8">Chưa có thư mục nào, hãy tạo thư mục trước.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {folders.map(f => (
              <label key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-low cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!selectedFolders[f.id]}
                  onChange={e => setSelectedFolders(sel => ({ ...sel, [f.id]: e.target.checked }))}
                  className="accent-tsubaki-red w-4 h-4"
                />
                <div className="w-9 h-9 rounded-lg bg-tsubaki-red/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-tsubaki-red text-xl">folder</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{f.name}</p>
                  <p className="text-xs text-on-muted">{f.set_count || 0} học phần</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>
    </StudentLayout>
  );
}

function EmptyState({ icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">{icon}</span>
      <p className="font-semibold text-on-surface mb-1">{title}</p>
      <p className="text-on-muted text-sm mb-5">{hint}</p>
      {action}
    </div>
  );
}
