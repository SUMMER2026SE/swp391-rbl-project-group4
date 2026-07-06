import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'placement_prompt_dismissed_until';

export default function PlacementPromptModal({ show, onDismiss }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    const until = localStorage.getItem(STORAGE_KEY);
    if (until && Date.now() < Number(until)) {
      onDismiss?.();
      return;
    }
    setVisible(true);
  }, [show]);

  if (!visible) return null;

  const handleStart = () => {
    setVisible(false);
    navigate('/placement-test');
  };

  const handleLater = () => {
    setVisible(false);
    onDismiss?.();
  };

  const handleDontShowToday = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 24 * 3600 * 1000));
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-charcoal rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-tsubaki-red/10 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl text-tsubaki-red">assignment_ind</span>
        </div>

        <div className="text-center">
          <h3 className="font-display text-xl font-bold mb-2">Kiểm tra trình độ của bạn</h3>
          <p className="text-sm text-on-muted leading-relaxed">
            Làm bài kiểm tra đầu vào để chúng tôi đề xuất lộ trình học phù hợp nhất với bạn.
            Chỉ mất <strong>30 phút</strong>, 30 câu trắc nghiệm.
          </p>
        </div>

        <div className="space-y-2.5">
          <button onClick={handleStart}
            className="w-full py-3 rounded-xl bg-tsubaki-red text-white font-bold hover:bg-tsubaki-red/90 transition-colors">
            Bắt đầu kiểm tra ngay
          </button>
          <button onClick={handleLater}
            className="w-full py-2.5 rounded-xl border border-outline/40 text-sm font-semibold text-on-muted hover:bg-surface-low transition-colors">
            Để sau
          </button>
          <button onClick={handleDontShowToday}
            className="w-full py-2 text-xs text-on-muted/60 hover:text-on-muted transition-colors">
            Không hiện lại hôm nay
          </button>
        </div>
      </div>
    </div>
  );
}
