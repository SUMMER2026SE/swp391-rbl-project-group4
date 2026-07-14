import { useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../lib/api';

// Panel sửa thông tin Mục ngay trong trang deep-editor (thay cho popup "Sửa thông tin mục"
// ở Course Builder). Dùng chung admin + teacher: caller truyền apiBase từ useEditorArea.
export default function LessonInfoPanel({ lesson, apiBase, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null); // null = chưa mở lần nào
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isQuiz = lesson?.lesson_type === 'quiz';

  const toForm = () => ({
    title: lesson.title || '',
    title_ja: lesson.title_ja || '',
    duration_minutes: lesson.duration_minutes || '',
    question_count: lesson.question_count || '',
    description: lesson.description || '',
  });

  const openPanel = () => {
    setForm(toForm());
    setErr('');
    setOpen(o => !o);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setErr('Tiêu đề không được để trống.');
    setSaving(true);
    setErr('');
    try {
      const payload = {
        title: form.title.trim(),
        title_ja: form.title_ja.trim() || null,
        duration_minutes: Number(form.duration_minutes) || 0,
        question_count: Number(form.question_count) || 0,
        description: form.description.trim() || null,
      };
      await api.put(`${apiBase}/lessons/${lesson.id}`, payload);
      onSaved?.(payload);
      setOpen(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (!lesson) return null;

  return (
    <CollapsibleSection icon="tune" title="Thông tin mục"
      subtitle={`Tiêu đề, ${isQuiz ? 'số câu hỏi' : 'thời lượng'}, mô tả cho học sinh`}
      open={open} onToggle={openPanel} className="mb-6">
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <Input label="Tiêu đề (Tiếng Việt) *" value={form?.title ?? ''}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nhập tiêu đề mục..." />
      <Input label="Tiêu đề (Tiếng Nhật)" value={form?.title_ja ?? ''}
        onChange={e => setForm(f => ({ ...f, title_ja: e.target.value }))} placeholder="日本語のタイトル" />
      {isQuiz ? (
        <Input label="Số câu hỏi" type="number" min="0" value={form?.question_count ?? ''}
          onChange={e => setForm(f => ({ ...f, question_count: e.target.value }))} placeholder="0" />
      ) : (
        <Input label="Thời lượng (phút)" type="number" min="0" value={form?.duration_minutes ?? ''}
          onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="0" />
      )}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Mô tả</label>
        <textarea value={form?.description ?? ''} rows={4}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ghi chú, hướng dẫn hoặc giới thiệu nội dung mục này cho học sinh (không bắt buộc)..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>Hủy</Button>
        <Button loading={saving} onClick={handleSave}>Lưu thông tin</Button>
      </div>
    </CollapsibleSection>
  );
}
