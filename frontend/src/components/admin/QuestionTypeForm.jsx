import { QUESTION_TYPES, EMPTY_Q_FORM } from '../../utils/questionFormHelpers';

// Reusable question form that handles all 6 question types.
// Props: form (state), setForm (setter), passages (array, optional), showMeta (bool)
export default function QuestionTypeForm({ form, setForm, passages = [], showMeta = true }) {
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const updateOption = (i, val) => {
    const opts = [...form.options];
    opts[i] = val;
    set('options', opts);
  };

  const toggleMulti = (opt) => {
    const cur = form.correct_answers_multi || [];
    set('correct_answers_multi', cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt]);
  };

  const updatePair = (i, side, val) => {
    const pairs = form.matching_pairs.map((p, idx) => idx === i ? { ...p, [side]: val } : p);
    set('matching_pairs', pairs);
  };

  const updateOrdering = (i, val) => {
    const items = [...form.ordering_items];
    items[i] = val;
    set('ordering_items', items);
  };

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="block text-xs font-semibold text-on-muted mb-1.5">Loại câu hỏi</label>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm(f => ({ ...EMPTY_Q_FORM, ...f, question_type: t.value, level: f.level, skill: f.skill, topic: f.topic, difficulty: f.difficulty }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                form.question_type === t.value
                  ? `${t.color} border-current shadow-sm`
                  : 'bg-white border-outline/40 text-on-muted hover:border-sumire-purple'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="block text-xs font-semibold text-on-muted mb-1">Nội dung câu hỏi *</label>
        <textarea
          value={form.question_text}
          onChange={e => set('question_text', e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none"
          placeholder="Nhập câu hỏi..."
        />
      </div>

      {/* Passage picker */}
      {passages.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-on-muted mb-1">Bài đọc đính kèm</label>
          <select value={form.passage_id || ''} onChange={e => set('passage_id', e.target.value || null)} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
            <option value="">— Không có —</option>
            {passages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      )}

      {/* Type-specific inputs */}
      {(form.question_type === 'single_choice' || form.question_type === 'multiple_choice') && (
        <div>
          <label className="block text-xs font-semibold text-on-muted mb-2">
            {form.question_type === 'single_choice' ? 'Các lựa chọn (chọn 1 đáp án đúng)' : 'Các lựa chọn (có thể chọn nhiều đáp án đúng)'}
          </label>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                {form.question_type === 'single_choice' ? (
                  <input
                    type="radio"
                    name="correct_single"
                    checked={form.correct_answer_single === opt && opt !== ''}
                    onChange={() => opt && set('correct_answer_single', opt)}
                    className="accent-sumire-purple"
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={form.correct_answers_multi?.includes(opt) && opt !== ''}
                    onChange={() => opt && toggleMulti(opt)}
                    className="accent-sumire-purple"
                  />
                )}
                <input
                  type="text"
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
                  placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-on-muted mt-1.5">
            {form.question_type === 'single_choice' ? 'Tick vào ô tròn để đánh dấu đáp án đúng' : 'Tick vào ô vuông để đánh dấu đáp án đúng'}
          </p>
        </div>
      )}

      {form.question_type === 'matching' && (
        <div>
          <label className="block text-xs font-semibold text-on-muted mb-2">Cặp nối (trái → phải)</label>
          <div className="space-y-2">
            {form.matching_pairs.map((pair, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={pair.left} onChange={e => updatePair(i, 'left', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" placeholder={`Trái ${i + 1}`} />
                <span className="material-symbols-outlined text-on-muted text-base">arrow_forward</span>
                <input type="text" value={pair.right} onChange={e => updatePair(i, 'right', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" placeholder={`Phải ${i + 1}`} />
                {form.matching_pairs.length > 2 && (
                  <button type="button" onClick={() => set('matching_pairs', form.matching_pairs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => set('matching_pairs', [...form.matching_pairs, { left: '', right: '' }])}
              className="text-xs text-sumire-purple hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span> Thêm cặp
            </button>
          </div>
        </div>
      )}

      {form.question_type === 'ordering' && (
        <div>
          <label className="block text-xs font-semibold text-on-muted mb-2">Các mục (theo thứ tự đúng)</label>
          <div className="space-y-2">
            {form.ordering_items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sumire-purple/10 text-sumire-purple text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <input type="text" value={item} onChange={e => updateOrdering(i, e.target.value)} className="flex-1 px-3 py-2 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" placeholder={`Mục ${i + 1}`} />
                {form.ordering_items.length > 2 && (
                  <button type="button" onClick={() => set('ordering_items', form.ordering_items.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => set('ordering_items', [...form.ordering_items, ''])}
              className="text-xs text-sumire-purple hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span> Thêm mục
            </button>
          </div>
        </div>
      )}

      {form.question_type === 'fill_blank' && (
        <div>
          <label className="block text-xs font-semibold text-on-muted mb-1">Đáp án chấp nhận (cách nhau bằng dấu phẩy)</label>
          <input type="text" value={form.fill_blank_answers} onChange={e => set('fill_blank_answers', e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" placeholder="VD: はい, はあい" />
          <p className="text-[11px] text-on-muted mt-1">Nhập nhiều đáp án nếu có nhiều cách viết chấp nhận được.</p>
        </div>
      )}

      {form.question_type === 'short_answer' && (
        <div>
          <label className="block text-xs font-semibold text-on-muted mb-1">Đáp án mẫu (không bắt buộc)</label>
          <input type="text" value={form.correct_answer_short} onChange={e => set('correct_answer_short', e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" placeholder="Đáp án mẫu hoặc từ khoá chấm điểm..." />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-xs font-semibold text-on-muted mb-1">Giải thích (không bắt buộc)</label>
        <textarea value={form.explanation} onChange={e => set('explanation', e.target.value)}
          rows={2} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none" placeholder="Giải thích đáp án..." />
      </div>

      {/* Meta: level, skill, topic, difficulty */}
      {showMeta && (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-outline/20">
          <div>
            <label className="block text-xs font-semibold text-on-muted mb-1">Trình độ</label>
            <select value={form.level} onChange={e => set('level', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
              <option value="">— Chọn —</option>
              {['N5','N4','N3','N2','N1'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-muted mb-1">Kỹ năng</label>
            <select value={form.skill} onChange={e => set('skill', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
              <option value="">— Chọn —</option>
              {['Đọc hiểu','Nghe hiểu','Nói','Viết'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-muted mb-1">Chủ đề</label>
            <input type="text" value={form.topic} onChange={e => set('topic', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors" placeholder="VD: Gia đình, Du lịch..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-muted mb-1">Độ khó</label>
            <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
