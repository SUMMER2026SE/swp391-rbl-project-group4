import Alert from '../ui/Alert';
import { formatDuration } from '../../lib/mockExamConstants';

// Bảng xếp hạng: điểm cao trước, cùng điểm thời gian ngắn hơn xếp trên (chỉ lần làm đầu).
// Top 3 hiển thị dạng bục vinh danh, từ hạng 4 hiển thị dạng dòng.

const PODIUM_STYLE = {
  1: { height: 'h-28', bar: 'bg-gradient-to-t from-amber-500 to-amber-300', ring: 'ring-amber-400', badge: 'bg-amber-400 text-white', icon: '👑' },
  2: { height: 'h-20', bar: 'bg-gradient-to-t from-slate-400 to-slate-200', ring: 'ring-slate-300', badge: 'bg-slate-400 text-white', icon: '🥈' },
  3: { height: 'h-14', bar: 'bg-gradient-to-t from-amber-800 to-amber-600', ring: 'ring-amber-700', badge: 'bg-amber-700 text-white', icon: '🥉' },
};

function Avatar({ row, size }) {
  return row.avatar_url
    ? <img src={row.avatar_url} className={`${size} rounded-full object-cover`} alt="" />
    : <span className={`${size} rounded-full bg-tsubaki-red/80 text-white font-bold flex items-center justify-center`}>{(row.name?.[0] || '?').toUpperCase()}</span>;
}

function PodiumSlot({ row }) {
  if (!row) return <div className="flex-1" />;
  const s = PODIUM_STYLE[row.rank];
  return (
    <div className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
      <span className="text-xl leading-none">{s.icon}</span>
      <div className={`rounded-full ring-4 ${s.ring} ${row.is_me ? 'outline outline-2 outline-tsubaki-red outline-offset-2' : ''}`}>
        <Avatar row={row} size={`${row.rank === 1 ? 'w-16 h-16 text-xl' : 'w-12 h-12 text-base'}`} />
      </div>
      <p className="text-sm font-semibold text-charcoal truncate max-w-full px-1">
        {row.name}{row.is_me && <span className="text-tsubaki-red"> (Bạn)</span>}
      </p>
      <p className="text-sm font-bold text-charcoal">{row.total_score}<span className="text-xs text-on-muted font-normal">/180</span></p>
      <p className="text-xs text-on-muted flex items-center gap-0.5">
        <span className="material-symbols-outlined text-sm">timer</span>{formatDuration(row.duration_seconds)}
      </p>
      <div className={`w-full ${s.height} ${s.bar} rounded-t-xl flex items-start justify-center pt-1.5`}>
        <span className={`w-7 h-7 rounded-full ${s.badge} text-sm font-bold flex items-center justify-center shadow`}>{row.rank}</span>
      </div>
    </div>
  );
}

export default function LeaderboardTable({ board, myRank }) {
  if (!board?.length) {
    return <p className="text-center text-on-muted py-8">Chưa có ai hoàn thành đề này. Hãy là người đầu tiên!</p>;
  }

  const top3 = board.filter(r => r.rank <= 3);
  const rest = board.filter(r => r.rank > 3);
  const byRank = (r) => top3.find(x => x.rank === r) || null;

  return (
    <div className="space-y-4">
      <Alert type="info">
        Bảng xếp hạng chỉ tính <b>lần thi đầu tiên</b> của mỗi người.
      </Alert>

      {/* Bục vinh danh top 3: hạng 2 trái — hạng 1 giữa — hạng 3 phải */}
      <div className="flex items-end gap-2 sm:gap-4 px-2 pt-2 border-b-4 border-outline/40 rounded-b">
        <PodiumSlot row={byRank(2)} />
        <PodiumSlot row={byRank(1)} />
        <PodiumSlot row={byRank(3)} />
      </div>

      {/* Từ hạng 4 trở xuống */}
      <div className="space-y-2">
        {rest.map(row => (
          <div key={row.user_id}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${row.is_me ? 'border-tsubaki-red/50 bg-tsubaki-red/5' : 'border-outline/30 bg-white'}`}>
            <span className="w-8 text-center font-bold text-on-muted shrink-0">{row.rank}</span>
            <Avatar row={row} size="w-8 h-8 text-xs shrink-0" />
            <span className="flex-1 truncate text-sm font-semibold text-charcoal">
              {row.name}{row.is_me && <span className="text-tsubaki-red"> (Bạn)</span>}
            </span>
            <span className="text-sm text-on-muted flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{formatDuration(row.duration_seconds)}</span>
            <span className="w-14 text-right font-bold text-charcoal">{row.total_score}<span className="text-xs text-on-muted">/180</span></span>
          </div>
        ))}
        {myRank?.out_of_top && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-tsubaki-red/50 bg-tsubaki-red/5 mt-3">
            <span className="w-8 text-center font-bold text-on-muted shrink-0">{myRank.rank}</span>
            <span className="flex-1 text-sm font-semibold text-tsubaki-red">Thứ hạng của bạn</span>
            <span className="text-sm text-on-muted flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{formatDuration(myRank.duration_seconds)}</span>
            <span className="w-14 text-right font-bold text-charcoal">{myRank.total_score}<span className="text-xs text-on-muted">/180</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
