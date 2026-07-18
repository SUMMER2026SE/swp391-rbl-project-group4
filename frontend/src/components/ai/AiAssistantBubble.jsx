import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AiAssistant } from '../../pages/ChatPage';

// Các trang ĐANG LÀM BÀI — ẩn trợ lý để không hỏi bài hộ (toàn vẹn học thuật).
// Trang xem kết quả/review sau khi nộp không nằm ở đây: lúc đó đáp án đã hiện sẵn.
const EXAM_PATHS = [
  /^\/placement-test$/,
  /^\/quizzes\/[^/]+$/,
  /^\/exams\/[^/]+$/,
  /^\/mock-exams\/attempt\/[^/]+$/,
];

// Bubble "Trợ lý AI" nổi ở góc — mở nhanh một đoạn chat MỚI (không lịch sử).
// Ẩn khi đang ở trang AI đầy đủ (/chat). Có nút mở trang AI đầy đủ (có lịch sử).
export default function AiAssistantBubble() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;                 // chỉ hiện khi đã đăng nhập
  if (pathname === '/chat') return null;  // đang ở giao diện AI lớn → ẩn bubble
  if (EXAM_PATHS.some(re => re.test(pathname))) return null;

  const openFull = () => { setOpen(false); navigate('/chat'); };

  return (
    <>
      {open && (
        <div className="fixed z-[70] bottom-36 right-4 md:bottom-24 md:right-6
          w-[min(440px,calc(100vw-2rem))] h-[min(72vh,640px)]
          flex flex-col rounded-2xl shadow-2xl border border-outline/40 bg-white overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-violet-600 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <div className="leading-tight">
                <p className="font-display font-bold text-sm">Kizuna AI</p>
                <p className="text-[10px] opacity-80">Trò chuyện nhanh</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={openFull} title="Mở trang đầy đủ (có lịch sử)"
                className="h-8 px-2 rounded-lg hover:bg-white/20 flex items-center gap-1 text-xs font-medium transition-colors">
                <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                <span className="hidden sm:inline">Mở rộng</span>
              </button>
              <button onClick={() => setOpen(false)} title="Đóng"
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <AiAssistant embedded />
          </div>
        </div>
      )}

      <button onClick={() => setOpen(v => !v)}
        title="Trợ lý AI" aria-label="Trợ lý AI"
        className="fixed z-[70] bottom-20 right-4 md:bottom-6 md:right-6
          w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-xl
          flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {open ? 'close' : 'smart_toy'}
        </span>
      </button>
    </>
  );
}
