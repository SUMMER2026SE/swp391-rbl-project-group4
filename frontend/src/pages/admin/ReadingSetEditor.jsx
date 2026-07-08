import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS     = ['N5','N4','N3','N2','N1'];
const DIFFICULTIES = [{ value: 'easy', label: 'Dễ' }, { value: 'medium', label: 'Trung bình' }, { value: 'hard', label: 'Khó' }];
const Q_TYPES    = [
  { value: 'single_choice',   label: 'Chọn 1 đáp án' },
  { value: 'multiple_choice', label: 'Chọn nhiều đáp án' },
  { value: 'fill_blank',      label: 'Điền vào chỗ trống' },
  { value: 'short_answer',    label: 'Trả lời ngắn' },
  { value: 'true_false',      label: 'Đúng / Sai' },
];
const LEVEL_GUIDE = { N5: [50,150], N4: [100,300], N3: [200,600], N2: [400,1000], N1: [600,1500] };
const DEFAULT_OPTIONS = () => [
  { id: tempId(), option_text: '', is_correct: false, sort_order: 0 },
  { id: tempId(), option_text: '', is_correct: false, sort_order: 1 },
  { id: tempId(), option_text: '', is_correct: false, sort_order: 2 },
  { id: tempId(), option_text: '', is_correct: false, sort_order: 3 },
];
const TF_OPTIONS = () => [
  { id: tempId(), option_text: '正しい（Đúng）', is_correct: false, sort_order: 0 },
  { id: tempId(), option_text: '正しくない（Sai）', is_correct: false, sort_order: 1 },
];

function tempId() { return 'temp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function newPassage(sort_order = 0) {
  return {
    id: tempId(), title: '', content: '', note: '', sort_order,
    needs_review: false,
    questions: [],
  };
}

function newQuestion(sort_order = 0) {
  return {
    id: tempId(), question_type: 'single_choice', question_text: '', explanation: '',
    skill_tags: [], sort_order, needs_review: false,
    options: DEFAULT_OPTIONS(),
  };
}

const EMPTY_RS = {
  title: '', code: '', jlpt_level: 'N4', difficulty: 'medium', topic: '',
  short_description: '', instructions: '', estimated_time_minutes: null,
  source_type: 'manual', status: 'draft', tags: [], passages: [],
};

// ── Utility ───────────────────────────────────────────────────────────────────

function immSet(arr, idx, updater) {
  return arr.map((item, i) => i === idx ? (typeof updater === 'function' ? updater(item) : { ...item, ...updater }) : item);
}
function immDel(arr, idx) { return arr.filter((_, i) => i !== idx); }
function immMove(arr, idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= arr.length) return arr;
  const next = [...arr];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

// ── Validation ────────────────────────────────────────────────────────────────

