// Shared constants and helpers for question bank + quiz question forms

export const QUESTION_TYPES = [
  { value: 'single_choice',   label: 'Chọn 1 đáp án',      icon: 'radio_button_checked', color: 'bg-sky-100 text-sky-700' },
  { value: 'multiple_choice', label: 'Chọn nhiều đáp án',   icon: 'check_box',            color: 'bg-violet-100 text-violet-700' },
  { value: 'matching',        label: 'Nối kết quả',         icon: 'compare_arrows',       color: 'bg-amber-100 text-amber-700' },
  { value: 'ordering',        label: 'Sắp xếp thứ tự',     icon: 'sort',                 color: 'bg-orange-100 text-orange-700' },
  { value: 'fill_blank',      label: 'Điền vào chỗ trống',  icon: 'text_fields',          color: 'bg-emerald-100 text-emerald-700' },
  { value: 'short_answer',    label: 'Trả lời ngắn',        icon: 'edit_note',            color: 'bg-rose-100 text-rose-700' },
];
export const TYPE_MAP = Object.fromEntries(QUESTION_TYPES.map(t => [t.value, t]));

export const LEVELS       = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const SKILLS       = ['Đọc hiểu', 'Nghe hiểu', 'Nói', 'Viết'];
export const DIFFICULTIES = [{ value: 'easy', label: 'Dễ' }, { value: 'medium', label: 'Trung bình' }, { value: 'hard', label: 'Khó' }];
export const STATUSES     = [{ value: 'pending', label: 'Chờ duyệt' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'draft', label: 'Nháp' }];

export const LEVEL_COLORS = {
  N5: 'bg-emerald-500 text-white', N4: 'bg-sky-500 text-white',
  N3: 'bg-violet-500 text-white',  N2: 'bg-orange-500 text-white', N1: 'bg-tsubaki-red text-white',
};
export const SKILL_ICONS  = { 'Đọc hiểu': 'menu_book', 'Nghe hiểu': 'headphones', 'Nói': 'record_voice_over', 'Viết': 'edit_note' };
export const DIFF_COLORS  = { easy: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-red-100 text-red-700' };
export const STATUS_CFG   = {
  approved: { label: 'Đã duyệt', icon: 'check_circle', cls: 'text-emerald-600' },
  pending:  { label: 'Chờ duyệt', icon: 'pending',      cls: 'text-amber-600' },
  draft:    { label: 'Nháp',      icon: 'draft',         cls: 'text-on-muted' },
};

// ── Form state ────────────────────────────────────────────────────────────────
export const EMPTY_Q_FORM = {
  question_type: 'single_choice',
  question_text: '',
  options: ['', '', '', ''],
  correct_answer_single: '',
  correct_answers_multi: [],
  matching_pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
  ordering_items: ['', '', '', ''],
  fill_blank_answers: '',
  correct_answer_short: '',
  explanation: '',
  level: '', skill: '', topic: '', difficulty: 'medium',
};

// Convert a DB row → form state
export function rowToForm(row) {
  const typ = row.question_type || row.type || 'single_choice';
  const base = {
    ...EMPTY_Q_FORM,
    question_type: typ,
    question_text: row.question_text || row.question || '',
    explanation:   row.explanation   || '',
    level:         row.level         || '',
    skill:         row.skill         || '',
    topic:         row.topic         || '',
    difficulty:    row.difficulty    || 'medium',
  };
  // correct_answer may live in correct_answer (text) or correct_answer_data (jsonb)
  const ca  = row.correct_answer_data ?? row.correct_answer;
  const opts = row.options;
  switch (typ) {
    case 'single_choice':
      return { ...base, options: [...(Array.isArray(opts) ? opts : []), '', '', '', ''].slice(0, 4), correct_answer_single: typeof ca === 'string' ? ca : '' };
    case 'multiple_choice':
      return { ...base, options: [...(Array.isArray(opts) ? opts : []), '', '', '', ''].slice(0, 4), correct_answers_multi: Array.isArray(ca) ? ca : [] };
    case 'matching':
      return { ...base, matching_pairs: Array.isArray(opts) && opts.length ? opts.map(p => ({ left: p.left || '', right: p.right || '' })) : EMPTY_Q_FORM.matching_pairs };
    case 'ordering':
      return { ...base, ordering_items: Array.isArray(ca) && ca.length ? [...ca, '', ''] : EMPTY_Q_FORM.ordering_items };
    case 'fill_blank': {
      const a = ca; return { ...base, fill_blank_answers: Array.isArray(a) ? a.join(', ') : (a || '') };
    }
    case 'short_answer':
      return { ...base, correct_answer_short: typeof ca === 'string' ? ca : '' };
    default: return base;
  }
}

// Convert form state → API payload
export function formToPayload(form) {
  const base = {
    question_type: form.question_type,
    question_text: form.question_text,
    explanation:   form.explanation,
    level: form.level, skill: form.skill, topic: form.topic, difficulty: form.difficulty,
  };
  switch (form.question_type) {
    case 'single_choice':
      return { ...base, options: form.options.filter(Boolean), correct_answer: form.correct_answer_single, correct_answer_data: null };
    case 'multiple_choice':
      return { ...base, options: form.options.filter(Boolean), correct_answer: null, correct_answer_data: form.correct_answers_multi };
    case 'matching': {
      const pairs = form.matching_pairs.filter(p => p.left.trim() && p.right.trim());
      return { ...base, options: pairs, correct_answer: null, correct_answer_data: Object.fromEntries(pairs.map(p => [p.left, p.right])) };
    }
    case 'ordering': {
      const items = form.ordering_items.filter(Boolean);
      return { ...base, options: items, correct_answer: null, correct_answer_data: items };
    }
    case 'fill_blank': {
      const answers = form.fill_blank_answers.split(',').map(s => s.trim()).filter(Boolean);
      const val = answers.length === 1 ? answers[0] : answers;
      return { ...base, options: [], correct_answer: typeof val === 'string' ? val : null, correct_answer_data: Array.isArray(val) ? val : null };
    }
    case 'short_answer':
      return { ...base, options: [], correct_answer: form.correct_answer_short || null, correct_answer_data: null };
    default:
      return base;
  }
}

