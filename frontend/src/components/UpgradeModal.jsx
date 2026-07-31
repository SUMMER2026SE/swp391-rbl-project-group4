import { useNavigate } from 'react-router-dom';
import { featureLabel } from '../lib/featureLabels';


/**
 * Shows when an API call returns 403 with error: 'quota_exceeded'.
 * Accepts the full error response body as `quota`.
 * Usage: <UpgradeModal quota={quotaError} onClose={() => setQuotaError(null)} />
 */
export default function UpgradeModal({ quota, onClose }) {
  const navigate = useNavigate();
  if (!quota) return null;

  const featureName = featureLabel(quota.feature);
  const isUnlimited = quota.tier === 'premium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-3xl text-amber-500">workspace_premium</span>
        </div>

        <h3 className="font-display text-xl font-bold mb-2">Đã đạt giới hạn</h3>
        <p className="text-on-muted text-sm mb-1">
          Bạn đã dùng hết <strong>{quota.used}/{quota.limit}</strong> lượt <strong>{featureName}</strong>.
        </p>
        <p className="text-on-muted text-sm mb-6">{quota.resetInfo}</p>

        {!isUnlimited && (
          <>
            <p className="text-sm font-semibold text-amber-700 mb-5">
              Nâng cấp Premium để dùng không giới hạn.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-outline text-sm font-semibold hover:bg-surface-low transition-colors">
                Đóng
              </button>
              <button onClick={() => { onClose(); navigate('/subscription'); }}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-colors">
                Nâng cấp ngay
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
