import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import api from '../../lib/api';

const emptyCard = () => ({ term: '', definition: '' });

export default function FlashcardSetForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [cards, setCards]             = useState([emptyCard(), emptyCard(), emptyCard()]);
  const [loading, setLoading]         = useState(isEdit);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Modal nhập nhanh
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [bulkText, setBulkText]   = useState('');
  const [termSep, setTermSep]     = useState('tab');   // 'tab' | 'comma'
  const [cardSep, setCardSep]     = useState('newline'); // 'newline' | 'semicolon'

  // ── Load dữ liệu khi sửa ──
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const r = await api.get(`/flashcards/sets/${id}`);
        const set = r.data.data || r.data;
        setTitle(set.title || '');
        setDescription(set.description || '');
        const cs = (set.cards || set.flashcards || []).map(c => ({ term: c.term, definition: c.definition }));
        setCards(cs.length ? cs : [emptyCard()]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  // ── Thao tác thẻ ──
  const updateCard = (i, field, value) =>
    setCards(cs => cs.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  const addCard    = () => setCards(cs => [...cs, emptyCard()]);
  const removeCard = (i) => setCards(cs => (cs.length > 1 ? cs.filter((_, idx) => idx !== i) : cs));

  // ── Parse nhập nhanh ──
  const parsedBulk = (() => {
    if (!bulkText.trim()) return [];
    const rows = cardSep === 'newline' ? bulkText.split('\n') : bulkText.split(';');
    return rows
      .map(row => {
        const parts = termSep === 'tab' ? row.split('\t') : row.split(',');
        return { term: (parts[0] || '').trim(), definition: (parts.slice(1).join(termSep === 'tab' ? '\t' : ',') || '').trim() };
      })
      .filter(c => c.term || c.definition);
  })();

  const applyBulk = () => {
    if (!parsedBulk.length) return;
    setCards(cs => {
      const kept = cs.filter(c => c.term.trim() || c.definition.trim());
      return [...kept, ...parsedBulk];
    });
    setBulkText('');
    setBulkOpen(false);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề học phần.'); return; }
    const validCards = cards
      .map(c => ({ term: c.term.trim(), definition: c.definition.trim() }))
      .filter(c => c.term && c.definition);
    if (!validCards.length) { setError('Cần ít nhất 1 thẻ có đủ từ vựng và định nghĩa.'); return; }

    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), cards: validCards };
      if (isEdit) await api.put(`/flashcards/sets/${id}`, payload);
      else        await api.post('/flashcards/sets', payload);
      navigate('/flashcards');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
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
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/flashcards')}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low text-on-muted hover:text-charcoal transition-colors shrink-0"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-display text-xl font-bold text-on-surface truncate">
            {isEdit ? 'Chỉnh sửa học phần' : 'Tạo học phần mới'}
          </h1>
        </div>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>
          {isEdit ? 'Lưu' : 'Tạo'}
        </Button>
      </div>

      {error && <div className="mb-6"><Alert type="error" onClose={() => setError('')}>{error}</Alert></div>}

      {/* ── Tiêu đề + mô tả ─────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-5 mb-6 space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Nhập tiêu đề, ví dụ: Từ vựng N5 bài 1"
          className="w-full text-lg font-semibold px-1 py-2 border-b-2 border-outline/40 outline-none focus:border-tsubaki-red bg-transparent transition-colors"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Thêm mô tả (không bắt buộc)"
          rows={2}
          className="w-full text-sm px-1 py-2 border-b border-outline/40 outline-none focus:border-tsubaki-red bg-transparent resize-none transition-colors"
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
          <span className="material-symbols-outlined text-lg">upload</span>
          Nhập nhanh
        </Button>
        <span className="text-xs text-on-muted">Dán dữ liệu từ Excel / Word</span>
        <button
          disabled
          title="Tính năng đang phát triển"
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-sumire-purple/60 px-4 py-2 rounded-xl border border-sumire-purple/20 bg-sumire-purple/5 cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-lg">auto_awesome</span>
          AI Gợi ý
        </button>
      </div>

      {/* ── Danh sách thẻ ───────────────────────────────────────── */}
      <div className="space-y-4">
        {cards.map((card, i) => (
          <div key={i} className="glass-card rounded-2xl p-4 flex items-start gap-4">
            <span className="text-sm font-bold text-on-muted w-6 text-center pt-3 shrink-0">{i + 1}</span>
            <div className="grid sm:grid-cols-2 gap-4 flex-grow">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-on-muted mb-1">Từ vựng</label>
                <input
                  value={card.term}
                  onChange={e => updateCard(i, 'term', e.target.value)}
                  placeholder="Nhập từ vựng..."
                  className="w-full px-1 py-2 border-b border-outline/50 outline-none focus:border-tsubaki-red bg-transparent text-sm transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-on-muted mb-1">Định nghĩa</label>
                <input
                  value={card.definition}
                  onChange={e => updateCard(i, 'definition', e.target.value)}
                  placeholder="Nhập định nghĩa..."
                  className="w-full px-1 py-2 border-b border-outline/50 outline-none focus:border-tsubaki-red bg-transparent text-sm transition-colors"
                />
              </div>
            </div>
            <button
              onClick={() => removeCard(i)}
              disabled={cards.length <= 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-muted hover:text-error hover:bg-error-bg/30 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-muted transition-colors shrink-0 mt-2"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addCard}
        className="w-full mt-4 py-4 rounded-2xl border-2 border-dashed border-outline/50 text-on-muted font-semibold hover:border-tsubaki-red hover:text-tsubaki-red transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined">add</span>
        Thêm thẻ
      </button>

      {/* ── Modal nhập nhanh ────────────────────────────────────── */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Nhập nhanh từ Excel / Word"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={applyBulk} disabled={!parsedBulk.length}>
              Nhập {parsedBulk.length ? `(${parsedBulk.length} thẻ)` : ''}
            </Button>
          </>
        }
      >
        <p className="text-sm text-on-muted mb-3">
          Dán dữ liệu vào ô bên dưới. Mỗi dòng là một thẻ, từ vựng và định nghĩa cách nhau bởi dấu phân tách.
        </p>
        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          rows={6}
          placeholder={'勉強\thọc tập\n先生\tgiáo viên'}
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all font-mono resize-y"
        />

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-on-muted mb-2">Giữa từ và định nghĩa</p>
            <RadioRow name="termSep" value={termSep} onChange={setTermSep}
              options={[['tab', 'Tab'], ['comma', 'Dấu phẩy ( , )']]} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-on-muted mb-2">Giữa các thẻ</p>
            <RadioRow name="cardSep" value={cardSep} onChange={setCardSep}
              options={[['newline', 'Xuống dòng'], ['semicolon', 'Chấm phẩy ( ; )']]} />
          </div>
        </div>

        {parsedBulk.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-muted mb-2">Xem trước ({parsedBulk.length} thẻ)</p>
            <div className="max-h-40 overflow-y-auto border border-outline/40 rounded-xl divide-y divide-outline/20">
              {parsedBulk.slice(0, 50).map((c, i) => (
                <div key={i} className="flex text-sm px-3 py-2 gap-3">
                  <span className="font-medium text-on-surface flex-1 truncate">{c.term || <em className="text-on-muted">(trống)</em>}</span>
                  <span className="text-on-surface-variant flex-1 truncate">{c.definition || <em className="text-on-muted">(trống)</em>}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </StudentLayout>
  );
}

function RadioRow({ name, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(([val, label]) => (
        <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={value === val}
            onChange={() => onChange(val)}
            className="accent-tsubaki-red"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
