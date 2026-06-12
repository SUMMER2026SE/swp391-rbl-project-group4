import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';

const OTP_LENGTH = 6;

function OtpInput({ value, onChange, disabled }) {
  const refs = useRef([]);

  const handleChange = (i, ch) => {
    const digit = ch.replace(/\D/g, '').slice(-1);
    const next = value.split('');
    next[i] = digit;
    onChange(next.join('').slice(0, OTP_LENGTH));
    if (digit && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (digits) {
      onChange(digits);
      refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-bold border border-outline rounded-xl bg-white focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/20 outline-none transition-all disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function Register() {
  const { register, verifyOtp, resendOtp, loginWithGoogle, user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ fullname: '', email: '', password: '', terms: false });
  const [error, setError]     = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // OTP step
  const [step, setStep]             = useState('form'); // 'form' | 'otp'
  const [otp, setOtp]               = useState('');
  const [resendIn, setResendIn]     = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const role = user.user_metadata?.role;
    if (role === 'admin')        navigate('/admin',    { replace: true });
    else if (role === 'teacher') navigate('/teacher',  { replace: true });
    else                         navigate('/dashboard', { replace: true });
  }, [user]);

  // Đếm ngược thời gian được phép gửi lại OTP
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailExists(false);
    if (!form.terms) return setError('Bạn cần đồng ý với điều khoản sử dụng.');
    if (form.password.length < 8) return setError(t('errors.reset_pass_short'));

    setLoading(true);
    try {
      await register(form.fullname, form.email, form.password);
      setStep('otp');
      setOtp('');
      setResendIn(60);
    } catch (err) {
      if (err.code === 'EMAIL_EXISTS') {
        setEmailExists(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (otp.length !== OTP_LENGTH) return setError('Vui lòng nhập đủ 6 chữ số.');
    setError('');
    setLoading(true);
    try {
      const data = await verifyOtp(form.email, otp);
      navigate(data.session ? '/dashboard' : '/login?registered=1', { replace: true });
    } catch (err) {
      setError(err.message);
      // Hết hạn hoặc bị khóa → quay lại form đăng ký
      if (['OTP_EXPIRED', 'OTP_LOCKED', 'OTP_NOT_FOUND'].includes(err.code)) {
        setStep('form');
        setOtp('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendLoading(true);
    try {
      await resendOtp(form.email);
      setResendIn(60);
      setOtp('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl bg-sumire-purple/5" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl bg-tsubaki-red/5" />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-3xl font-bold text-tsubaki-red tracking-tight block mb-2">
            Kizuna Nihongo
          </Link>
          <p className="text-sm text-on-muted">{t('common.tagline')}</p>
        </div>

        {step === 'otp' ? (
          <div className="glass-card rounded-2xl p-8 space-y-6">
            <div className="text-center">
              <span className="material-symbols-outlined text-tsubaki-red text-5xl mb-3 block">mark_email_read</span>
              <h1 className="font-display text-2xl font-bold">Xác thực email</h1>
              <p className="text-sm text-on-muted mt-2">
                Mã xác thực 6 chữ số đã được gửi đến<br />
                <strong className="text-charcoal">{form.email}</strong>
              </p>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />

              <Button type="submit" loading={loading} className="w-full">
                Xác nhận
              </Button>
            </form>

            <div className="text-center space-y-2">
              <p className="text-sm text-on-muted">
                Không nhận được mã?{' '}
                {resendIn > 0 ? (
                  <span className="text-on-muted">Gửi lại sau {resendIn}s</span>
                ) : (
                  <button type="button" onClick={handleResend} disabled={resendLoading}
                    className="text-tsubaki-red font-semibold hover:underline disabled:opacity-50">
                    {resendLoading ? 'Đang gửi...' : 'Gửi lại mã'}
                  </button>
                )}
              </p>
              <button type="button"
                onClick={() => { setStep('form'); setOtp(''); setError(''); }}
                className="text-xs text-on-muted hover:text-charcoal underline underline-offset-2">
                ← Quay lại chỉnh sửa thông tin
              </button>
            </div>
          </div>
        ) : (
        <div className="glass-card rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-tsubaki-red text-5xl mb-3 block">person_add</span>
            <h1 className="font-display text-2xl font-bold">{t('auth.register')}</h1>
            <p className="text-sm text-on-muted mt-1">Bắt đầu hành trình học tiếng Nhật</p>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          {emailExists && (
            <Alert type="warning">
              <span>Email <strong>{form.email}</strong> đã được đăng ký.</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <Link
                  to={`/login?email=${encodeURIComponent(form.email)}`}
                  className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Đăng nhập ngay
                </Link>
                <Link
                  to="/forgot-password"
                  className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Quên mật khẩu?
                </Link>
              </div>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t('auth.fullname')} value={form.fullname}
              onChange={e => setForm({ ...form, fullname: e.target.value })}
              placeholder="Nguyễn Văn A" required />
            <Input label={t('auth.email')} type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com" required />
            <Input label={t('auth.password')} type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Tối thiểu 8 ký tự" required />

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.terms}
                onChange={e => setForm({ ...form, terms: e.target.checked })}
                className="mt-0.5 accent-tsubaki-red" />
              <span className="text-sm text-on-muted">
                Tôi đồng ý với{' '}
                <Link to="#" className="text-tsubaki-red hover:underline">Điều khoản</Link>
                {' '}và{' '}
                <Link to="#" className="text-tsubaki-red hover:underline">Chính sách</Link>
              </span>
            </label>

            <Button type="submit" loading={loading} className="w-full mt-2">
              {t('auth.submit_register')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-outline/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/80 px-3 text-xs text-on-muted">hoặc tiếp tục với</span>
            </div>
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogleRegister} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-outline rounded-xl py-3 text-sm font-semibold text-charcoal hover:bg-surface-low hover:shadow-sm transition-all active:scale-[0.98] disabled:opacity-60">
            {googleLoading ? (
              <span className="material-symbols-outlined animate-spin text-lg text-on-muted">progress_activity</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            Đăng ký với Google
          </button>

          <p className="text-center text-sm text-on-muted">
            {t('auth.has_account')}{' '}
            <Link to="/login" className="text-tsubaki-red font-semibold hover:underline">{t('auth.login')}</Link>
          </p>

          <p className="text-center text-xs text-on-muted italic opacity-70 border-t border-outline/30 pt-4">
            {t('auth.zen_quote')}
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
