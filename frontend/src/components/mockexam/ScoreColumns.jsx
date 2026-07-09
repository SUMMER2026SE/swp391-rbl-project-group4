import { SCORE_COLUMN_LABEL } from '../../lib/mockExamConstants';

// Hiển thị điểm từng cột chấm JLPT + cảnh báo điểm liệt.
// scores: { [key]: { score, max, min, correct, total, passed } }
export default function ScoreColumns({ scores, columns }) {
  if (!scores || !columns) return null;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr))` }}>
      {columns.map(col => {
        const s = scores[col.key];
        if (!s) return null;
        const pct = Math.round((s.score / s.max) * 100);
        const failLiet = s.total > 0 && !s.passed;
        const label = SCORE_COLUMN_LABEL[col.key];
        return (
          <div key={col.key} className={`rounded-xl border p-4 ${failLiet ? 'border-error/40 bg-error-bg/40' : 'border-outline/40 bg-white'}`}>
            <p className="text-xs font-semibold text-on-muted">{label?.vi || col.key}</p>
            <p className="text-[11px] text-on-muted/70 mb-2">{label?.ja}</p>
            <p className="text-2xl font-bold text-charcoal">{s.score}<span className="text-sm text-on-muted">/{s.max}</span></p>
            <div className="h-1.5 bg-surface-low rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${failLiet ? 'bg-error' : 'bg-tsubaki-red'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-on-muted mt-1.5">
              Đúng {s.correct}/{s.total} · liệt &lt; {s.min}
              {failLiet && <span className="text-error font-semibold"> · Dưới điểm liệt</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
