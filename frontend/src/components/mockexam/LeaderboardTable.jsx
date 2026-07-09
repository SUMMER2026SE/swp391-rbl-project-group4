import { formatDuration } from '../../lib/mockExamConstants';

// Bảng xếp hạng: điểm cao trước, cùng điểm thời gian ngắn hơn xếp trên (chỉ lần làm đầu).
export default function LeaderboardTable({ board, myRank }) {
  if (!board?.length) {
    return <p className="text-center text-on-muted py-8">Chưa có ai hoàn thành đề này. Hãy là người đầu tiên!</p>;
  }
  const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null);

  return (
    <div className="space-y-2">
      {board.map(row => (
        <div key={row.user_id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${row.is_me ? 'border-tsubaki-red/50 bg-tsubaki-red/5' : 'border-outline/30 bg-white'}`}>
          <span className="w-8 text-center font-bold text-on-muted shrink-0">{medal(row.rank) || row.rank}</span>
          {row.avatar_url
            ? <img src={row.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
            : <span className="w-8 h-8 rounded-full bg-tsubaki-red/80 text-white text-xs font-bold flex items-center justify-center shrink-0">{(row.name?.[0] || '?').toUpperCase()}</span>}
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
  );
}
