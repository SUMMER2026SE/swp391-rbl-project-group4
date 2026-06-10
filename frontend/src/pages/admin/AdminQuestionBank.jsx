import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
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
  status: 'approved', is_ai_generated: false, passage_id: '', listening_passage_id: '',
};

const EMPTY_PASSAGE = { title: '', content: '', image_url: '', level: '', topic: '', source: '' };
const EMPTY_LISTENING_PASSAGE = { title: '', audio_url: '', transcript: '', description: '', level: '', topic: '', source: '', duration_sec: '' };

const AUDIO_TYPES = ['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/aac','audio/x-m4a','video/mp4','video/webm'];
const MAX_AUDIO_MB = 100;

function formFromRow(row) {
  const base = {
    ...EMPTY_FORM,
    question_type: row.question_type || 'single_choice',
    question_text: row.question_text || '', explanation: row.explanation || '',
    level: row.level || '', skill: row.skill || '', topic: row.topic || '',
    difficulty: row.difficulty || 'medium', status: row.status || 'pending',
    is_ai_generated: !!row.is_ai_generated, passage_id: row.passage_id || '', listening_passage_id: row.listening_passage_id || '',
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
    is_ai_generated: form.is_ai_generated, passage_id: form.passage_id || null, listening_passage_id: form.listening_passage_id || null,
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
function PassageCard({ passage, compact, furigana = false }) {
  const [expanded, setExpanded] = useState(!compact);
  if (!passage) return null;
  const hasText  = !!passage.content;
  const hasImage = !!passage.image_url;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="material-symbols-outlined text-[16px] text-amber-700">menu_book</span>
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Bài đọc</span>
          {passage.title && <span className="text-xs font-semibold text-amber-700">— {passage.title}</span>}
          {hasImage && !hasText && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-200 rounded font-bold text-amber-800">
              <span className="material-symbols-outlined text-[11px]">image</span>Hình ảnh
            </span>
          )}
          {hasImage && hasText && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-200 rounded font-bold text-amber-800">
              <span className="material-symbols-outlined text-[11px]">image</span>Text + Hình
            </span>
          )}
        </div>
        {compact && (
          <button onClick={() => setExpanded(v => !v)} className="text-amber-700 hover:text-amber-900 shrink-0">
            <span className="material-symbols-outlined text-[16px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        )}
      </div>
      {expanded && (
        <div className="max-h-64 overflow-y-auto">
          {hasImage && (
            <div className="px-4 pt-3">
              <img src={passage.image_url} alt="passage" className="w-full rounded-lg max-h-48 object-contain bg-white border border-amber-200" />
            </div>
          )}
          {hasText && (
            <div className="px-4 py-3">
              <FuriganaText
                text={passage.content}
                enabled={furigana}
                block
                textClassName="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap"
                className="w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Listening Passage card used in Preview ────────────────────────────────────
function ListeningPassageCard({ passage, compact }) {
  const [expanded, setExpanded] = useState(!compact);
  if (!passage) return null;
  const fmtDuration = (sec) => {
    if (!sec) return null;
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-sky-100/60 border-b border-sky-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="material-symbols-outlined text-[16px] text-sky-700">headphones</span>
          <span className="text-xs font-bold text-sky-800 uppercase tracking-wide">Bài nghe</span>
          {passage.title && <span className="text-xs font-semibold text-sky-700">— {passage.title}</span>}
          {fmtDuration(passage.duration_sec) && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-sky-200 rounded font-bold text-sky-800">
              <span className="material-symbols-outlined text-[11px]">schedule</span>{fmtDuration(passage.duration_sec)}
            </span>
          )}
        </div>
        {compact && (
          <button onClick={() => setExpanded(v => !v)} className="text-sky-700 hover:text-sky-900 shrink-0">
            <span className="material-symbols-outlined text-[16px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        )}
      </div>
      {expanded && (
        <div className="max-h-64 overflow-y-auto">
          {passage.audio_url && (
            <div className="px-4 pt-3">
              <audio controls src={passage.audio_url} className="w-full h-10" />
            </div>
          )}
          {passage.transcript && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">Transcript</p>
              <p className="text-sm text-sky-900 leading-relaxed whitespace-pre-wrap">{passage.transcript}</p>
            </div>
          )}
          {passage.description && !passage.transcript && (
            <div className="px-4 py-3">
              <p className="text-sm text-sky-900 leading-relaxed">{passage.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ item, onClose }) {
  if (!item) return null;
  const [furigana, setFurigana] = useState(false);
  const sc  = STATUS_CFG[item.status] || STATUS_CFG.pending;
  const typ = item.question_type || 'single_choice';
  const passage = item.reading_passages;
  const listeningPassage = item.listening_passages;

  const FT = ({ text, className = '', textClassName = '' }) => (
    <FuriganaText text={text} enabled={furigana} className={className} textClassName={textClassName} />
  );

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
                <FT text={opt} textClassName="text-sm" />
                {opt === item.correct_answer && <span className="material-symbols-outlined text-[16px] ml-auto text-emerald-500 shrink-0">check_circle</span>}
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
                  <FT text={opt} textClassName="text-sm" />
                  {correct && <span className="ml-auto text-xs font-bold text-emerald-600 shrink-0">Đúng</span>}
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
                <span className="flex-1 px-3 py-2 bg-surface-low border border-outline rounded-xl text-center font-semibold">
                  <FT text={p.left} />
                </span>
                <span className="material-symbols-outlined text-on-muted text-lg">arrow_forward</span>
                <span className="flex-1 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-center font-semibold text-emerald-800">
                  <FT text={p.right} />
                </span>
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
                <FT text={it} textClassName="text-sm font-semibold" />
              </div>
            ))}
          </div>
        ) : null;

      case 'fill_blank':
        return (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-semibold text-emerald-800">
            <span className="text-xs font-bold text-emerald-700 block mb-1">Đáp án chấp nhận:</span>
            <FT text={Array.isArray(item.correct_answer) ? item.correct_answer.join(' / ') : (item.correct_answer || '')} textClassName="text-sm font-semibold" />
          </div>
        );

      case 'short_answer':
        return item.correct_answer ? (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <span className="text-xs font-bold text-amber-700 block mb-1">Đáp án mẫu:</span>
            <FT text={item.correct_answer} textClassName="text-sm" />
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
          {/* Header row: badges + furigana toggle + close */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              <TypeBadge type={typ} />
              {item.level && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level]}`}>{item.level}</span>}
              {item.skill && <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-low border border-outline text-on-muted"><span className="material-symbols-outlined text-[13px]">{SKILL_ICONS[item.skill] || 'quiz'}</span>{item.skill}</span>}
              {item.difficulty && <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${DIFF_COLORS[item.difficulty]}`}>{DIFFICULTIES.find(d => d.value === item.difficulty)?.label}</span>}
              {item.is_ai_generated && <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sumire-purple/10 text-sumire-purple"><span className="material-symbols-outlined text-[13px]">auto_awesome</span>AI</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setFurigana(v => !v)}
                title={furigana ? 'Ẩn furigana' : 'Hiển thị furigana'}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all select-none ${
                  furigana
                    ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-sm'
                    : 'bg-white border-outline text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
                }`}
              >
                <span style={{ fontFamily: 'serif', fontSize: '14px' }}>あ</span>
                ふりがな
              </button>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-muted">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {/* Passages (collapsible) */}
          {passage && <PassageCard passage={passage} compact furigana={furigana} />}
          {listeningPassage && <ListeningPassageCard passage={listeningPassage} compact />}

          {/* Question text */}
          <FuriganaText
            text={item.question_text}
            enabled={furigana}
            block
            textClassName="text-base font-semibold text-charcoal leading-relaxed mb-4"
            className="mb-4 w-full"
          />

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
function QuestionForm({ form, setForm, passages, listeningPassages }) {
  const typ = form.question_type;
  const selectedListeningPassage = listeningPassages?.find(p => p.id === form.listening_passage_id) || null;

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
              onClick={() => setForm({ ...EMPTY_FORM, question_type: qt.value, question_text: form.question_text, explanation: form.explanation, level: form.level, skill: form.skill, topic: form.topic, difficulty: form.difficulty, status: form.status, is_ai_generated: form.is_ai_generated, passage_id: form.passage_id, listening_passage_id: form.listening_passage_id })}
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
        <select value={form.passage_id} onChange={e => setForm({ ...form, passage_id: e.target.value, listening_passage_id: '' })}
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
      </div>

      {/* Listening passage link */}
      <div>
        <label className="block text-sm font-medium text-on-muted mb-1 flex items-center gap-1">
          <span className="material-symbols-outlined text-[15px]">headphones</span>
          Bài nghe liên kết
          <span className="font-normal">(tùy chọn)</span>
        </label>
        <select value={form.listening_passage_id} onChange={e => setForm({ ...form, listening_passage_id: e.target.value, passage_id: '' })}
          className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sky-400 transition-colors">
          <option value="">— Không liên kết bài nghe —</option>
          {listeningPassages.map(p => (
            <option key={p.id} value={p.id}>
              {p.title || '(Không có tiêu đề)'}{p.level ? ` [${p.level}]` : ''} — {p.question_count} câu hỏi
            </option>
          ))}
        </select>
        {selectedListeningPassage && (
          <div className="mt-2 bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-sky-600 shrink-0">headphones</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-sky-800 truncate">{selectedListeningPassage.title || 'Bài nghe'}</p>
              {selectedListeningPassage.description && <p className="text-xs text-sky-700 line-clamp-1">{selectedListeningPassage.description}</p>}
            </div>
          </div>
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
  const [passageModal, setPassageModal]   = useState(false);
  const [editId, setEditId]               = useState(null);
  const [form, setForm]                   = useState(EMPTY_PASSAGE);
  const [saving, setSaving]               = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [viewPassage, setViewPassage]     = useState(null);
  const fileRef                           = useRef(null);

  const openCreate = () => { setForm(EMPTY_PASSAGE); setEditId(null); setPassageModal(true); };
  const openEdit   = (p) => {
    setForm({ title: p.title || '', content: p.content || '', image_url: p.image_url || '', level: p.level || '', topic: p.topic || '', source: p.source || '' });
    setEditId(p.id); setPassageModal(true);
  };

  const handleImageSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setAlert({ type: 'error', msg: 'Chỉ chấp nhận file hình ảnh.' });
    if (file.size > 5 * 1024 * 1024) return setAlert({ type: 'error', msg: 'File tối đa 5MB.' });
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const r = await api.post('/admin/reading-passages/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(prev => ({ ...prev, image_url: r.data.url }));
    } catch (e) { setAlert({ type: 'error', msg: 'Không thể tải ảnh lên. Thử lại.' }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  };

  const handleSave = async () => {
    if (!form.content.trim() && !form.image_url) return setAlert({ type: 'error', msg: 'Bài đọc cần có nội dung text hoặc hình ảnh.' });
    setSaving(true);
    try {
      const payload = { title: form.title, content: form.content || null, image_url: form.image_url || null, level: form.level, topic: form.topic, source: form.source };
      if (editId) await api.put(`/admin/reading-passages/${editId}`, payload);
      else        await api.post('/admin/reading-passages', payload);
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật bài đọc.' : 'Đã thêm bài đọc mới.' });
      setPassageModal(false); onRefresh();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Xóa bài đọc "${p.title || 'này'}"? Các câu hỏi liên kết sẽ bị hủy liên kết.`)) return;
    try { await api.delete(`/admin/reading-passages/${p.id}`); setAlert({ type: 'success', msg: 'Đã xóa bài đọc.' }); onRefresh(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
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
            <div key={p.id} className="glass-card rounded-2xl overflow-hidden group hover:shadow-md transition-shadow">
              {/* Thumbnail strip if image exists */}
              {p.image_url && (
                <div className="relative h-32 bg-surface-low overflow-hidden">
                  <img src={p.image_url} alt={p.title || 'bài đọc'} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  {p.content && (
                    <span className="absolute bottom-2 left-3 flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-black/50 text-white rounded font-bold backdrop-blur-sm">
                      <span className="material-symbols-outlined text-[11px]">subject</span>Có text
                    </span>
                  )}
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-charcoal">{p.title || <span className="text-on-muted italic font-normal">Không có tiêu đề</span>}</h3>
                      {p.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[p.level]}`}>{p.level}</span>}
                      {p.topic && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-low border border-outline text-on-muted">{p.topic}</span>}
                      {p.image_url && !p.content && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">
                          <span className="material-symbols-outlined text-[11px]">image</span>Hình ảnh
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs font-semibold text-on-muted ml-auto">
                        <span className="material-symbols-outlined text-[14px]">help</span>{p.question_count} câu hỏi
                      </span>
                    </div>
                    {p.source && <p className="text-xs text-on-muted mb-2">Nguồn: {p.source}</p>}
                    {p.content
                      ? <p className="text-sm text-on-muted line-clamp-2 leading-relaxed">{p.content}</p>
                      : !p.image_url && <p className="text-sm text-on-muted italic">Không có nội dung</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setViewPassage(p)} title="Xem nội dung" className="p-2 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <button onClick={() => openEdit(p)} title="Sửa" className="p-2 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDelete(p)} title="Xóa" className="p-2 rounded-lg text-on-muted hover:bg-red-50 hover:text-tsubaki-red transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
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
                  <div className="flex flex-wrap gap-2 mt-0.5">
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
            <div className="overflow-y-auto">
              {viewPassage.image_url && (
                <div className="px-6 pt-6">
                  <img src={viewPassage.image_url} alt={viewPassage.title || 'bài đọc'} className="w-full rounded-xl max-h-72 object-contain bg-surface-low border border-outline" />
                </div>
              )}
              {viewPassage.content && (
                <div className="p-6">
                  <p className="text-sm text-charcoal leading-loose whitespace-pre-wrap">{viewPassage.content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={passageModal} onClose={() => setPassageModal(false)}
        title={editId ? 'Sửa bài đọc' : 'Thêm bài đọc mới'}
        footer={<><Button variant="secondary" onClick={() => setPassageModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề (tùy chọn)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Bài đọc số 1 — Cuộc sống Nhật Bản" />

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">image</span>
              Hình ảnh <span className="font-normal">(tùy chọn)</span>
            </label>
            {form.image_url ? (
              <div className="relative rounded-xl overflow-hidden border border-outline bg-surface-low">
                <img src={form.image_url} alt="preview" className="w-full max-h-52 object-contain" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-semibold text-charcoal hover:bg-white border border-outline/40 shadow-sm transition-colors">
                    <span className="material-symbols-outlined text-[14px] mr-1">swap_horiz</span>Đổi ảnh
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, image_url: '' })}
                    className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-tsubaki-red hover:bg-white border border-outline/40 shadow-sm transition-colors">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                onClick={() => !uploading && fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                  ${uploading ? 'border-tsubaki-red/50 bg-tsubaki-red/5' : 'border-outline hover:border-tsubaki-red hover:bg-surface-low'}`}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-tsubaki-red font-semibold">Đang tải lên...</p>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-on-muted/40 block mb-2">add_photo_alternate</span>
                    <p className="text-sm font-semibold text-charcoal">Nhấn hoặc kéo thả ảnh vào đây</p>
                    <p className="text-xs text-on-muted mt-1">JPG, PNG, WebP, GIF — tối đa 5MB</p>
                  </>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageSelect(e.target.files[0])} />
          </div>

          {/* Text content */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">subject</span>
              Nội dung text <span className="font-normal">(tùy chọn nếu đã có hình)</span>
            </label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={8} placeholder="Nhập nội dung bài đọc tiếng Nhật..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y transition-colors leading-loose" />
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
          <Input label="Nguồn (tùy chọn)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="JLPT N3 2023, Minna no Nihongo..." />
        </div>
      </Modal>
    </>
  );
}

// ── Synced Transcript Player ──────────────────────────────────────────────────
function splitIntoSegments(text, durationSec) {
  // Split on Japanese sentence-ending punctuation; keep delimiter attached
  const parts = text.split(/(?<=[。！？\n])|(?<=[.!?] )/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const totalChars = parts.reduce((s, p) => s + p.length, 0) || 1;
  let t = 0;
  return parts.map(part => {
    const dur = (part.length / totalChars) * durationSec;
    const seg = { start: Math.round(t * 100) / 100, end: Math.round((t + dur) * 100) / 100, text: part };
    t += dur;
    return seg;
  });
}

function SyncedTranscriptPlayer({ audioUrl, segments, transcript }) {
  const audioRef     = useRef(null);
  const activeRef    = useRef(null);
  const containerRef = useRef(null);
  const [currentTime, setCurrentTime]   = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Real segments from DB (SRT-based) take priority.
  // When empty, estimate client-side using ACTUAL audio duration from <audio> metadata
  // so we never depend on the manually-entered duration_sec field.
  const effectiveSegments = useMemo(() => {
    if (Array.isArray(segments) && segments.length > 0) return segments;
    if (transcript && audioDuration > 0) return splitIntoSegments(transcript, audioDuration);
    return null;
  }, [segments, transcript, audioDuration]);

  const hasSegments = effectiveSegments && effectiveSegments.length > 0;

  const activeIdx = hasSegments
    ? (() => {
        for (let i = effectiveSegments.length - 1; i >= 0; i--) {
          const start = Number(effectiveSegments[i].start);
          const end   = Number(effectiveSegments[i].end);
          if (currentTime >= start) {
            // Past end by >0.5s = silence gap → clear highlight
            if (currentTime > end + 0.5) return -1;
            return i;
          }
        }
        return -1;
      })()
    : -1;

  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    const el  = activeRef.current;
    const box = containerRef.current;
    const elTop     = el.offsetTop;
    const elHeight  = el.offsetHeight;
    const boxHeight = box.clientHeight;
    const scrollTop = box.scrollTop;
    if (elTop < scrollTop || elTop + elHeight > scrollTop + boxHeight) {
      box.scrollTo({ top: elTop - boxHeight / 2, behavior: 'smooth' });
    }
  }, [activeIdx]);

  const seekTo = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Number(time);
    audioRef.current.play();
  };

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        controls
        src={audioUrl}
        onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={e => setAudioDuration(e.target.duration)}
        className="w-full"
      />
      {hasSegments ? (
        <div
          ref={containerRef}
          className="max-h-72 overflow-y-auto rounded-xl border border-outline/30 p-4 text-sm leading-loose"
          style={{ backgroundColor: '#f8f9fa' }}
        >
          {effectiveSegments.map((seg, i) => {
            const isActive = i === activeIdx;
            return (
              <span key={i}>
                <span
                  ref={isActive ? activeRef : null}
                  onClick={() => seekTo(seg.start)}
                  title={`${Number(seg.start).toFixed(1)}s`}
                  style={isActive
                    ? { backgroundColor: '#fcd34d', color: '#78350f', fontWeight: '700', borderRadius: '3px', padding: '1px 3px', cursor: 'pointer', transition: 'background-color 0.15s' }
                    : { color: '#374151', cursor: 'pointer', borderRadius: '3px', padding: '1px 3px' }
                  }
                >
                  {seg.text}
                </span>
                {i < effectiveSegments.length - 1 && <span style={{ color: '#9ca3af' }}> </span>}
              </span>
            );
          })}
        </div>
      ) : transcript ? (
        <div
          className="max-h-72 overflow-y-auto rounded-xl border border-outline/30 p-4 text-sm leading-loose whitespace-pre-wrap"
          style={{ backgroundColor: '#f8f9fa', color: '#374151' }}
        >
          {transcript}
        </div>
      ) : null}
    </div>
  );
}

// ── Listening Passages Tab ────────────────────────────────────────────────────
function ListeningPassagesTab({ passages, onRefresh, setAlert }) {
  const [modal, setModal]         = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(EMPTY_LISTENING_PASSAGE);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewPassage, setViewPassage] = useState(null);
  const [transcribing, setTranscribing] = useState(null); // passage id being transcribed
  const fileRef = useRef(null);

  const openCreate = () => { setForm(EMPTY_LISTENING_PASSAGE); setEditId(null); setModal(true); };
  const openEdit   = (p) => {
    setForm({ title: p.title || '', audio_url: p.audio_url || '', transcript: p.transcript || '', description: p.description || '', level: p.level || '', topic: p.topic || '', source: p.source || '', duration_sec: p.duration_sec || '' });
    setEditId(p.id); setModal(true);
  };

  const handleAudioSelect = async (file) => {
    if (!file) return;
    if (!AUDIO_TYPES.includes(file.type)) return setAlert({ type: 'error', msg: 'Chỉ chấp nhận file âm thanh/video (MP3, MP4, WAV, OGG...).' });
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) return setAlert({ type: 'error', msg: `File tối đa ${MAX_AUDIO_MB}MB.` });
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('audio', file);
      const r = await api.post('/admin/listening-passages/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(prev => ({ ...prev, audio_url: r.data.url }));
    } catch (e) { setAlert({ type: 'error', msg: 'Không thể tải file âm thanh lên. Thử lại.' }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDrop = (e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleAudioSelect(file); };

  const handleSave = async () => {
    if (!form.audio_url) return setAlert({ type: 'error', msg: 'Bài nghe cần có file âm thanh.' });
    setSaving(true);
    try {
      const payload = { title: form.title, audio_url: form.audio_url, transcript: form.transcript || null, description: form.description || null, level: form.level, topic: form.topic, source: form.source, duration_sec: form.duration_sec ? Number(form.duration_sec) : null };
      if (editId) await api.put(`/admin/listening-passages/${editId}`, payload);
      else        await api.post('/admin/listening-passages', payload);
      setAlert({ type: 'success', msg: editId ? 'Đã cập nhật bài nghe.' : 'Đã thêm bài nghe mới.' });
      setModal(false); onRefresh();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Xóa bài nghe "${p.title || 'này'}"? Các câu hỏi liên kết sẽ bị hủy liên kết.`)) return;
    try { await api.delete(`/admin/listening-passages/${p.id}`); setAlert({ type: 'success', msg: 'Đã xóa bài nghe.' }); onRefresh(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const fmtDuration = (sec) => { if (!sec) return null; const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };

  const handleTranscribe = async (p) => {
    setTranscribing(p.id);
    try {
      const r = await api.post(`/admin/listening-passages/${p.id}/transcribe`);
      setAlert({ type: 'success', msg: `Đã chép lời: ${r.data.count} đoạn.` });
      if (viewPassage && viewPassage.id === p.id) {
        setViewPassage(prev => ({ ...prev, transcript_segments: r.data.segments, transcript: r.data.transcript }));
      }
      onRefresh();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setTranscribing(null); }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-on-muted">{passages.length} bài nghe</p>
        <Button onClick={openCreate}>
          <span className="material-symbols-outlined text-lg">add</span>Thêm bài nghe
        </Button>
      </div>

      {passages.length === 0 ? (
        <div className="glass-card rounded-2xl py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">headphones</span>
          <p className="font-semibold text-charcoal">Chưa có bài nghe nào</p>
          <p className="text-sm text-on-muted mt-1">Nhấn "Thêm bài nghe" để tải lên file âm thanh đầu tiên.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {passages.map(p => (
            <div key={p.id} className="glass-card rounded-2xl overflow-hidden group hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="material-symbols-outlined text-sky-600 text-[20px]">headphones</span>
                      <h3 className="font-bold text-charcoal">{p.title || <span className="text-on-muted italic font-normal">Không có tiêu đề</span>}</h3>
                      {p.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[p.level]}`}>{p.level}</span>}
                      {p.topic && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-low border border-outline text-on-muted">{p.topic}</span>}
                      {fmtDuration(p.duration_sec) && (
                        <span className="flex items-center gap-0.5 text-xs px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full font-semibold">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>{fmtDuration(p.duration_sec)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs font-semibold text-on-muted ml-auto">
                        <span className="material-symbols-outlined text-[14px]">help</span>{p.question_count} câu hỏi
                      </span>
                    </div>
                    {p.source && <p className="text-xs text-on-muted mb-2">Nguồn: {p.source}</p>}
                    {p.description && <p className="text-sm text-on-muted line-clamp-1">{p.description}</p>}
                    {p.audio_url && (
                      <audio controls src={p.audio_url} className="w-full h-9 mt-2" />
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setViewPassage(p)} title="Xem chi tiết" className="p-2 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <button
                      onClick={() => handleTranscribe(p)}
                      disabled={transcribing === p.id}
                      title="Chép lời tự động (Whisper)"
                      className="p-2 rounded-lg text-on-muted hover:bg-sky-50 hover:text-sky-600 transition-colors disabled:opacity-50"
                    >
                      {transcribing === p.id
                        ? <span className="w-[18px] h-[18px] border-2 border-sky-500 border-t-transparent rounded-full animate-spin inline-block" />
                        : <span className="material-symbols-outlined text-[18px]">closed_caption</span>
                      }
                    </button>
                    <button onClick={() => openEdit(p)} title="Sửa" className="p-2 rounded-lg text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDelete(p)} title="Xóa" className="p-2 rounded-lg text-on-muted hover:bg-red-50 hover:text-tsubaki-red transition-colors">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View detail modal */}
      {viewPassage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewPassage(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="h-1.5 bg-gradient-to-r from-sky-400 to-blue-500" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline/20">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-sky-600">headphones</span>
                <div>
                  <h3 className="font-bold text-charcoal">{viewPassage.title || 'Bài nghe'}</h3>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    {viewPassage.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[viewPassage.level]}`}>{viewPassage.level}</span>}
                    {viewPassage.source && <span className="text-xs text-on-muted">Nguồn: {viewPassage.source}</span>}
                    {fmtDuration(viewPassage.duration_sec) && <span className="text-xs text-on-muted">{fmtDuration(viewPassage.duration_sec)}</span>}
                    <span className="text-xs text-on-muted">{viewPassage.question_count} câu hỏi</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTranscribe(viewPassage)}
                  disabled={transcribing === viewPassage.id}
                  title="Chép lời tự động (Whisper)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                    ${viewPassage.transcript_segments
                      ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                      : 'border-sky-400 bg-sky-500 text-white hover:bg-sky-600'}
                    disabled:opacity-50`}
                >
                  {transcribing === viewPassage.id ? (
                    <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Đang chép lời...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[15px]">closed_caption</span>
                    {viewPassage.transcript_segments ? 'Chép lại' : 'Chép lời tự động'}</>
                  )}
                </button>
                <button onClick={() => setViewPassage(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-muted">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {viewPassage.audio_url && (
                <SyncedTranscriptPlayer
                  audioUrl={viewPassage.audio_url}
                  segments={viewPassage.transcript_segments}
                  transcript={viewPassage.transcript}
                />
              )}
              {!viewPassage.audio_url && viewPassage.transcript && (
                <div>
                  <p className="text-xs font-bold text-on-muted uppercase tracking-wide mb-2">Transcript</p>
                  <p className="text-sm text-charcoal leading-loose whitespace-pre-wrap bg-surface-low rounded-xl p-4">{viewPassage.transcript}</p>
                </div>
              )}
              {viewPassage.description && (
                <p className="text-sm text-charcoal">{viewPassage.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editId ? 'Sửa bài nghe' : 'Thêm bài nghe mới'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <div className="space-y-4">
          <Input label="Tiêu đề (tùy chọn)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Hội thoại tại nhà hàng — N3" />

          {/* Audio upload */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">audio_file</span>
              File âm thanh / video *
            </label>
            {form.audio_url ? (
              <div className="space-y-2">
                <audio controls src={form.audio_url} className="w-full" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low rounded-lg text-xs font-semibold text-charcoal hover:bg-outline/30 border border-outline/40 transition-colors">
                    <span className="material-symbols-outlined text-[14px]">swap_horiz</span>Đổi file
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, audio_url: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-tsubaki-red hover:bg-red-50 border border-outline/40 transition-colors">
                    <span className="material-symbols-outlined text-[14px]">close</span>Xóa file
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                onClick={() => !uploading && fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                  ${uploading ? 'border-sky-400/50 bg-sky-50' : 'border-outline hover:border-sky-400 hover:bg-sky-50/30'}`}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-sky-600 font-semibold">Đang tải lên...</p>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-on-muted/40 block mb-2">audio_file</span>
                    <p className="text-sm font-semibold text-charcoal">Nhấn hoặc kéo thả file âm thanh vào đây</p>
                    <p className="text-xs text-on-muted mt-1">MP3, MP4, WAV, OGG, AAC, M4A, WebM — tối đa {MAX_AUDIO_MB}MB</p>
                  </>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="audio/*,video/mp4,video/webm" className="hidden" onChange={e => handleAudioSelect(e.target.files[0])} />
          </div>

          {/* Duration */}
          <Input label="Thời lượng (giây, tùy chọn)" type="number" value={form.duration_sec} onChange={e => setForm({ ...form, duration_sec: e.target.value })} placeholder="180 (= 3 phút)" />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1">Mô tả ngắn (tùy chọn)</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Tóm tắt nội dung bài nghe..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sky-400 resize-y transition-colors" />
          </div>

          {/* Transcript */}
          <div>
            <label className="block text-sm font-medium text-on-muted mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">subject</span>
              Transcript (tùy chọn)
              <span className="font-normal text-xs">— dùng để AI tạo câu hỏi</span>
            </label>
            <textarea value={form.transcript} onChange={e => setForm({ ...form, transcript: e.target.value })}
              rows={6} placeholder="Nhập nội dung lời thoại/transcript tiếng Nhật..."
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sky-400 resize-y transition-colors leading-loose" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ JLPT</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sky-400 transition-colors">
                <option value="">-- Không có --</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <Input label="Chủ đề" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Hội thoại, Du lịch..." />
          </div>
          <Input label="Nguồn (tùy chọn)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="JLPT N3 2023, Minna no Nihongo Chap 10..." />
        </div>
      </Modal>
    </>
  );
}

// ── AI Generate Modal ─────────────────────────────────────────────────────────
const Q_TYPE_OPTS = [
  { value: 'single_choice',   label: 'Chọn 1 đáp án',      icon: 'radio_button_checked', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  { value: 'multiple_choice', label: 'Chọn nhiều đáp án',   icon: 'check_box',            color: 'bg-violet-100 text-violet-700 border-violet-300' },
  { value: 'matching',        label: 'Nối kết quả',         icon: 'compare_arrows',       color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'ordering',        label: 'Sắp xếp thứ tự',     icon: 'sort',                 color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'fill_blank',      label: 'Điền vào chỗ trống',  icon: 'text_fields',          color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'short_answer',    label: 'Trả lời ngắn',        icon: 'edit_note',            color: 'bg-rose-100 text-rose-700 border-rose-300' },
];

function AIPreviewCard({ q, index, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const typeCfg = TYPE_MAP[q.question_type];
  const ca = q.correct_answer;

  return (
    <div className={`rounded-xl border-2 transition-all ${selected ? 'border-sumire-purple bg-sumire-purple/5' : 'border-outline/30 bg-white opacity-60'}`}>
      <div className="flex items-start gap-3 p-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-0.5 w-4 h-4 accent-sumire-purple shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1">
            {typeCfg && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${typeCfg.color}`}>
                <span className="material-symbols-outlined text-[11px]">{typeCfg.icon}</span>
                {typeCfg.label}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-bold border border-sumire-purple/20 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[10px]">auto_awesome</span>AI
            </span>
          </div>
          <p className="text-sm font-medium text-charcoal leading-snug">{q.question_text}</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="p-1 text-on-muted hover:text-charcoal transition-colors shrink-0">
          <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-outline/20 pt-2">
          {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && Array.isArray(q.options) && (
            <div className="flex flex-wrap gap-1">
              {q.options.map((opt, i) => {
                const isCorrect = q.question_type === 'single_choice'
                  ? opt === ca
                  : Array.isArray(ca) && ca.includes(opt);
                return (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold' : 'border-outline/40 text-on-muted'}`}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </span>
                );
              })}
            </div>
          )}
          {q.question_type === 'matching' && Array.isArray(q.options) && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((p, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">{p.left} → {p.right}</span>
              ))}
            </div>
          )}
          {q.question_type === 'ordering' && Array.isArray(ca) && (
            <div className="flex flex-wrap gap-1">
              {ca.map((item, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800">{i+1}. {item}</span>
              ))}
            </div>
          )}
          {(q.question_type === 'fill_blank' || q.question_type === 'short_answer') && ca && (
            <p className="text-xs text-emerald-700">Đáp án: <strong>{Array.isArray(ca) ? ca.join(', ') : ca}</strong></p>
          )}
          {q.explanation && <p className="text-xs text-on-muted italic">💡 {q.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function AIGenerateModal({ open, onClose, passages, listeningPassages, onSaved }) {
  const [step, setStep]   = useState('config'); // 'config' | 'loading' | 'results'
  const [error, setError] = useState('');
  const [config, setConfig] = useState({
    source: 'passage',
    passage_id: '',
    listening_passage_id: '',
    custom_content: '',
    question_types: ['single_choice', 'fill_blank'],
    count: 5,
    level: '', difficulty: 'medium', topic: '', skill: '',
  });
  const [results, setResults]   = useState([]);
  const [selected, setSelected] = useState({});
  const [saving, setSaving]     = useState(false);

  const setC = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const toggleType = (t) => setC('question_types',
    config.question_types.includes(t) ? config.question_types.filter(x => x !== t) : [...config.question_types, t]
  );

  const resetToConfig = () => { setStep('config'); setResults([]); setSelected({}); setError(''); };

  const handleClose = () => { resetToConfig(); onClose(); };

  const generate = async () => {
    if (!config.question_types.length) return setError('Chọn ít nhất 1 loại câu hỏi.');
    if (config.source === 'passage'   && !config.passage_id)           return setError('Chọn bài đọc.');
    if (config.source === 'listening' && !config.listening_passage_id) return setError('Chọn bài nghe.');
    if (config.source === 'custom'    && !config.custom_content.trim()) return setError('Nhập nội dung.');
    setStep('loading'); setError('');
    try {
      const body = {
        question_types: config.question_types,
        count:          config.count,
        level:          config.level     || undefined,
        difficulty:     config.difficulty,
        topic:          config.topic     || undefined,
        skill:          config.skill     || undefined,
      };
      if (config.source === 'passage')   body.passage_id           = config.passage_id;
      else if (config.source === 'listening') body.listening_passage_id = config.listening_passage_id;
      else                               body.custom_content       = config.custom_content;

      const r = await api.post('/admin/question-bank/ai-generate', body);
      const qs = r.data.questions || [];
      setResults(qs);
      setSelected(Object.fromEntries(qs.map((_, i) => [i, true])));
      setStep('results');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setStep('config');
    }
  };

  const saveAll = async () => {
    const toSave = results.filter((_, i) => selected[i]);
    if (!toSave.length) return setError('Chọn ít nhất 1 câu hỏi để lưu.');
    setSaving(true); setError('');
    try {
      await api.post('/admin/question-bank/bulk', { questions: toSave });
      onSaved(toSave.length);
      handleClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sumire-purple/10 flex items-center justify-center text-sumire-purple">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal">AI Tạo câu hỏi</h2>
              <p className="text-xs text-on-muted">
                {step === 'config'  && 'Cấu hình để AI tự động tạo câu hỏi'}
                {step === 'loading' && 'Đang tạo câu hỏi...'}
                {step === 'results' && `${results.length} câu hỏi được tạo — chọn để lưu vào ngân hàng`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-on-muted hover:text-charcoal transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Config ── */}
          {(step === 'config' || step === 'loading') && (
            <div className="p-5 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <span className="material-symbols-outlined text-lg shrink-0">error</span>{error}
                </div>
              )}

              {/* Source */}
              <div>
                <label className="block text-xs font-bold text-on-muted uppercase tracking-wide mb-2">Nguồn nội dung</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {[
                    { key: 'passage',   label: 'Bài đọc có sẵn',  icon: 'menu_book' },
                    { key: 'listening', label: 'Bài nghe có sẵn',  icon: 'headphones' },
                    { key: 'custom',    label: 'Nhập nội dung tự do', icon: 'edit_note' },
                  ].map(s => (
                    <button key={s.key} type="button" onClick={() => setC('source', s.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold flex-1 justify-center transition-all ${
                        config.source === s.key ? 'border-sumire-purple bg-sumire-purple/5 text-sumire-purple' : 'border-outline/40 text-on-muted hover:border-sumire-purple/40'
                      }`}>
                      <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
                {config.source === 'passage' && (
                  <select value={config.passage_id} onChange={e => setC('passage_id', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                    <option value="">— Chọn bài đọc —</option>
                    {passages.map(p => <option key={p.id} value={p.id}>{p.title || '(Không tiêu đề)'}{p.level ? ` [${p.level}]` : ''}</option>)}
                  </select>
                )}
                {config.source === 'listening' && (
                  <select value={config.listening_passage_id} onChange={e => setC('listening_passage_id', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                    <option value="">— Chọn bài nghe —</option>
                    {listeningPassages.map(p => <option key={p.id} value={p.id}>{p.title || '(Không tiêu đề)'}{p.level ? ` [${p.level}]` : ''}</option>)}
                  </select>
                )}
                {config.source === 'custom' && (
                  <textarea value={config.custom_content} onChange={e => setC('custom_content', e.target.value)}
                    rows={5} placeholder="Nhập đoạn văn/transcript tiếng Nhật hoặc chủ đề muốn tạo câu hỏi..."
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors resize-none leading-loose" />
                )}
              </div>

              {/* Question types */}
              <div>
                <label className="block text-xs font-bold text-on-muted uppercase tracking-wide mb-2">Loại câu hỏi cần tạo</label>
                <div className="flex flex-wrap gap-2">
                  {Q_TYPE_OPTS.map(t => {
                    const active = config.question_types.includes(t.value);
                    return (
                      <button key={t.value} type="button" onClick={() => toggleType(t.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          active ? `${t.color} shadow-sm` : 'border-outline/40 text-on-muted bg-white hover:border-outline'
                        }`}>
                        <span className="material-symbols-outlined text-[13px]">{t.icon}</span>
                        {t.label}
                        {active && <span className="material-symbols-outlined text-[13px]">check</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Count + metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-muted mb-1">Số câu hỏi</label>
                  <select value={config.count} onChange={e => setC('count', Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                    {[1,2,3,4,5,6,8,10].map(n => <option key={n} value={n}>{n} câu</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-muted mb-1">Trình độ</label>
                  <select value={config.level} onChange={e => setC('level', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                    <option value="">Không giới hạn</option>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-muted mb-1">Độ khó</label>
                  <select value={config.difficulty} onChange={e => setC('difficulty', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-muted mb-1">Kỹ năng</label>
                  <select value={config.skill} onChange={e => setC('skill', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors">
                    <option value="">Tất cả</option>
                    {SKILLS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-muted mb-1">Chủ đề (tuỳ chọn)</label>
                <input type="text" value={config.topic} onChange={e => setC('topic', e.target.value)}
                  placeholder="VD: Gia đình, Mua sắm, Giao thông..."
                  className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-sumire-purple transition-colors" />
              </div>
            </div>
          )}

          {/* ── Loading ── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-sumire-purple">
              <div className="relative">
                <span className="material-symbols-outlined text-5xl animate-spin">progress_activity</span>
                <span className="material-symbols-outlined text-2xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">auto_awesome</span>
              </div>
              <div className="text-center">
                <p className="font-semibold text-charcoal">Đang tạo {config.count} câu hỏi...</p>
                <p className="text-sm text-on-muted mt-1">AI đang phân tích nội dung và soạn câu hỏi</p>
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {step === 'results' && (
            <div className="p-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
                  <span className="material-symbols-outlined text-lg shrink-0">error</span>{error}
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-on-muted">{selectedCount}/{results.length} câu được chọn</p>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setSelected(Object.fromEntries(results.map((_, i) => [i, true])))} className="text-sumire-purple hover:underline">Chọn tất cả</button>
                  <span className="text-outline">|</span>
                  <button onClick={() => setSelected(Object.fromEntries(results.map((_, i) => [i, false])))} className="text-on-muted hover:text-charcoal hover:underline">Bỏ chọn</button>
                </div>
              </div>
              <div className="space-y-2">
                {results.map((q, i) => (
                  <AIPreviewCard key={i} q={q} index={i} selected={!!selected[i]} onToggle={() => setSelected(s => ({ ...s, [i]: !s[i] }))} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-outline/30 flex justify-between items-center shrink-0 gap-3">
          {step === 'config' && (
            <>
              <button onClick={handleClose} className="px-4 py-2 rounded-xl border border-outline text-sm text-on-muted hover:bg-surface-low transition-colors">Hủy</button>
              <button onClick={generate} disabled={step === 'loading'}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sumire-purple text-white text-sm font-semibold hover:bg-sumire-purple/90 transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Tạo {config.count} câu hỏi
              </button>
            </>
          )}
          {step === 'loading' && (
            <div className="flex-1 text-center text-sm text-on-muted">Vui lòng đợi trong giây lát...</div>
          )}
          {step === 'results' && (
            <>
              <button onClick={resetToConfig} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline text-sm text-on-muted hover:bg-surface-low transition-colors">
                <span className="material-symbols-outlined text-[16px]">refresh</span> Tạo lại
              </button>
              <button onClick={saveAll} disabled={saving || !selectedCount}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sumire-purple text-white text-sm font-semibold hover:bg-sumire-purple/90 transition-colors disabled:opacity-50">
                {saving ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                Lưu {selectedCount > 0 ? `${selectedCount} câu` : ''} vào ngân hàng
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminQuestionBank() {
  const [activeTab, setActiveTab] = useState('questions');
  const [items, setItems]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [stats, setStats]         = useState({ total: 0, pending: 0, topLevel: '—' });
  const [passages, setPassages]             = useState([]);
  const [listeningPassages, setListeningPassages] = useState([]);
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
  const [filterListeningPassage, setFilterListeningPassage] = useState('');

  const [formModal, setFormModal]     = useState(false);
  const [aiModal, setAiModal]         = useState(false);
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

  const fetchListeningPassages = useCallback(async () => {
    try { const r = await api.get('/admin/listening-passages'); setListeningPassages(r.data || []); } catch (_) {}
  }, []);

  const fetchItems = useCallback(async (p, l, sk, d, st, tp, pid, lpid, s) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (l)    params.set('level', l);
      if (sk)   params.set('skill', sk);
      if (d)    params.set('difficulty', d);
      if (st)   params.set('status', st);
      if (tp)   params.set('question_type', tp);
      if (pid)  params.set('passage_id', pid);
      if (lpid) params.set('listening_passage_id', lpid);
      if (s)    params.set('search', s);
      const r = await api.get(`/admin/question-bank?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPassages();
    fetchListeningPassages();
    fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, filterListeningPassage, search);
  }, [page, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, filterListeningPassage]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchItems(1, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, filterListeningPassage, val);
    }, 400);
  };

  const resetFilters = () => {
    setSearch(''); setFilterLevel(''); setFilterSkill(''); setFilterDiff('');
    setFilterStatus(''); setFilterType(''); setFilterPassage(''); setFilterListeningPassage(''); setPage(1);
    fetchItems(1, '', '', '', '', '', '', '', '');
  };

  const refresh = () => {
    fetchStats(); fetchPassages(); fetchListeningPassages();
    fetchItems(page, filterLevel, filterSkill, filterDiff, filterStatus, filterType, filterPassage, filterListeningPassage, search);
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

  const hasFilters = filterLevel || filterSkill || filterDiff || filterStatus || filterType || filterPassage || filterListeningPassage || search;
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
        {activeTab === 'questions' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setAiModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-sumire-purple text-sumire-purple text-sm font-semibold hover:bg-sumire-purple hover:text-white transition-all">
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
              AI Tạo câu hỏi
            </button>
            <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span>Thêm câu hỏi</Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="library_books"          label="Tổng câu hỏi"  value={stats.total.toLocaleString()} iconBg="bg-surface-low text-on-muted" />
        <StatCard icon="notification_important" label="Chờ duyệt"      value={stats.pending} accent="border-l-4 border-l-tsubaki-red" iconBg="bg-red-50 text-tsubaki-red" />
        <StatCard icon="menu_book"              label="Bài đọc"        value={passages.length} iconBg="bg-amber-50 text-amber-600" />
        <StatCard icon="headphones"             label="Bài nghe"       value={listeningPassages.length} iconBg="bg-sky-50 text-sky-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-outline/30">
        {[
          { key: 'questions',  label: 'Câu hỏi',  icon: 'help' },
          { key: 'passages',   label: 'Bài đọc',   icon: 'menu_book' },
          { key: 'listening',  label: 'Bài nghe',  icon: 'headphones' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors
              ${activeTab === tab.key ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
            {tab.key === 'passages' && passages.length > 0 && (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{passages.length}</span>
            )}
            {tab.key === 'listening' && listeningPassages.length > 0 && (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold">{listeningPassages.length}</span>
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
        <button onClick={() => setAiModal(true)} className="w-full text-left glass-card rounded-2xl p-5 border-l-4 border-l-sumire-purple relative overflow-hidden hover:shadow-lg transition-shadow group">
          <div className="absolute -right-4 -top-4 opacity-[0.06] pointer-events-none group-hover:opacity-[0.10] transition-opacity">
            <span className="material-symbols-outlined text-[120px] text-sumire-purple">auto_awesome</span>
          </div>
          <div className="flex items-start gap-4 relative">
            <div className="w-10 h-10 rounded-full bg-sumire-purple/10 flex items-center justify-center text-sumire-purple shrink-0 group-hover:bg-sumire-purple/20 transition-colors">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-charcoal mb-1">AI Tạo câu hỏi tự động</h4>
              <p className="text-sm text-on-muted max-w-2xl">
                Ngân hàng hiện có <strong className="text-charcoal">{stats.total}</strong> câu hỏi và <strong className="text-charcoal">{passages.length}</strong> bài đọc.
                {stats.pending > 0 && <> Còn <strong className="text-amber-600">{stats.pending} câu chờ duyệt</strong>.</>}
                {' '}Nhấp vào đây để tạo hàng loạt câu hỏi từ bài đọc hoặc nội dung bất kỳ.
              </p>
            </div>
            <span className="material-symbols-outlined text-sumire-purple/50 group-hover:text-sumire-purple transition-colors text-2xl shrink-0">arrow_forward</span>
          </div>
        </button>
      </>)}

      {/* ─────── PASSAGES TAB ─────── */}
      {activeTab === 'passages' && (
        <PassagesTab passages={passages} onRefresh={refresh} setAlert={setAlert} />
      )}

      {/* ─────── LISTENING TAB ─────── */}
      {activeTab === 'listening' && (
        <ListeningPassagesTab passages={listeningPassages} onRefresh={refresh} setAlert={setAlert} />
      )}

      {/* Preview modal */}
      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}

      {/* Create / Edit modal */}
      <Modal open={formModal} onClose={() => setFormModal(false)}
        title={editId ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}
        footer={<><Button variant="secondary" onClick={() => setFormModal(false)}>Hủy</Button><Button loading={saving} onClick={handleSave}>Lưu</Button></>}>
        <QuestionForm form={form} setForm={setForm} passages={passages} listeningPassages={listeningPassages} />
      </Modal>

      {/* AI Generate modal */}
      <AIGenerateModal
        open={aiModal}
        onClose={() => setAiModal(false)}
        passages={passages}
        listeningPassages={listeningPassages}
        onSaved={(count) => {
          setAlert({ type: 'success', msg: `Đã lưu ${count} câu hỏi AI vào ngân hàng.` });
          refresh();
        }}
      />
    </AdminLayout>
  );
}
