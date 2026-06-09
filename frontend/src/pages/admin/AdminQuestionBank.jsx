import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────
const LEVELS       = ['N5', 'N4', 'N3', 'N2', 'N1'];
const SKILLS       = ['Đọc hiểu', 'Nghe hiểu', 'Nói', 'Viết'];
const DIFFICULTIES = [{ value: 'easy', label: 'Dễ' }, { value: 'medium', label: 'Trung bình' }, { value: 'hard', label: 'Khó' }];
const STATUSES     = [{ value: 'pending', label: 'Chờ duyệt' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'draft', label: 'Nháp' }];

const QUESTION_TYPES = [
  { value: 'single_choice',   label: 'Chọn 1 đáp án',      icon: 'radio_button_checked', color: 'bg-sky-100 text-sky-700' },
  { value: 'multiple_choice', label: 'Chọn nhiều đáp án',   icon: 'check_box',            color: 'bg-violet-100 text-violet-700' },
  { value: 'matching',        label: 'Nối kết quả',         icon: 'compare_arrows',       color: 'bg-amber-100 text-amber-700' },
  { value: 'ordering',        label: 'Sắp xếp thứ tự',     icon: 'sort',                 color: 'bg-orange-100 text-orange-700' },
  { value: 'fill_blank',      label: 'Điền vào chỗ trống',  icon: 'text_fields',          color: 'bg-emerald-100 text-emerald-700' },
  { value: 'short_answer',    label: 'Trả lời ngắn',        icon: 'edit_note',            color: 'bg-rose-100 text-rose-700' },
];
const TYPE_MAP = Object.fromEntries(QUESTION_TYPES.map(t => [t.value, t]));

const LEVEL_COLORS = { N5: 'bg-emerald-500 text-white', N4: 'bg-sky-500 text-white', N3: 'bg-violet-500 text-white', N2: 'bg-orange-500 text-white', N1: 'bg-tsubaki-red text-white' };
const SKILL_ICONS  = { 'Đọc hiểu': 'menu_book', 'Nghe hiểu': 'headphones', 'Nói': 'record_voice_over', 'Viết': 'edit_note' };
const DIFF_COLORS  = { easy: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700' };
const STATUS_CFG   = {
  approved: { label: 'Đã duyệt', icon: 'check_circle', cls: 'text-emerald-600' },
  pending:  { label: 'Chờ duyệt', icon: 'pending',      cls: 'text-amber-600' },
  draft:    { label: 'Nháp',      icon: 'draft',         cls: 'text-on-muted' },
};

// ── Form helpers ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  question_type: 'single_choice', question_text: '',
  options: ['', '', '', ''], correct_answer_single: '', correct_answers_multi: [],
  matching_pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
  ordering_items: ['', '', '', ''], fill_blank_answers: '', correct_answer_short: '',
  explanation: '', level: '', skill: '', topic: '', difficulty: 'medium',
  status: 'pending', is_ai_generated: false, passage_id: '',
};

const EMPTY_PASSAGE = { title: '', content: '', level: '', topic: '', source: '' };

function formFromRow(row) {
  const base = {
    ...EMPTY_FORM,
    question_type: row.question_type || 'single_choice',
    question_text: row.question_text || '', explanation: row.explanation || '',
    level: row.level || '', skill: row.skill || '', topic: row.topic || '',
    difficulty: row.difficulty || 'medium', status: row.status || 'pending',
    is_ai_generated: !!row.is_ai_generated, passage_id: row.passage_id || '',
  };
  switch (base.question_type) {
    case 'single_choice':
      return { ...base, options: [...(row.options || []), '', '', '', ''].slice(0, 4), correct_answer_single: row.correct_answer || '' };
    case 'multiple_choice':
      return { ...base, options: [...(row.options || []), '', '', '', ''].slice(0, 4), correct_answers_multi: Array.isArray(row.correct_answer) ? row.correct_answer : [] };
    case 'matching':
      return { ...base, matching_pairs: (row.options || []).length ? row.options.map(p => ({ left: p.left || '', right: p.right || '' })) : EMPTY_FORM.matching_pairs };
    case 'ordering':
      return { ...base, ordering_items: Array.isArray(row.correct_answer) && row.correct_answer.length ? [...row.correct_answer, '', ''] : EMPTY_FORM.ordering_items };
    case 'fill_blank': {
      const a = row.correct_answer;
      return { ...base, fill_blank_answers: Array.isArray(a) ? a.join(', ') : (a || '') };
    }
    case 'short_answer':
      return { ...base, correct_answer_short: row.correct_answer || '' };
    default: return base;
  }
}

