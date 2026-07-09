import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';

const FREE_FEATURES = [
  { label: '1 lượt kiểm tra năng lực / tháng' },
  { label: '2 bài luyện nghe / tháng' },
  { label: '5 tin nhắn AI / ngày' },
  { label: '2 file luyện viết kanji / tháng' },
  { label: 'Tối đa 20 ký tự / file kanji' },
  { label: 'Truy cập từ điển, flashcard, quiz', note: 'Không giới hạn' },
  { label: 'Học theo khoá học & bài học', note: 'Không giới hạn' },
];

const PREMIUM_FEATURES = [
  { label: 'Kiểm tra năng lực không giới hạn', highlight: true },
  { label: 'Luyện nghe không giới hạn', highlight: true },
  { label: 'Trợ lý AI không giới hạn mỗi ngày', highlight: true },
  { label: 'Luyện viết kanji không giới hạn', highlight: true },
  { label: 'Tất cả tính năng của gói Free' },
  { label: 'Hỗ trợ ưu tiên' },
  { label: 'Truy cập sớm tính năng mới' },
];

function CheckIcon({ highlight }) {
  return (
    <span className={`material-symbols-outlined text-lg flex-shrink-0 ${highlight ? 'text-amber-500' : 'text-emerald-500'}`}>
      check_circle
    </span>
  );
}

export default function Pricing() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { data }  = useSubscription();
  const isPremium = data?.tier === 'premium';

  const handleUpgrade = () => navigate('/subscription');

  return (
    <StudentLayout title="Gói đăng ký">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold mb-3">Chọn gói phù hợp với bạn</h1>
          <p className="text-on-muted text-lg">
            Nâng cấp để mở khoá toàn bộ tính năng học tiếng Nhật trên Kizuna Nihongo.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Free plan */}
          <div className="glass-card rounded-2xl p-8 border border-outline/30 flex flex-col">
            <div className="mb-6">
              <p className="text-sm font-semibold text-on-muted uppercase tracking-wider mb-2">Miễn phí</p>
              <div className="flex items-end gap-2">
                <span className="font-display text-5xl font-bold">0</span>
                <span className="text-on-muted pb-1">₫ / tháng</span>
              </div>
              <p className="text-sm text-on-muted mt-2">Tạo tài khoản miễn phí, không cần thẻ.</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <CheckIcon />
                  <span>{f.label}{f.note && <span className="text-on-muted ml-1">({f.note})</span>}</span>
                </li>
              ))}
            </ul>

            {user
              ? <div className={`text-center py-3 rounded-xl text-sm font-semibold ${!isPremium ? 'bg-surface-low text-on-muted' : 'bg-surface-low text-on-muted'}`}>
                  {!isPremium ? 'Gói đang dùng' : 'Gói cơ bản'}
                </div>
              : <button onClick={() => navigate('/register')}
                  className="w-full py-3 rounded-xl border border-outline font-semibold hover:bg-surface-low transition-colors">
                  Đăng ký miễn phí
                </button>
            }
          </div>

          {/* Premium plan */}
          <div className="rounded-2xl p-8 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-400 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
              PHỔ BIẾN NHẤT
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-2">Premium Tháng</p>
              <div className="flex items-end gap-2">
                <span className="font-display text-5xl font-bold">99.000</span>
                <span className="text-on-muted pb-1">₫ / tháng</span>
              </div>
              <p className="text-sm text-amber-700 mt-2">Thanh toán qua chuyển khoản ngân hàng.</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {PREMIUM_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <CheckIcon highlight={f.highlight} />
                  <span className={f.highlight ? 'font-semibold' : ''}>{f.label}</span>
                </li>
              ))}
            </ul>

            {isPremium
              ? <div className="text-center py-3 rounded-xl bg-amber-400 text-white text-sm font-semibold">
                  Bạn đang dùng Premium ✓
                </div>
              : <button onClick={handleUpgrade}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold text-base transition-colors shadow-lg shadow-amber-200">
                  Nâng cấp Premium
                </button>
            }
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 glass-card rounded-2xl p-8">
          <h2 className="font-display text-2xl font-bold mb-6">Câu hỏi thường gặp</h2>
          <div className="space-y-5">
            {[
              { q: 'Cách thanh toán như thế nào?', a: 'Bạn chuyển khoản ngân hàng theo nội dung và số tiền hiển thị trên trang thanh toán. Hệ thống tự động xác nhận trong vài phút.' },
              { q: 'Tôi có thể huỷ không?', a: 'Gói Premium không tự gia hạn. Sau 30 ngày sẽ tự chuyển về gói Free, bạn không cần làm gì thêm.' },
              { q: 'Thanh toán có an toàn không?', a: 'Bạn chuyển khoản trực tiếp qua app ngân hàng của mình. Hệ thống chỉ xác nhận giao dịch, không lưu thông tin thẻ hay tài khoản ngân hàng.' },
            ].map((faq, i) => (
              <div key={i} className="border-b border-outline/30 pb-5">
                <p className="font-semibold mb-2">{faq.q}</p>
                <p className="text-sm text-on-muted">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
