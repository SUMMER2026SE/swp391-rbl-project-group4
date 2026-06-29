// Quản lý bản nháp học phần flashcard — lưu localStorage (nhiều nháp, mỗi nháp có id).
// Không đụng DB; dùng chung cho Flashcards.jsx (liệt kê/xóa) và FlashcardSetForm.jsx (đọc/lưu/xóa).

const KEY = 'flashcard.drafts';

const readAll  = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
};
const writeAll = (l) => localStorage.setItem(KEY, JSON.stringify(l));

// Danh sách nháp, mới nhất trước
export const listDrafts = () => readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

export const getDraft = (id) => readAll().find(d => d.id === id) || null;

// Upsert theo id, cập nhật updatedAt
export const saveDraft = (d) =>
  writeAll([...readAll().filter(x => x.id !== d.id), { ...d, updatedAt: Date.now() }]);

export const removeDraft = (id) => writeAll(readAll().filter(d => d.id !== id));

export const newDraftId = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