function buildPayload(form) {
  const base = {
    question_type: form.question_type, question_text: form.question_text,
    explanation: form.explanation, level: form.level, skill: form.skill,
    topic: form.topic, difficulty: form.difficulty, status: form.status,
    is_ai_generated: form.is_ai_generated, passage_id: form.passage_id || null,
  };
  switch (form.question_type) {
    case 'single_choice':   return { ...base, options: form.options.filter(Boolean), correct_answer: form.correct_answer_single };
    case 'multiple_choice': return { ...base, options: form.options.filter(Boolean), correct_answer: form.correct_answers_multi };
    case 'matching': {
      const pairs = form.matching_pairs.filter(p => p.left.trim() && p.right.trim());
      return { ...base, options: pairs, correct_answer: Object.fromEntries(pairs.map(p => [p.left, p.right])) };
    }
    case 'ordering': { const items = form.ordering_items.filter(Boolean); return { ...base, options: items, correct_answer: items }; }
    case 'fill_blank': {
      const ans = form.fill_blank_answers.split(',').map(s => s.trim()).filter(Boolean);
      return { ...base, options: [], correct_answer: ans.length === 1 ? ans[0] : ans };
    }
    case 'short_answer': return { ...base, options: [], correct_answer: form.correct_answer_short };
    default: return base;
  }
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, iconBg }) {
  return (
    <div className={`glass-card rounded-2xl p-5 flex items-center justify-between ${accent || ''}`}>
      <div>
        <p className="text-xs font-semibold text-on-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-bold text-charcoal">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
  );
}

