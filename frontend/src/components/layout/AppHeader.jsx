import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../hooks/useSubscription';
import AvatarMenu from './AvatarMenu';

// Rendered only for students, so useSubscription runs only where it's needed.
function UpgradeChip() {
  const navigate = useNavigate();
  const { data: subData, loading } = useSubscription();
  if (loading) return null;
  const isPremium = subData?.tier === 'premium';

  return isPremium ? (
    <button
      onClick={() => navigate('/subscription')}
      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold transition-colors shadow-sm shadow-amber-200">
      <span className="material-symbols-outlined text-sm">workspace_premium</span>
      Premium
    </button>
  ) : (
    <button
      onClick={() => navigate('/subscription')}
      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 text-xs font-bold transition-colors">
      <span className="material-symbols-outlined text-sm">bolt</span>
      Nâng cấp
    </button>
  );
}

export default function AppHeader({ roleBadge, title, showUpgrade = false }) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-outline/30 h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <span className={`${roleBadge.colorClass} text-white text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wide`}>
          {roleBadge.label}
        </span>
        <h1 className="text-sm font-bold text-charcoal">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {showUpgrade && <UpgradeChip />}
        <AvatarMenu />
      </div>
    </header>
  );
}