function clientValidate(rs) {
  const errors = [];
  if (!rs.title?.trim())    errors.push({ msg: 'Thiếu tiêu đề.', path: 'title' });
  if (!rs.jlpt_level)       errors.push({ msg: 'Chưa chọn cấp JLPT.', path: 'jlpt_level' });
  if (!rs.passages.length)  errors.push({ msg: 'Cần ít nhất 1 đoạn văn.', path: 'passages' });
  rs.passages.forEach((p, pi) => {
    if (!p.content?.trim() || p.content.trim().length < 10)
      errors.push({ msg: `Đoạn ${pi+1}: nội dung quá ngắn.`, path: `passage_${pi}` });
    if (!p.questions.length)
      errors.push({ msg: `Đoạn ${pi+1}: cần ít nhất 1 câu hỏi.`, path: `passage_${pi}_q` });
    p.questions.forEach((q, qi) => {
      if (!q.question_text?.trim())
        errors.push({ msg: `Đoạn ${pi+1} · Câu ${qi+1}: thiếu nội dung câu hỏi.`, path: `q_${pi}_${qi}` });
      if (['single_choice','multiple_choice','true_false'].includes(q.question_type)) {
        if (!q.options.some(o => o.is_correct))
          errors.push({ msg: `Đoạn ${pi+1} · Câu ${qi+1}: chưa đánh dấu đáp án đúng.`, path: `q_${pi}_${qi}_ans` });
      }
    });
  });
  return errors;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionRow({ opt, idx, qType, onUpdate, onDelete, onSetCorrect, canDelete }) {
  const isChoice = qType === 'single_choice' || qType === 'true_false';
  const isMulti  = qType === 'multiple_choice';
  const label    = String.fromCharCode(65 + idx); // A, B, C, D...

  return (
    <div className="flex items-start gap-2 group">
      {/* Correct marker */}
      {isChoice && (
        <input type="radio" checked={opt.is_correct} onChange={() => onSetCorrect(idx)}
          className="mt-2.5 accent-emerald-500 cursor-pointer" />
      )}
      {isMulti && (
        <input type="checkbox" checked={opt.is_correct} onChange={() => onUpdate(idx, 'is_correct', !opt.is_correct)}
          className="mt-2.5 accent-emerald-500 cursor-pointer" />
      )}
      <span className="mt-2 text-xs font-bold text-on-muted w-4 shrink-0">{label}</span>
      <input
        value={opt.option_text}
        onChange={e => onUpdate(idx, 'option_text', e.target.value)}
        placeholder={`Lựa chọn ${label}`}
        className={`flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:border-tsubaki-red transition-colors ${opt.is_correct ? 'border-emerald-400 bg-emerald-50/50' : 'border-outline'}`}
      />
      {canDelete && (
        <button onClick={() => onDelete(idx)}
          className="mt-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-all">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  );
}

function QuestionCard({ q, qIdx, passageIdx, rs, onUpdate, onDelete, onMove, onDuplicate, totalQ }) {
  const [collapsed, setCollapsed] = useState(false);
  const canHaveOptions = ['single_choice','multiple_choice','true_false'].includes(q.question_type);

  const updateField = (field, val) => onUpdate(passageIdx, qIdx, field, val);
  const updateOption = (oIdx, field, val) => {
    const opts = immSet(q.options, oIdx, { [field]: val });
    updateField('options', opts);
  };
  const setCorrect = (oIdx) => {
    const isSingle = q.question_type === 'single_choice' || q.question_type === 'true_false';
    const opts = q.options.map((o, i) => ({ ...o, is_correct: isSingle ? i === oIdx : i === oIdx ? !o.is_correct : o.is_correct }));
    updateField('options', opts);
  };
  const deleteOption = (oIdx) => {
    if (q.options.length <= 2) return;
    updateField('options', immDel(q.options, oIdx));
  };
  const addOption = () => {
    updateField('options', [...q.options, { id: tempId(), option_text: '', is_correct: false, sort_order: q.options.length }]);
  };

  const handleTypeChange = (newType) => {
    let opts = q.options;
    if (newType === 'true_false') opts = TF_OPTIONS();
    else if (!['single_choice','multiple_choice'].includes(newType)) opts = [];
    else if (!opts.length) opts = DEFAULT_OPTIONS();
    onUpdate(passageIdx, qIdx, 'question_type', newType);
    onUpdate(passageIdx, qIdx, 'options', opts);
  };

  const hasError = !q.question_text?.trim() || (canHaveOptions && !q.options.some(o => o.is_correct));

  return (
    <div className={`border rounded-xl bg-white transition-all ${hasError && rs.touched ? 'border-red-300' : q.needs_review ? 'border-amber-300 bg-amber-50/20' : 'border-outline/50'}`}>
      {/* Question header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline/20">
        <span className="text-xs font-bold text-on-muted w-6 shrink-0 text-center bg-surface rounded px-1">
          {qIdx + 1}
        </span>
        <select value={q.question_type} onChange={e => handleTypeChange(e.target.value)}
          className="text-xs border border-outline/50 rounded px-2 py-1 focus:outline-none focus:border-tsubaki-red bg-white">
          {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {q.needs_review && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs" style={{fontSize:12}}>warning</span>
            Cần xem lại
          </span>
        )}
        <div className="flex items-center gap-0.5 ml-auto">
          <button onClick={() => onMove(passageIdx, qIdx, -1)} disabled={qIdx === 0}
            className="p-1 rounded hover:bg-surface-low text-on-muted disabled:opacity-30" title="Lên">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
          </button>
          <button onClick={() => onMove(passageIdx, qIdx, 1)} disabled={qIdx === totalQ - 1}
            className="p-1 rounded hover:bg-surface-low text-on-muted disabled:opacity-30" title="Xuống">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
          </button>
          <button onClick={() => onDuplicate(passageIdx, qIdx)}
            className="p-1 rounded hover:bg-surface-low text-on-muted" title="Nhân đôi">
            <span className="material-symbols-outlined text-sm">content_copy</span>
          </button>
          <button onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded hover:bg-surface-low text-on-muted" title={collapsed ? 'Mở rộng' : 'Thu gọn'}>
            <span className="material-symbols-outlined text-sm">{collapsed ? 'expand_more' : 'expand_less'}</span>
          </button>
          <button onClick={() => onDelete(passageIdx, qIdx)}
            className="p-1 rounded hover:bg-red-50 text-red-400" title="Xóa câu hỏi">
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {/* Question text */}
          <textarea
            value={q.question_text}
            onChange={e => updateField('question_text', e.target.value)}
            placeholder="Nhập câu hỏi..."
            rows={2}
            className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red resize-none"
          />

          {/* Fill blank hint */}
          {q.question_type === 'fill_blank' && (
            <p className="text-xs text-on-muted bg-blue-50 border border-blue-200 rounded px-2 py-1">
              💡 Dùng <code className="bg-blue-100 px-1 rounded">___</code> trong câu hỏi để đánh dấu chỗ trống.
            </p>
          )}

          {/* Options */}
          {canHaveOptions && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-on-muted mb-1">Lựa chọn (click radio/checkbox để đánh dấu đáp án đúng)</div>
              {q.options.map((o, oi) => (
                <OptionRow key={o.id || oi} opt={o} idx={oi} qType={q.question_type}
                  onUpdate={updateOption} onDelete={deleteOption} onSetCorrect={setCorrect}
                  canDelete={q.question_type !== 'true_false' && q.options.length > 2} />
              ))}
              {q.question_type !== 'true_false' && q.options.length < 6 && (
                <button onClick={addOption}
                  className="text-xs text-tsubaki-red hover:text-tsubaki-red/80 flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Thêm lựa chọn
                </button>
              )}
            </div>
          )}

          {/* Short answer hint */}
          {q.question_type === 'short_answer' && (
            <textarea
              value={q.explanation}
              onChange={e => updateField('explanation', e.target.value)}
              placeholder="Đáp án mẫu / giải thích..."
              rows={2}
              className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red resize-none"
            />
          )}

          {/* Explanation (for choice types) */}
          {q.question_type !== 'short_answer' && (
            <div>
              <label className="text-xs text-on-muted block mb-1">Giải thích đáp án (tùy chọn)</label>
              <textarea
                value={q.explanation || ''}
                onChange={e => updateField('explanation', e.target.value)}
                placeholder="Giải thích tại sao đáp án này đúng..."
                rows={2}
                className="w-full px-3 py-2 border border-outline/50 rounded-lg text-sm focus:outline-none focus:border-tsubaki-red resize-none text-on-muted"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PassageCard({ p, pIdx, rs, total, onUpdatePassage, onDeletePassage, onMovePassage, onDuplicatePassage,
  onAddQuestion, onDeleteQuestion, onMoveQuestion, onDuplicateQuestion, onUpdateQuestion, isActive, onSetActive }) {
  const guide = LEVEL_GUIDE[rs.jlpt_level];
  const charCount = (p.content || '').length;
  const [noteOpen, setNoteOpen] = useState(false);

  const charStatus = guide
    ? charCount < guide[0] ? 'short' : charCount > guide[1] ? 'long' : 'ok'
    : 'ok';

  return (
    <div id={`passage-${pIdx}`} className={`border-2 rounded-2xl overflow-hidden transition-all ${isActive ? 'border-tsubaki-red shadow-lg shadow-tsubaki-red/10' : 'border-outline/30'}`}>
      {/* Passage header */}
      <div
        onClick={() => onSetActive(pIdx)}
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isActive ? 'bg-tsubaki-red/5' : 'bg-surface/40 hover:bg-surface-low/50'}`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-tsubaki-red text-white text-sm font-bold shrink-0">
          {pIdx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <input
            value={p.title || ''}
            onChange={e => { e.stopPropagation(); onUpdatePassage(pIdx, 'title', e.target.value); }}
            onClick={e => e.stopPropagation()}
            placeholder={`Tiêu đề đoạn ${pIdx + 1} (không bắt buộc)`}
            className="w-full text-sm font-semibold bg-transparent border-0 outline-none placeholder:text-on-muted/60"
          />
          <div className="text-xs text-on-muted flex items-center gap-2 mt-0.5">
            <span>{charCount} ký tự</span>
            {guide && <span className={`font-medium ${charStatus === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>
              (chuẩn {rs.jlpt_level}: {guide[0]}–{guide[1]})
            </span>}
            <span>·</span>
            <span>{p.questions.length} câu hỏi</span>
          </div>
        </div>
        {p.needs_review && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">Cần xem lại</span>
        )}
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMovePassage(pIdx, -1)} disabled={pIdx === 0}
            className="p-1 rounded hover:bg-surface-low disabled:opacity-30 text-on-muted" title="Lên">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
          </button>
          <button onClick={() => onMovePassage(pIdx, 1)} disabled={pIdx === total - 1}
            className="p-1 rounded hover:bg-surface-low disabled:opacity-30 text-on-muted" title="Xuống">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
          </button>
          <button onClick={() => onDuplicatePassage(pIdx)}
            className="p-1 rounded hover:bg-surface-low text-on-muted" title="Nhân đôi đoạn">
            <span className="material-symbols-outlined text-sm">content_copy</span>
          </button>
          <button onClick={() => { if (confirm(`Xóa đoạn ${pIdx+1}?`)) onDeletePassage(pIdx); }}
            className="p-1 rounded hover:bg-red-50 text-red-400" title="Xóa đoạn">
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>

      {/* Passage content */}
      <div className="p-4 space-y-4">
        {/* Content textarea */}
        <div>
          <label className="text-xs font-semibold text-on-muted block mb-1.5">Nội dung đoạn văn (tiếng Nhật)</label>
          <textarea
            value={p.content}
            onChange={e => onUpdatePassage(pIdx, 'content', e.target.value)}
            placeholder="Nhập đoạn văn tiếng Nhật tại đây..."
            rows={8}
            className="w-full px-3 py-3 border border-outline rounded-xl text-sm focus:outline-none focus:border-tsubaki-red resize-y font-sans leading-relaxed"
            style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
          />
          {/* Char progress bar */}
          {guide && (
            <div className="mt-1.5">
              <div className="h-1.5 rounded-full bg-outline/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${charStatus === 'ok' ? 'bg-emerald-400' : charStatus === 'short' ? 'bg-amber-400' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(100, (charCount / guide[1]) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Note toggle */}
        <button onClick={() => setNoteOpen(n => !n)}
          className="text-xs text-on-muted hover:text-tsubaki-red flex items-center gap-1 transition-colors">
          <span className="material-symbols-outlined text-sm">{noteOpen ? 'expand_less' : 'expand_more'}</span>
          Ghi chú / dịch nghĩa (tùy chọn)
        </button>
        {noteOpen && (
          <textarea
            value={p.note || ''}
            onChange={e => onUpdatePassage(pIdx, 'note', e.target.value)}
            placeholder="Ghi chú dịch nghĩa, giải thích từ khó..."
            rows={3}
            className="w-full px-3 py-2 border border-outline/50 rounded-xl text-sm focus:outline-none focus:border-tsubaki-red resize-none text-on-muted"
          />
        )}

        {/* Questions section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-tsubaki-red">quiz</span>
              Câu hỏi ({p.questions.length})
            </h4>
            <button
              onClick={() => onAddQuestion(pIdx)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-tsubaki-red/10 text-tsubaki-red rounded-lg text-xs font-semibold hover:bg-tsubaki-red/20 transition-colors">
              <span className="material-symbols-outlined text-sm">add</span>
              Thêm câu hỏi
            </button>
          </div>

          {p.questions.length === 0 ? (
            <button
              onClick={() => onAddQuestion(pIdx)}
              className="w-full border-2 border-dashed border-outline/40 rounded-xl py-8 text-center text-on-muted hover:border-tsubaki-red/40 hover:text-tsubaki-red transition-colors">
              <span className="material-symbols-outlined text-2xl block mb-1">add_circle</span>
              <span className="text-sm">Thêm câu hỏi đầu tiên cho đoạn này</span>
            </button>
          ) : (
            <div className="space-y-3">
              {p.questions.map((q, qi) => (
                <QuestionCard
                  key={q.id || qi}
                  q={q} qIdx={qi} passageIdx={pIdx} rs={rs}
                  totalQ={p.questions.length}
                  onUpdate={onUpdateQuestion}
                  onDelete={onDeleteQuestion}
                  onMove={onMoveQuestion}
                  onDuplicate={onDuplicateQuestion}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────

function PreviewPanel({ rs, onClose }) {
  const [answers, setAnswers] = useState({});

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-outline/20 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <div>
            <span className="text-xs font-bold text-tsubaki-red uppercase tracking-widest">Preview — Giao diện học sinh</span>
            <h2 className="font-display font-bold text-lg mt-0.5">{rs.title || 'Chưa có tiêu đề'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            {rs.jlpt_level && <span className="px-2.5 py-1 bg-tsubaki-red/10 text-tsubaki-red rounded-full text-xs font-bold">{rs.jlpt_level}</span>}
            {rs.topic && <span className="px-2.5 py-1 bg-surface rounded-full text-xs text-on-muted">{rs.topic}</span>}
            {rs.estimated_time_minutes && <span className="px-2.5 py-1 bg-surface rounded-full text-xs text-on-muted">⏱ {rs.estimated_time_minutes} phút</span>}
          </div>

          {rs.instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
              <strong>Hướng dẫn:</strong> {rs.instructions}
            </div>
          )}

          {/* Passages + questions */}
          {rs.passages.map((p, pi) => (
            <div key={p.id || pi} className="space-y-4">
              {/* Divider */}
              {pi > 0 && <div className="border-t-2 border-dashed border-outline/30 pt-4" />}
              {p.title && <h3 className="font-semibold text-base">{p.title}</h3>}

              {/* Passage text */}
              <div className="bg-surface/60 rounded-xl px-5 py-4">
                <pre className="text-sm leading-loose whitespace-pre-wrap font-sans"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}>
                  {p.content || <span className="text-on-muted italic">Chưa có nội dung đoạn văn</span>}
                </pre>
              </div>

              {/* Questions */}
              <div className="space-y-5">
                {p.questions.map((q, qi) => {
                  const qKey = `${pi}-${qi}`;
                  return (
                    <div key={q.id || qi} className="bg-white border border-outline/30 rounded-xl p-4">
                      <p className="font-medium text-sm mb-3">
                        <span className="text-tsubaki-red font-bold mr-1.5">問{qi + 1}</span>
                        {q.question_text || <em className="text-on-muted">Câu hỏi chưa nhập</em>}
                      </p>
                      {['single_choice','multiple_choice','true_false'].includes(q.question_type) && (
                        <div className="space-y-2">
                          {q.options.filter(o => o.option_text).map((o, oi) => (
                            <label key={oi} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${answers[qKey] === oi ? (o.is_correct ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-outline/30 hover:bg-surface-low'}`}>
                              <input
                                type={q.question_type === 'multiple_choice' ? 'checkbox' : 'radio'}
                                name={`prev-q-${qKey}`}
                                onChange={() => setAnswers(a => ({ ...a, [qKey]: oi }))}
                                className="accent-tsubaki-red"
                              />
                              <span className="text-sm">{o.option_text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {q.question_type === 'fill_blank' && (
                        <input placeholder="Nhập đáp án..." className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none" />
                      )}
                      {q.question_type === 'short_answer' && (
                        <textarea rows={2} placeholder="Nhập câu trả lời..." className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none resize-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {rs.passages.length === 0 && (
            <div className="text-center py-12 text-on-muted">
              <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">article</span>
              Chưa có nội dung để preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI Generate Modal ─────────────────────────────────────────────────────────

function AIModal({ defaultLevel, onClose, onApply }) {
  const [form, setForm] = useState({
    jlpt_level: defaultLevel || 'N4',
    topic: '',
    passage_count: 1,
    questions_per_passage: 5,
    question_types: ['single_choice'],
    custom_instructions: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleQType = (t) => {
    setForm(f => ({
      ...f,
      question_types: f.question_types.includes(t)
        ? f.question_types.filter(x => x !== t)
        : [...f.question_types, t],
    }));
  };

  const handleGenerate = async () => {
    if (!form.question_types.length) { setError('Chọn ít nhất 1 dạng câu hỏi.'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/admin/reading-sets/ai-generate', form);
      onApply(data.draft);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-outline/20 flex items-center justify-between">
          <h3 className="font-display font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-500">auto_awesome</span>
            Tạo bài đọc bằng AI
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-low">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-on-muted block mb-1">Cấp JLPT *</label>
              <select value={form.jlpt_level} onChange={e => setForm(f => ({ ...f, jlpt_level: e.target.value }))}
                className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red">
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted block mb-1">Chủ đề</label>
              <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                placeholder="VD: Du lịch, Ẩm thực..."
                className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted block mb-1">Số đoạn văn</label>
              <select value={form.passage_count} onChange={e => setForm(f => ({ ...f, passage_count: +e.target.value }))}
                className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red">
                {[1,2,3].map(n => <option key={n} value={n}>{n} đoạn</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted block mb-1">Câu hỏi / đoạn</label>
              <select value={form.questions_per_passage} onChange={e => setForm(f => ({ ...f, questions_per_passage: +e.target.value }))}
                className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red">
                {[3,4,5,6,7].map(n => <option key={n} value={n}>{n} câu</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-muted block mb-1.5">Dạng câu hỏi</label>
            <div className="flex flex-wrap gap-2">
              {Q_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => toggleQType(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.question_types.includes(t.value) ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline text-on-muted hover:bg-surface-low'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-muted block mb-1">Yêu cầu thêm (tùy chọn)</label>
            <textarea value={form.custom_instructions} onChange={e => setForm(f => ({ ...f, custom_instructions: e.target.value }))}
              placeholder="VD: Tập trung vào từ vựng về thời tiết, câu hỏi suy luận..."
              rows={2} className="w-full px-3 py-2 border border-outline rounded-lg text-sm focus:outline-none focus:border-tsubaki-red resize-none" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-outline rounded-lg text-sm font-medium hover:bg-surface-low">
            Hủy
          </button>
          <button onClick={handleGenerate} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang tạo...</>
            ) : (
              <><span className="material-symbols-outlined text-sm">auto_awesome</span> Tạo bài đọc</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────

export default function ReadingSetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [rs, setRs]           = useState({ ...EMPTY_RS, passages: [] });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [activePassage, setActivePassage] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showAI, setShowAI]           = useState(false);
  const [metaOpen, setMetaOpen]       = useState(true);
  const [validErrs, setValidErrs]     = useState([]);
  const autoSaveRef = useRef(null);
  const isDirtyRef  = useRef(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    api.get(`/admin/reading-sets/${id}`)
      .then(r => { setRs(r.data.readingSet); setLastSaved(new Date(r.data.readingSet.updated_at)); })
      .catch(e => setLoadErr(e.message));
  }, [id, isNew]);

  // ── Autosave (5s debounce after changes, only for existing sets) ─────────────
  useEffect(() => {
    if (isNew || !isDirtyRef.current) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (rs.title?.trim()) performSave(false);
    }, 5000);
    return () => clearTimeout(autoSaveRef.current);
  }, [rs]);

  // Mark dirty on changes
  const setRsAndMark = useCallback((updater) => {
    isDirtyRef.current = true;
    setRs(updater);
    setSaveErr('');
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────────
  const performSave = async (showStatus = true) => {
    setSaving(true); setSaveErr('');
    try {
      if (isNew) {
        const { data } = await api.post('/admin/reading-sets', rs);
        const newId = data.readingSet.id;
        setRs(data.readingSet);
        setLastSaved(new Date());
        isDirtyRef.current = false;
        navigate(`/admin/reading-sets/${newId}/edit`, { replace: true });
      } else {
        const { data } = await api.put(`/admin/reading-sets/${id}`, rs);
        setRs(data.readingSet);
        setLastSaved(new Date());
        isDirtyRef.current = false;
      }
    } catch (e) {
      if (showStatus) setSaveErr(e.response?.data?.error || e.message);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    const errs = clientValidate(rs);
    setValidErrs(errs);
    setTouched(true);
    if (errs.length) return;
    setSaving(true); setSaveErr('');
    try {
      // Save first if dirty
      if (isDirtyRef.current || isNew) await performSave(false);
      await api.post(`/admin/reading-sets/${id || rs.id}/publish`);
      setRs(r => ({ ...r, status: 'published' }));
    } catch (e) {
      setSaveErr(e.response?.data?.error || e.message);
      const serverErrs = e.response?.data?.errors;
      if (serverErrs) setValidErrs(serverErrs.map(m => ({ msg: m })));
    }
    setSaving(false);
  };

  // ── RS field updates ─────────────────────────────────────────────────────────
  const updateMeta = (field, val) => setRsAndMark(r => ({ ...r, [field]: val }));

  // ── Passage CRUD ─────────────────────────────────────────────────────────────
  const addPassage = () => {
    setRsAndMark(r => ({ ...r, passages: [...r.passages, newPassage(r.passages.length)] }));
    setActivePassage(rs.passages.length);
    setTimeout(() => document.getElementById(`passage-${rs.passages.length}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const deletePassage = (idx) => {
    setRsAndMark(r => ({ ...r, passages: immDel(r.passages, idx) }));
    setActivePassage(Math.max(0, idx - 1));
  };
  const movePassage = (idx, dir) => setRsAndMark(r => ({ ...r, passages: immMove(r.passages, idx, dir) }));
  const duplicatePassage = (idx) => {
    const p = rs.passages[idx];
    const copy = { ...p, id: tempId(), title: (p.title || '') + ' (bản sao)', questions: p.questions.map(q => ({ ...q, id: tempId(), options: (q.options||[]).map(o => ({ ...o, id: tempId() })) })) };
    setRsAndMark(r => ({ ...r, passages: [...r.passages.slice(0, idx + 1), copy, ...r.passages.slice(idx + 1)] }));
  };
  const updatePassage = (idx, field, val) => {
    // When content changes, mark questions as needs_review if questions exist
    const extra = field === 'content' && rs.passages[idx].questions.length > 0
      ? { needs_review: true, questions: rs.passages[idx].questions.map(q => ({ ...q, needs_review: true })) }
      : {};
    setRsAndMark(r => ({ ...r, passages: immSet(r.passages, idx, p => ({ ...p, [field]: val, ...extra })) }));
  };

  // ── Question CRUD ────────────────────────────────────────────────────────────
  const addQuestion = (pIdx) => {
    const q = newQuestion(rs.passages[pIdx].questions.length);
    setRsAndMark(r => ({ ...r, passages: immSet(r.passages, pIdx, p => ({ ...p, questions: [...p.questions, q] })) }));
  };
  const deleteQuestion = (pIdx, qIdx) => {
    setRsAndMark(r => ({ ...r, passages: immSet(r.passages, pIdx, p => ({ ...p, questions: immDel(p.questions, qIdx) })) }));
  };
  const moveQuestion = (pIdx, qIdx, dir) => {
    setRsAndMark(r => ({ ...r, passages: immSet(r.passages, pIdx, p => ({ ...p, questions: immMove(p.questions, qIdx, dir) })) }));
  };
  const duplicateQuestion = (pIdx, qIdx) => {
    const q = rs.passages[pIdx].questions[qIdx];
    const copy = { ...q, id: tempId(), question_text: q.question_text + ' (bản sao)', options: (q.options||[]).map(o => ({ ...o, id: tempId() })) };
    setRsAndMark(r => ({ ...r, passages: immSet(r.passages, pIdx, p => ({ ...p, questions: [...p.questions.slice(0, qIdx + 1), copy, ...p.questions.slice(qIdx + 1)] })) }));
  };
  const updateQuestion = (pIdx, qIdx, field, val) => {
    setRsAndMark(r => ({
      ...r,
      passages: immSet(r.passages, pIdx, p => ({
        ...p,
        questions: immSet(p.questions, qIdx, q => ({ ...q, [field]: val, needs_review: false })),
      })),
    }));
  };

  // ── AI apply ─────────────────────────────────────────────────────────────────
  const handleAIApply = (draft) => {
    const normalized = {
      ...rs,
      title:             draft.title || rs.title,
      short_description: draft.short_description || rs.short_description,
      instructions:      draft.instructions || rs.instructions,
      jlpt_level:        draft.jlpt_level || rs.jlpt_level,
      source_type:       'ai_generated',
      passages: (draft.passages || []).map((p, pi) => ({
        id: tempId(), title: p.title || null, content: p.content || '', note: p.note || null,
        sort_order: pi, needs_review: false,
        questions: (p.questions || []).map((q, qi) => ({
          id: tempId(), question_type: q.question_type || 'single_choice',
          question_text: q.question_text || '', explanation: q.explanation || '',
          skill_tags: [], sort_order: qi, needs_review: false,
          options: (q.options || []).map((o, oi) => ({ id: tempId(), option_text: o.option_text || '', is_correct: o.is_correct || false, sort_order: oi })),
        })),
      })),
    };
    setRsAndMark(normalized);
    setShowAI(false);
    setActivePassage(0);
  };

  // ── Validation indicators ─────────────────────────────────────────────────────
  useEffect(() => {
    if (touched) setValidErrs(clientValidate(rs));
  }, [rs, touched]);

  const totalQ = rs.passages.reduce((sum, p) => sum + p.questions.length, 0);

  if (loadErr) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">{loadErr}</p>
        <button onClick={() => navigate('/admin/reading-sets')} className="px-4 py-2 bg-tsubaki-red text-white rounded-lg">
          Quay lại
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-outline/30 px-4 py-3 flex items-center gap-3 z-20 shrink-0">
        <button onClick={() => navigate('/admin/reading-sets')}
          className="p-1.5 rounded-lg hover:bg-surface-low text-on-muted shrink-0">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>

        {/* Editable title */}
        <input
          value={rs.title}
          onChange={e => updateMeta('title', e.target.value)}
          placeholder="Tiêu đề bài đọc..."
          className="flex-1 min-w-0 text-base font-bold bg-transparent border-0 outline-none placeholder:text-on-muted/50 truncate"
        />

        {/* Status */}
        <div className="shrink-0 flex items-center gap-2">
          {rs.status === 'published' && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
              <span className="material-symbols-outlined text-xs" style={{fontSize:12}}>check_circle</span>
              Đã xuất bản
            </span>
          )}
          {rs.status === 'draft' && (
            <span className="hidden sm:inline-flex items-center px-2 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-semibold">Nháp</span>
          )}

          {/* Autosave indicator */}
          {!isNew && (
            <span className="hidden md:block text-xs text-on-muted">
              {saving ? (
                <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-on-muted/30 border-t-tsubaki-red rounded-full animate-spin" />Đang lưu...</span>
              ) : lastSaved ? (
                `Đã lưu ${lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
              ) : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowAI(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-purple-300 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span className="hidden md:inline">AI tạo</span>
          </button>
          <button onClick={() => setShowPreview(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-outline rounded-lg text-sm font-medium hover:bg-surface-low transition-colors">
            <span className="material-symbols-outlined text-sm">visibility</span>
            <span className="hidden md:inline">Preview</span>
          </button>
          <button
            onClick={() => performSave(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-outline rounded-lg text-sm font-medium hover:bg-surface-low disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined text-sm">save</span>
            <span className="hidden sm:inline">Lưu nháp</span>
          </button>
          <button
            onClick={handlePublish}
            disabled={saving || rs.status === 'published'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
            <span className="material-symbols-outlined text-sm">publish</span>
            <span className="hidden sm:inline">{rs.status === 'published' ? 'Đã xuất bản' : 'Xuất bản'}</span>
          </button>
        </div>
      </div>

      {/* Error bar */}
      {(saveErr || (touched && validErrs.length > 0)) && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 shrink-0">
          {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}
          {touched && validErrs.length > 0 && (
            <ul className="text-xs text-red-600 space-y-0.5">
              {validErrs.slice(0, 3).map((e, i) => <li key={i}>• {e.msg || e}</li>)}
              {validErrs.length > 3 && <li>... và {validErrs.length - 3} lỗi khác</li>}
            </ul>
          )}
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <div className="w-56 shrink-0 border-r border-outline/30 bg-white flex flex-col overflow-hidden hidden md:flex">
          {/* Metadata accordion */}
          <button
            onClick={() => setMetaOpen(m => !m)}
            className="flex items-center justify-between px-4 py-3 text-xs font-bold text-on-muted uppercase tracking-wider border-b border-outline/20 hover:bg-surface-low">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">tune</span>
              Thông tin bài
            </span>
            <span className="material-symbols-outlined text-sm">{metaOpen ? 'expand_less' : 'expand_more'}</span>
          </button>

          {metaOpen && (
            <div className="px-3 py-3 space-y-2.5 border-b border-outline/20 overflow-y-auto">
              <div>
                <label className="text-xs text-on-muted block mb-1">Cấp JLPT</label>
                <select value={rs.jlpt_level || ''} onChange={e => updateMeta('jlpt_level', e.target.value)}
                  className="w-full px-2 py-1.5 border border-outline rounded-lg text-xs focus:outline-none focus:border-tsubaki-red">
                  <option value="">-- Chọn --</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">Độ khó</label>
                <select value={rs.difficulty} onChange={e => updateMeta('difficulty', e.target.value)}
                  className="w-full px-2 py-1.5 border border-outline rounded-lg text-xs focus:outline-none focus:border-tsubaki-red">
                  {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">Chủ đề</label>
                <input value={rs.topic || ''} onChange={e => updateMeta('topic', e.target.value)}
                  placeholder="VD: Môi trường, Ẩm thực..."
                  className="w-full px-2 py-1.5 border border-outline rounded-lg text-xs focus:outline-none focus:border-tsubaki-red" />
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">Thời gian (phút)</label>
                <input type="number" min={1} max={90} value={rs.estimated_time_minutes || ''}
                  onChange={e => updateMeta('estimated_time_minutes', e.target.value ? +e.target.value : null)}
                  placeholder="VD: 15"
                  className="w-full px-2 py-1.5 border border-outline rounded-lg text-xs focus:outline-none focus:border-tsubaki-red" />
              </div>
              <div>
                <label className="text-xs text-on-muted block mb-1">Hướng dẫn</label>
                <textarea value={rs.instructions || ''} onChange={e => updateMeta('instructions', e.target.value)}
                  placeholder="Hướng dẫn làm bài..."
                  rows={2}
                  className="w-full px-2 py-1.5 border border-outline rounded-lg text-xs focus:outline-none focus:border-tsubaki-red resize-none" />
              </div>
            </div>
          )}

          {/* Passage nav */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline/20">
            <span className="text-xs font-bold text-on-muted uppercase tracking-wider">
              Đoạn văn ({rs.passages.length})
            </span>
            <span className="text-xs text-on-muted">{totalQ} câu hỏi</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {rs.passages.map((p, pi) => (
              <button
                key={p.id || pi}
                onClick={() => {
                  setActivePassage(pi);
                  document.getElementById(`passage-${pi}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-surface-low flex items-start gap-2 ${activePassage === pi ? 'bg-tsubaki-red/5 text-tsubaki-red font-semibold' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 mt-0.5 ${activePassage === pi ? 'bg-tsubaki-red text-white' : 'bg-outline/30 text-on-muted'}`}>
                  {pi + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate">{p.title || `Đoạn ${pi + 1}`}</div>
                  <div className="text-xs text-on-muted">{p.questions.length} câu hỏi</div>
                </div>
                {p.needs_review && (
                  <span className="material-symbols-outlined text-amber-500 text-sm shrink-0 mt-0.5" style={{fontSize:14}}>warning</span>
                )}
              </button>
            ))}
            <button
              onClick={addPassage}
              className="w-full text-left px-4 py-3 text-sm text-tsubaki-red hover:bg-tsubaki-red/5 transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Thêm đoạn văn
            </button>
          </div>

          {/* Validation summary */}
          {touched && validErrs.length > 0 && (
            <div className="border-t border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold text-red-600 mb-1">{validErrs.length} lỗi cần sửa</p>
            </div>
          )}
        </div>

        {/* Main editing area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {rs.passages.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-20 h-20 rounded-2xl bg-tsubaki-red/10 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-tsubaki-red">article</span>
                </div>
                <h3 className="font-display font-bold text-xl mb-2">Bắt đầu tạo bài đọc</h3>
                <p className="text-on-muted text-sm mb-6 max-w-sm mx-auto">
                  Thêm đoạn văn tiếng Nhật và câu hỏi tương ứng. Mỗi đoạn có thể có nhiều câu hỏi.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={addPassage}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-tsubaki-red text-white rounded-xl font-semibold hover:opacity-90">
                    <span className="material-symbols-outlined">add</span>
                    Thêm đoạn văn đầu tiên
                  </button>
                  <button onClick={() => setShowAI(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:opacity-90">
                    <span className="material-symbols-outlined">auto_awesome</span>
                    AI tạo bài
                  </button>
                </div>
              </div>
            ) : (
              rs.passages.map((p, pi) => (
                <PassageCard
                  key={p.id || pi}
                  p={p} pIdx={pi} rs={{ ...rs, touched }} total={rs.passages.length}
                  isActive={activePassage === pi}
                  onSetActive={setActivePassage}
                  onUpdatePassage={updatePassage}
                  onDeletePassage={deletePassage}
                  onMovePassage={movePassage}
                  onDuplicatePassage={duplicatePassage}
                  onAddQuestion={addQuestion}
                  onDeleteQuestion={deleteQuestion}
                  onMoveQuestion={moveQuestion}
                  onDuplicateQuestion={duplicateQuestion}
                  onUpdateQuestion={updateQuestion}
                />
              ))
            )}

            {rs.passages.length > 0 && (
              <button onClick={addPassage}
                className="w-full py-4 border-2 border-dashed border-outline/40 rounded-2xl text-on-muted hover:border-tsubaki-red/40 hover:text-tsubaki-red transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">add</span>
                Thêm đoạn văn mới
              </button>
            )}

            {/* Bottom padding */}
            <div className="h-16" />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPreview && <PreviewPanel rs={rs} onClose={() => setShowPreview(false)} />}
      {showAI      && <AIModal defaultLevel={rs.jlpt_level} onClose={() => setShowAI(false)} onApply={handleAIApply} />}
    </div>
  );
}
