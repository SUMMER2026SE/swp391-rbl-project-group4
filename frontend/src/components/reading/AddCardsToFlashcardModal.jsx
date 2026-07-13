import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import api from '../../lib/api';

const NEW_SET = '__new__';

// Lưu NHIỀU thẻ (từ vựng / ngữ pháp bài đọc) vào 1 học phần flashcard: chọn học phần có
// sẵn hoặc tạo học phần mới (tên gợi ý). Mô phỏng components/dictionary/AddToFlashcardModal.
export default function AddCardsToFlashcardModal({ open, onClose, cards, suggestedTitle }) {
  const [sets, setSets]           = useState([]);
  const [target, setTarget]       = useState(NEW_SET); // id set có sẵn | NEW_SET
  const [query, setQuery]         = useState('');      // từ khóa lọc học phần
  const [newTitle, setNewTitle]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [savedSetId, setSavedSetId] = useState(null);  // id set vừa lưu thành công

  // Mỗi lần mở modal: điền tên gợi ý + tải danh sách học phần của user
  useEffect(() => {
    if (!open) return;
    setNewTitle(suggestedTitle || '');
    setQuery('');
    setError('');
    setSavedSetId(null);
    setTarget(NEW_SET);
    (async () => {
      try {
        const r = await api.get('/flashcards/sets');
        setSets(r.data.data || []);
      } catch (e) {
        setSets([]);
        setError(e.message);
      }
    })();
  }, [open, suggestedTitle]);

  const isNewSet = target === NEW_SET;
  const canSave  = cards.length > 0 && (!isNewSet || newTitle.trim());

  const q = query.trim().toLowerCase();
  const filteredSets = q ? sets.filter(s => s.title.toLowerCase().includes(q)) : sets;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    try {
      if (isNewSet) {
        const r = await api.post('/flashcards/sets', { title: newTitle.trim(), cards });
        setSavedSetId(r.data.data.id);
      } else {
        await api.post(`/flashcards/sets/${target}/cards`, { cards });
        setSavedSetId(target);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Thêm vào Flashcard" size="md"
      footer={savedSetId ? (
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave} loading={saving} disabled={!canSave}>Lưu {cards.length} thẻ</Button>
        </>
      )}
    >
      {savedSetId ? (
        <div className="text-center space-y-4 py-4">
          <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
          <p className="font-medium text-charcoal">Đã thêm {cards.length} thẻ vào học phần.</p>
          <Link to={`/flashcards/${savedSetId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-tsubaki-red hover:underline">
            Mở học phần
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          <p className="text-sm text-on-muted">
            Sẽ lưu <strong className="text-charcoal">{cards.length}</strong> thẻ (mặt trước: từ/mẫu, mặt sau: nghĩa &amp; cách dùng).
          </p>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-on-muted">Chọn học phần</label>
            {sets.length > 0 && (
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm học phần..."
                className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
              />
            )}
            <div className="max-h-48 overflow-y-auto border border-outline rounded-xl divide-y divide-outline/40">
              <button
                type="button"
                onClick={() => setTarget(NEW_SET)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isNewSet ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'hover:bg-surface-low text-charcoal'}`}
              >
                ➕ Tạo học phần mới
              </button>
              {filteredSets.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTarget(s.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${target === s.id ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'hover:bg-surface-low text-charcoal'}`}
                >
                  {s.title}
                </button>
              ))}
              {sets.length > 0 && filteredSets.length === 0 && (
                <p className="px-4 py-2.5 text-sm text-on-muted">Không tìm thấy học phần phù hợp.</p>
              )}
            </div>
          </div>

          {isNewSet && (
            <Input
              label="Tên học phần mới"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Nhập tên học phần..."
            />
          )}
        </div>
      )}
    </Modal>
  );
}
