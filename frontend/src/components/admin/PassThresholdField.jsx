// Cấu hình "Điểm đạt" cho quiz/đề thi: không yêu cầu | theo % | theo số câu đúng.
// type: '' | 'percent' | 'count'; value: chuỗi số. onChange(nextType, nextValue).
// totalQuestions (tuỳ chọn): tổng số câu hiện có — hiện gợi ý & cảnh báo cho kiểu 'count'.
const OPTIONS = [
  { val: '',        label: 'Không yêu cầu' },
  { val: 'percent', label: 'Theo phần trăm' },
  { val: 'count',   label: 'Theo số câu đúng' },
];

export default function PassThresholdField({ type = '', value = '', onChange, totalQuestions = null }) {
  const overCount = type === 'count' && totalQuestions != null && Number(value) > totalQuestions;
  return (
    <div>
      <label className="block text-sm font-medium text-on-muted mb-1.5">Điểm đạt</label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(o => (
          <button key={o.val} type="button"
            onClick={() => onChange(o.val, o.val === type ? value : '')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
              type === o.val ? 'border-tsubaki-red bg-tsubaki-red/5 text-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red/40'}`}>
            {o.label}
          </button>
        ))}
      </div>
      {type && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number" min="1" max={type === 'percent' ? 100 : undefined} value={value}
            onChange={e => onChange(type, e.target.value)}
            className="w-24 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
          />
          <span className="text-sm text-on-muted">
            {type === 'percent' ? '% số câu đúng' : 'câu đúng'}
            {type === 'count' && totalQuestions != null ? ` / tổng ${totalQuestions} câu` : ''}
          </span>
        </div>
      )}
      {overCount && (
        <p className="text-xs text-error mt-1">Ngưỡng vượt quá tổng số câu hiện có ({totalQuestions}).</p>
      )}
      {type && (
        <p className="text-xs text-on-muted mt-1.5">Học sinh phải đạt ngưỡng này mới được đánh dấu hoàn thành mục học.</p>
      )}
    </div>
  );
}