function TypeBadge({ type, sm }) {
  const cfg = TYPE_MAP[type];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${cfg.color} ${sm ? 'text-[10px]' : 'text-xs'}`}>
      <span className={`material-symbols-outlined ${sm ? 'text-[11px]' : 'text-[13px]'}`}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── Passage card used in Preview ──────────────────────────────────────────────
function PassageCard({ passage, compact }) {
  const [expanded, setExpanded] = useState(!compact);
  if (!passage) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-amber-700">menu_book</span>
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Bài đọc</span>
          {passage.title && <span className="text-xs font-semibold text-amber-700">— {passage.title}</span>}
        </div>
        {compact && (
          <button onClick={() => setExpanded(v => !v)} className="text-amber-700 hover:text-amber-900">
            <span className="material-symbols-outlined text-[16px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-4 py-3 max-h-48 overflow-y-auto">
          <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{passage.content}</p>
        </div>
      )}
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ item, onClose }) {
  if (!item) return null;
  const sc  = STATUS_CFG[item.status] || STATUS_CFG.pending;
  const typ = item.question_type || 'single_choice';
  const passage = item.reading_passages;

  const renderAnswer = () => {
    switch (typ) {
      case 'single_choice':
        return Array.isArray(item.options) && item.options.length ? (
          <div className="space-y-2">
            {item.options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm
                ${opt === item.correct_answer ? 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold' : 'border-outline bg-surface-low text-charcoal'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${opt === item.correct_answer ? 'bg-emerald-500 text-white' : 'bg-outline/30 text-on-muted'}`}>{String.fromCharCode(65 + i)}</span>
                {opt}
                {opt === item.correct_answer && <span className="material-symbols-outlined text-[16px] ml-auto text-emerald-500">check_circle</span>}
              </div>
            ))}
          </div>
        ) : null;

      case 'multiple_choice':
        return Array.isArray(item.options) && item.options.length ? (
          <div className="space-y-2">
            {item.options.map((opt, i) => {
              const correct = Array.isArray(item.correct_answer) && item.correct_answer.includes(opt);
              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm
                  ${correct ? 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold' : 'border-outline bg-surface-low text-charcoal'}`}>
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0
                    ${correct ? 'bg-emerald-500 text-white' : 'bg-outline/30 text-on-muted'}`}>{correct ? '✓' : String.fromCharCode(65 + i)}</span>
                  {opt}
                  {correct && <span className="ml-auto text-xs font-bold text-emerald-600">Đúng</span>}
                </div>
              );
            })}
          </div>
        ) : null;

      case 'matching':
        return Array.isArray(item.options) && item.options.length ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-on-muted uppercase mb-2">Đáp án đúng:</p>
            {item.options.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 px-3 py-2 bg-surface-low border border-outline rounded-xl text-center font-semibold">{p.left}</span>
                <span className="material-symbols-outlined text-on-muted text-lg">arrow_forward</span>
                <span className="flex-1 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-center font-semibold text-emerald-800">{p.right}</span>
              </div>
            ))}
          </div>
        ) : null;

      case 'ordering':
        return Array.isArray(item.correct_answer) && item.correct_answer.length ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-on-muted uppercase mb-2">Thứ tự đúng:</p>
            {item.correct_answer.map((it, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-semibold text-emerald-800">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                {it}
              </div>
            ))}
          </div>
        ) : null;

      case 'fill_blank':
        return (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-semibold text-emerald-800">
            <span className="text-xs font-bold text-emerald-700 block mb-1">Đáp án chấp nhận:</span>
            {Array.isArray(item.correct_answer) ? item.correct_answer.join(' / ') : item.correct_answer}
          </div>
        );

      case 'short_answer':
        return item.correct_answer ? (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span className="text-xs font-bold text-amber-700 block mb-1">Đáp án mẫu:</span>
            {item.correct_answer}
          </div>
        ) : null;

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />
        <div className="p-6 overflow-y-auto">
          {/* Badges */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              <TypeBadge type={typ} />
              {item.level && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level]}`}>{item.level}</span>}
              {item.skill && <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-low border border-outline text-on-muted"><span className="material-symbols-outlined text-[13px]">{SKILL_ICONS[item.skill] || 'quiz'}</span>{item.skill}</span>}
              {item.difficulty && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${DIFF_COLORS[item.difficulty]}`}>{DIFFICULTIES.find(d => d.value === item.difficulty)?.label}</span>}
              {item.is_ai_generated && <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sumire-purple/10 text-sumire-purple"><span className="material-symbols-outlined text-[13px]">auto_awesome</span>AI</span>}
            </div>
            <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-muted">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Passage (collapsible) */}
          {passage && <PassageCard passage={passage} compact />}

          <p className="text-base font-semibold text-charcoal mb-4 leading-relaxed">{item.question_text}</p>
          {renderAnswer()}

          {item.explanation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-4">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">lightbulb</span>Giải thích
              </p>
              <p className="text-sm text-amber-800">{item.explanation}</p>
            </div>
          )}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline/30">
            <span className={`flex items-center gap-1 text-xs font-bold ${sc.cls}`}>
              <span className="material-symbols-outlined text-[16px]">{sc.icon}</span>{sc.label}
            </span>
            <span className="text-xs text-on-muted">{new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Question Form ─────────────────────────────────────────────────────────────
function QuestionForm({ form, setForm, passages }) {
  const typ = form.question_type;

  const setOpt = (i, v) => {
    const o = [...form.options]; o[i] = v;
    const next = { ...form, options: o };
    if (typ === 'single_choice' && form.correct_answer_single === form.options[i]) next.correct_answer_single = '';
    setForm(next);
  };
  const toggleMulti = (opt) => {
    const arr = form.correct_answers_multi.includes(opt) ? form.correct_answers_multi.filter(v => v !== opt) : [...form.correct_answers_multi, opt];
    setForm({ ...form, correct_answers_multi: arr });
  };
  const setPair      = (i, side, v) => setForm({ ...form, matching_pairs: form.matching_pairs.map((p, idx) => idx === i ? { ...p, [side]: v } : p) });
  const addPair      = () => setForm({ ...form, matching_pairs: [...form.matching_pairs, { left: '', right: '' }] });
  const removePair   = (i) => setForm({ ...form, matching_pairs: form.matching_pairs.filter((_, idx) => idx !== i) });
  const setOrdItem   = (i, v) => setForm({ ...form, ordering_items: form.ordering_items.map((x, idx) => idx === i ? v : x) });
  const addOrdItem   = () => setForm({ ...form, ordering_items: [...form.ordering_items, ''] });
  const removeOrdItem= (i) => setForm({ ...form, ordering_items: form.ordering_items.filter((_, idx) => idx !== i) });
  const moveOrdItem  = (i, dir) => {
    const items = [...form.ordering_items]; const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]]; setForm({ ...form, ordering_items: items });
  };

  const selectedPassage = passages.find(p => p.id === form.passage_id);

  return (
    <div className="space-y-5">
      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-2">Loại câu hỏi *</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUESTION_TYPES.map(qt => (
            <button key={qt.value} type="button"
              onClick={() => setForm({ ...EMPTY_FORM, question_type: qt.value, question_text: form.question_text, explanation: form.explanation, level: form.level, skill: form.skill, topic: form.topic, difficulty: form.difficulty, status: form.status, is_ai_generated: form.is_ai_generated, passage_id: form.passage_id })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left
                ${form.question_type === qt.value ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red/50'}`}>
              <span className={`material-symbols-outlined text-[18px] shrink-0 ${form.question_type === qt.value ? 'text-tsubaki-red' : ''}`}>{qt.icon}</span>
              <span className="leading-tight text-xs">{qt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Passage link */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1 flex items-center gap-1">
          <span className="material-symbols-outlined text-[15px]">menu_book</span>
          Bài đọc liên kết
          <span className="font-normal">(tùy chọn)</span>
        </label>
        <select value={form.passage_id} onChange={e => setForm({ ...form, passage_id: e.target.value })}
          className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-amber-400 transition-colors">
          <option value="">— Không liên kết bài đọc —</option>
          {passages.map(p => (
            <option key={p.id} value={p.id}>
              {p.title || '(Không có tiêu đề)'}{p.level ? ` [${p.level}]` : ''} — {p.question_count} câu hỏi
            </option>
          ))}
        </select>
        {selectedPassage && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed line-clamp-3">
            <span className="font-bold block mb-1">{selectedPassage.title || 'Bài đọc'}</span>
            {selectedPassage.content}
          </div>
        )}
        {passages.length === 0 && (
          <p className="text-xs text-on-muted mt-1">Chưa có bài đọc nào. Tạo bài đọc ở tab "Bài đọc" trước.</p>
        )}
      </div>

      {/* Question text */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">
          {typ === 'fill_blank' ? 'Câu hỏi (dùng ___ cho chỗ trống) *' : 'Nội dung câu hỏi *'}
        </label>
        {typ === 'fill_blank' && <p className="text-xs text-on-muted mb-1">Ví dụ: <span className="font-mono bg-surface-low px-1 rounded">私は___に住んでいます</span></p>}
        <textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })}
          rows={3} placeholder="Nhập nội dung câu hỏi..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none transition-colors" />
      </div>

      {/* ── Single choice ── */}
      {typ === 'single_choice' && (<>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-2">Các lựa chọn</label>
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 shrink-0 rounded-full bg-surface-low text-xs font-bold text-on-muted flex items-center justify-center border border-outline">{String.fromCharCode(65 + i)}</span>
              <input value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                className="flex-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Đáp án đúng</label>
          <select value={form.correct_answer_single} onChange={e => setForm({ ...form, correct_answer_single: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
            <option value="">-- Chọn đáp án đúng --</option>
            {form.options.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>)}
          </select>
        </div>
      </>)}

      {/* ── Multiple choice ── */}
      {typ === 'multiple_choice' && (<>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-2">Các lựa chọn</label>
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 shrink-0 rounded text-xs font-bold bg-surface-low border border-outline text-on-muted flex items-center justify-center">{String.fromCharCode(65 + i)}</span>
              <input value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                className="flex-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-2">Đáp án đúng (chọn nhiều)</label>
          <div className="space-y-2">
            {form.options.filter(Boolean).length === 0 && <p className="text-xs text-on-muted italic">Nhập các lựa chọn trước.</p>}
            {form.options.filter(Boolean).map((opt, i) => {
              const checked = form.correct_answers_multi.includes(opt);
              return (
                <label key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all
                  ${checked ? 'border-emerald-400 bg-emerald-50' : 'border-outline hover:border-emerald-300'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleMulti(opt)} className="w-4 h-4 accent-emerald-600 rounded" />
                  <span className="text-sm font-medium">{String.fromCharCode(65 + form.options.indexOf(opt))}. {opt}</span>
                  {checked && <span className="ml-auto text-xs font-bold text-emerald-600">✓ Đúng</span>}
                </label>
              );
            })}
          </div>
        </div>
      </>)}

      {/* ── Matching ── */}
      {typ === 'matching' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-on-muted">Các cặp nối</label>
            <button type="button" onClick={addPair} className="flex items-center gap-1 text-xs text-tsubaki-red font-semibold hover:underline">
              <span className="material-symbols-outlined text-[15px]">add</span>Thêm cặp
            </button>
          </div>
          <div className="grid grid-cols-12 gap-1 mb-1 px-1">
            <span className="col-span-5 text-xs font-bold text-on-muted uppercase">Bên trái</span>
            <span className="col-span-1" />
            <span className="col-span-5 text-xs font-bold text-on-muted uppercase">Bên phải</span>
          </div>
          {form.matching_pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 mb-2 items-center">
              <input value={p.left} onChange={e => setPair(i, 'left', e.target.value)} placeholder="VD: 犬"
                className="col-span-5 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-amber-400 transition-colors" />
              <span className="col-span-1 flex justify-center text-on-muted">
                <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
              </span>
              <input value={p.right} onChange={e => setPair(i, 'right', e.target.value)} placeholder="VD: con chó"
                className="col-span-5 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-amber-400 transition-colors" />
              <button type="button" onClick={() => removePair(i)} disabled={form.matching_pairs.length <= 2}
                className="col-span-1 flex items-center justify-center text-on-muted hover:text-tsubaki-red disabled:opacity-30 transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Ordering ── */}
      {typ === 'ordering' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <label className="text-sm font-medium text-on-muted">Các phần tử (theo thứ tự đúng)</label>
              <p className="text-xs text-on-muted mt-0.5">Học viên sẽ thấy bị xáo trộn và cần sắp xếp lại.</p>
            </div>
            <button type="button" onClick={addOrdItem} className="flex items-center gap-1 text-xs text-tsubaki-red font-semibold hover:underline ml-2 shrink-0">
              <span className="material-symbols-outlined text-[15px]">add</span>Thêm
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {form.ordering_items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 h-7 shrink-0 rounded-full bg-tsubaki-red/10 text-tsubaki-red text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <input value={item} onChange={e => setOrdItem(i, e.target.value)} placeholder={`Phần tử ${i + 1}`}
                  className="flex-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" />
                <div className="flex gap-1">
                  {[[-1, 'keyboard_arrow_up', i === 0], [1, 'keyboard_arrow_down', i === form.ordering_items.length - 1]].map(([dir, icon, dis]) => (
                    <button key={icon} type="button" onClick={() => moveOrdItem(i, dir)} disabled={dis}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-outline text-on-muted hover:border-tsubaki-red disabled:opacity-30 transition-colors">
                      <span className="material-symbols-outlined text-[15px]">{icon}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => removeOrdItem(i)} disabled={form.ordering_items.length <= 2}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-outline text-on-muted hover:text-tsubaki-red disabled:opacity-30 transition-colors">
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fill blank ── */}
      {typ === 'fill_blank' && (
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Đáp án chấp nhận <span className="font-normal text-xs">(phân cách bằng dấu phẩy)</span></label>
          <input value={form.fill_blank_answers} onChange={e => setForm({ ...form, fill_blank_answers: e.target.value })}
            placeholder="VD: 学校, がっこう"
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" />
        </div>
      )}

      {/* ── Short answer ── */}
      {typ === 'short_answer' && (
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Đáp án mẫu (tham khảo)</label>
          <p className="text-xs text-on-muted mb-1">Để giáo viên tham khảo khi chấm điểm thủ công.</p>
          <textarea value={form.correct_answer_short} onChange={e => setForm({ ...form, correct_answer_short: e.target.value })}
            rows={3} placeholder="Nhập đáp án mẫu..."
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none transition-colors" />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1">Giải thích (tùy chọn)</label>
        <textarea value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })}
          rows={2} placeholder="Giải thích thêm về đáp án..."
          className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none transition-colors" />
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Cấp độ JLPT', value: form.level, key: 'level', opts: [['', '-- Không có --'], ...LEVELS.map(l => [l, l])] },
          { label: 'Kỹ năng',     value: form.skill, key: 'skill', opts: [['', '-- Không có --'], ...SKILLS.map(s => [s, s])] },
          { label: 'Độ khó',      value: form.difficulty, key: 'difficulty', opts: DIFFICULTIES.map(d => [d.value, d.label]) },
          { label: 'Trạng thái',  value: form.status, key: 'status', opts: STATUSES.map(s => [s.value, s.label]) },
        ].map(({ label, value, key, opts }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-on-muted mb-1">{label}</label>
            <select value={value} onChange={e => setForm({ ...form, [key]: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      <Input label="Chủ đề" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Cuộc sống hàng ngày, Kinh doanh..." />

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_ai_generated} onChange={e => setForm({ ...form, is_ai_generated: e.target.checked })} className="w-4 h-4 accent-sumire-purple rounded" />
        <span className="text-sm font-medium text-on-muted flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-sumire-purple">auto_awesome</span>Được tạo bởi AI
        </span>
      </label>
    </div>
  );
}

// ── Passage Tab ───────────────────────────────────────────────────────────────
function PassagesTab({ passages, onRefresh, setAlert }) {
  const [passageModal, setPassageModal] = useState(false);
  const [editId, setEditId]             = useState(null);
  const [form, setForm]                 = useState(EMPTY_PASSAGE);
  const [saving, setSaving]             = useState(false);
  const [viewPassage, setViewPassage]   = useState(null);

  const openCreate = () => { setForm(EMPTY_PASSAGE); setEditId(null); setPassageModal(true); };
  const openEdit   = (p) => { setForm({ title: p.title || '', content: p.content || '', level: p.level || '', topic: p.topic || '', source: p.source || '' }); setEditId(p.id); setPassageModal(true); };

  const handleSave = async () => {
    if (!form.content.trim()) return setAlert({ type: 'error', msg: 'Nội dung bài đọc là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/reading-passages/${editId}`, form);
      else        await api.post('/admin/reading-passages', form);
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật bài đọc.' : 'Đã thêm bài đọc mới.' });
      setPassageModal(false);
      onRefresh();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Xóa bài đọc "${p.title || 'này'}"? Các câu hỏi liên kết sẽ bị hủy liên kết.`)) return;
    try {
      await api.delete(`/admin/reading-passages/${p.id}`);
      setAlert({ type: 'success', msg: 'Đã xóa bài đọc.' });
      onRefresh();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-on-muted">{passages.length} bài đọc</p>
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-lg">add</span>Thêm bài đọc
        </Button>
      </div>

      {passages.length === 0 ? (
        <div className="glass-card rounded-2xl py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">menu_book</span>
          <p className="font-semibold text-charcoal">Chưa có bài đọc nào</p>
          <p className="text-sm text-on-muted mt-1">Nhấn "Thêm bài đọc" để tạo bài đọc đầu tiên.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {passages.map(p => (
            <div key={p.id} className="glass-card rounded-2xl p-5 group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-charcoal">{p.title || <span className="text-on-muted italic font-normal">Không có tiêu đề</span>}</h3>
                    {p.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[p.level]}`}>{p.level}</span>}
                    {p.topic && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-low border border-outline text-on-muted">{p.topic}</span>}
                    <span className="flex items-center gap-1 text-xs font-semibold text-on-muted ml-auto">
                      <span className="material-symbols-outlined text-[14px]">help</span>{p.question_count} câu hỏi
                    </span>
                  </div>
                  {p.source && <p className="text-xs text-on-muted mb-2">Nguồn: {p.source}</p>}
                  <p className="text-sm text-on-muted line-clamp-2 leading-relaxed">{p.content}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setViewPassage(p)} title="Xem nội dung"
                    className="p-2 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                  <button onClick={() => openEdit(p)} title="Sửa"
                    className="p-2 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button onClick={() => handleDelete(p)} title="Xóa"
                    className="p-2 rounded-lg text-on-muted hover:bg-red-50 hover:text-tsubaki-red transition-colors">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View full passage modal */}
      {viewPassage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewPassage(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline/20">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600">menu_book</span>
                <div>
                  <h3 className="font-bold text-charcoal">{viewPassage.title || 'Bài đọc'}</h3>
                  <div className="flex gap-2 mt-0.5">
                    {viewPassage.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[viewPassage.level]}`}>{viewPassage.level}</span>}
                    {viewPassage.source && <span className="text-xs text-on-muted">Nguồn: {viewPassage.source}</span>}
                    <span className="text-xs text-on-muted">{viewPassage.question_count} câu hỏi</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewPassage(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-muted">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-charcoal leading-loose whitespace-pre-wrap">{viewPassage.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={passageModal} onClose={() => setPassageModal(false)}
        title={editId ? 'Sửa bài đọc' : 'Thêm bài đọc mới'}
        footer={<><Button variant="secondary" onClick={() => setPassageModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề (tùy chọn)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Bài đọc số 1 - Cuộc sống Nhật Bản" />
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Nội dung bài đọc *</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={10} placeholder="Nhập nội dung bài đọc tiếng Nhật..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y transition-colors font-mono leading-loose" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                <option value="">-- Không có --</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <Input label="Chủ đề" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Ẩm thực, Du lịch..." />
          </div>
          <Input label="Nguồn (tùy chọn)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="JLPT N3 2023, Sách Minna no Nihongo..." />
        </div>
      </Modal>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminQuestionBank() {
  const [activeTab, setActiveTab] = useState('questions');
  const [items, setItems]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [stats, setStats]         = useState({ total: 0, pending: 0, topLevel: '—' });
  const [passages, setPassages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [alert, setAlert]         = useState({ type: '', msg: '' });
  const [page, setPage]           = useState(1);
  const LIMIT = 15;

  const [search, setSearch]             = useState('');
  const [filterLevel, setFilterLevel]   = useState('');
  const [filterSkill, setFilterSkill]   = useState('');
  const [filterDiff, setFilterDiff]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterPassage, setFilterPassage] = useState('');

  const [formModal, setFormModal]     = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [editId, setEditId]           = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const searchTimer = useRef(null);

  const fetchStats = useCallback(async () => {
    try { const r = await api.get('/admin/question-bank/stats'); setStats(r.data); } catch (_) {}
  }, []);

  const fetchPassages = useCallback(async () => {
    try { const r = await api.get('/admin/reading-passages'); setPassages(r.data || []); } catch (_) {}
  }, []);

  const fetchItems = useCallback(async (p, l, sk, d, st, tp, pid, s) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (l)   params.set('level', l);
      if (sk)  params.set('skill', sk);
      if (d)   params.set('difficulty', d);
      if (st)  params.set('status', st);
      if (tp)  params.set('question_type', tp);
      if (pid) params.set('passage_id', pid);
      if (s)   params.set('search', s);
      const r = await api.get(`/admin/question-bank?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPassages();
    fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, search);
  }, [page, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchItems(1, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, val);
    }, 400);
  };

  const resetFilters = () => {
    setSearch(''); setFilterLevel(''); setFilterSkill(''); setFilterDiff('');
    setFilterStatus(''); setFilterType(''); setFilterPassage(''); setPage(1);
    fetchItems(1, '', '', '', '', '', '', '');
  };

  const refresh = () => {
    fetchStats(); fetchPassages();
    fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, search);
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setFormModal(true); };
  const openEdit   = (row) => { setForm(formFromRow(row)); setEditId(row.id); setFormModal(true); };

  const handleSave = async () => {
    if (!form.question_text.trim()) return setAlert({ type: 'error', msg: 'Nội dung câu hỏi là bắt buộc.' });
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editId) await api.put(`/admin/question-bank/${editId}`, payload);
      else        await api.post('/admin/question-bank', payload);
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi mới.' });
      setFormModal(false); refresh();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    try { await api.delete(`/admin/question-bank/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); refresh(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const handleApprove = async (row) => {
    try { await api.put(`/admin/question-bank/${row.id}`, { status: 'approved' }); setAlert({ type: 'success', msg: 'Đã duyệt.' }); refresh(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const hasFilters = filterLevel || filterSkill || filterDiff || filterStatus || filterType || filterPassage || search;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout title="Ngân hàng câu hỏi">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-on-muted mb-1">Admin Panel / Ngân hàng câu hỏi</p>
          <h1 className="font-display text-2xl font-bold">Ngân hàng câu hỏi</h1>
        </div>
        {activeTab === 'questions'
          ? <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span>Thêm câu hỏi</Button>
          : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon="library_books"          label="Tổng câu hỏi"        value={stats.total.toLocaleString()} iconBg="bg-surface-low text-on-muted" />
        <StatCard icon="notification_important" label="Chờ duyệt"            value={stats.pending} accent="border-l-4 border-l-tsubaki-red" iconBg="bg-red-50 text-tsubaki-red" />
        <StatCard icon="menu_book"              label="Bài đọc"              value={passages.length} iconBg="bg-amber-50 text-amber-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-outline/30">
        {[
          { key: 'questions', label: 'Câu hỏi', icon: 'help' },
          { key: 'passages',  label: 'Bài đọc',  icon: 'menu_book' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors
              ${activeTab === tab.key ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
            {tab.key === 'passages' && passages.length > 0 && (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{passages.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─────── QUESTIONS TAB ─────── */}
      {activeTab === 'questions' && (<>
        {/* Filter bar */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <div className="flex-1 min-w-[220px] relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-muted text-lg">search</span>
              <input value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Tìm kiếm nội dung câu hỏi..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface-low border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" />
            </div>
            {hasFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm text-tsubaki-red border border-tsubaki-red/30 hover:bg-tsubaki-red/5 transition-colors">
                <span className="material-symbols-outlined text-[16px]">filter_list_off</span>Xóa bộ lọc
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Loại',      value: filterType,    onChange: setFilterType,    opts: [['', 'Tất cả loại'], ...QUESTION_TYPES.map(t => [t.value, t.label])] },
              { label: 'Bài đọc',  value: filterPassage, onChange: setFilterPassage, opts: [['', 'Tất cả'], ...passages.map(p => [p.id, p.title || '(Không tiêu đề)'])] },
              { label: 'Cấp độ',   value: filterLevel,   onChange: setFilterLevel,   opts: [['', 'Tất cả'], ...LEVELS.map(l => [l, l])] },
              { label: 'Kỹ năng',  value: filterSkill,   onChange: setFilterSkill,   opts: [['', 'Tất cả'], ...SKILLS.map(s => [s, s])] },
              { label: 'Độ khó',   value: filterDiff,    onChange: setFilterDiff,    opts: [['', 'Tất cả'], ...DIFFICULTIES.map(d => [d.value, d.label])] },
              { label: 'Trạng thái', value: filterStatus, onChange: setFilterStatus, opts: [['', 'Tất cả'], ...STATUSES.map(s => [s.value, s.label])] },
            ].map(({ label, value, onChange, opts }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-on-muted mb-1">{label}</label>
                <select value={value} onChange={e => { onChange(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 bg-surface-low border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-low border-b border-outline/30">
                  <th className="px-5 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Câu hỏi</th>
                  <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Loại</th>
                  <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide w-16">Cấp độ</th>
                  <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Độ khó</th>
                  <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide">Trạng thái</th>
                  <th className="px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wide text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/20">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-surface-low rounded animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} /></td>
                    ))}</tr>
                  ))
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">inventory_2</span>
                    <p className="font-semibold text-charcoal">{hasFilters ? 'Không tìm thấy câu hỏi nào' : 'Chưa có câu hỏi nào'}</p>
                    <p className="text-sm text-on-muted mt-1">{hasFilters ? 'Thử thay đổi bộ lọc.' : 'Nhấn "Thêm câu hỏi" để bắt đầu.'}</p>
                  </td></tr>
                ) : items.map(item => {
                  const sc = STATUS_CFG[item.status] || STATUS_CFG.pending;
                  const passage = item.reading_passages;
                  return (
                    <tr key={item.id} className="group hover:bg-surface-low/60 transition-colors">
                      <td className="px-5 py-4 max-w-xs">
                        <p className="text-sm font-medium text-charcoal line-clamp-2 leading-snug">{item.question_text}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {passage && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded font-semibold text-amber-700">
                              <span className="material-symbols-outlined text-[11px]">menu_book</span>
                              {passage.title || 'Bài đọc'}
                            </span>
                          )}
                          {item.topic && <span className="text-[10px] px-1.5 py-0.5 bg-surface-low border border-outline/60 rounded font-semibold text-on-muted uppercase">{item.topic}</span>}
                          {item.is_ai_generated && (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-sumire-purple/10 rounded font-bold text-sumire-purple">
                              <span className="material-symbols-outlined text-[11px]">auto_awesome</span>AI
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4"><TypeBadge type={item.question_type || 'single_choice'} sm /></td>
                      <td className="px-4 py-4">
                        {item.level ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level]}`}>{item.level}</span> : <span className="text-on-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {item.difficulty ? <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${DIFF_COLORS[item.difficulty]}`}>{DIFFICULTIES.find(d => d.value === item.difficulty)?.label}</span> : <span className="text-on-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`flex items-center gap-1 text-xs font-bold ${sc.cls}`}>
                          <span className="material-symbols-outlined text-[15px]">{sc.icon}</span>{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setPreviewItem(item)} title="Xem trước" className="p-1.5 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          {item.status === 'pending' && (
                            <button onClick={() => handleApprove(item)} title="Duyệt" className="p-1.5 rounded-lg text-on-muted hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            </button>
                          )}
                          <button onClick={() => openEdit(item)} title="Sửa" className="p-1.5 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete(item)} title="Xóa" className="p-1.5 rounded-lg text-on-muted hover:bg-red-50 hover:text-tsubaki-red transition-colors">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="px-5 py-3 bg-surface-low/50 border-t border-outline/20 flex justify-between items-center">
            <p className="text-xs text-on-muted">
              {loading ? '...' : `Hiển thị ${total === 0 ? 0 : Math.min((page-1)*LIMIT+1, total)}–${Math.min(page*LIMIT, total)} / ${total} câu hỏi`}
            </p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline text-on-muted hover:bg-surface-low disabled:opacity-40 transition-colors">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors
                      ${page === p ? 'bg-tsubaki-red text-white' : 'border border-outline text-on-muted hover:bg-surface-low'}`}>{p}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline text-on-muted hover:bg-surface-low disabled:opacity-40 transition-colors">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI banner */}
        <div className="glass-card rounded-2xl p-5 border-l-4 border-l-sumire-purple relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-[0.06] pointer-events-none">
            <span className="material-symbols-outlined text-[120px] text-sumire-purple">auto_awesome</span>
          </div>
          <div className="flex items-start gap-4 relative">
            <div className="w-10 h-10 rounded-full bg-sumire-purple/10 flex items-center justify-center text-sumire-purple shrink-0">
              <span className="material-symbols-outlined">lightbulb</span>
            </div>
            <div>
              <h4 className="font-bold text-charcoal mb-1">Gợi ý từ AI</h4>
              <p className="text-sm text-on-muted max-w-2xl">
                Ngân hàng hiện có <strong className="text-charcoal">{stats.total}</strong> câu hỏi và <strong className="text-charcoal">{passages.length}</strong> bài đọc.
                {stats.pending > 0 && <> Còn <strong className="text-amber-600">{stats.pending} câu chờ duyệt</strong>.</>}
                {' '}Sử dụng <span className="text-sumire-purple font-semibold">AI Generator</span> để tạo hàng loạt câu hỏi theo bài đọc.
              </p>
            </div>
          </div>
        </div>
      </>)}

      {/* ─────── PASSAGES TAB ─────── */}
      {activeTab === 'passages' && (
        <PassagesTab passages={passages} onRefresh={refresh} setAlert={setAlert} />
      )}

      {/* Preview modal */}
      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}

      {/* Create / Edit modal */}
      <Modal open={formModal} onClose={() => setFormModal(false)}
        title={editId ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}
        footer={<><Button variant="secondary" onClick={() => setFormModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <QuestionForm form={form} setForm={setForm} passages={passages} />
      </Modal>
    </AdminLayout>
  );
}
