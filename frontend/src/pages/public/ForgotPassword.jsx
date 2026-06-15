import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import OtpInput, { OTP_LENGTH } from '../../components/ui/OtpInput';

export default function ForgotPassword() {
  const { t } = useLang();
  const { forgotPassword, resetPasswordOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]     = useState('email'); // 'email' | 'reset'
  const [email, setEmail]   = useState('');
  const [otp, setOtp]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    if (!email) return setError('Vui lòng nhập email.');
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep('reset');
      setOtp('');
      setResendIn(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError('');
    try { await forgotPassword(email); setResendIn(60); setOtp(''); }
    catch (err) { setError(err.message); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== OTP_LENGTH) return setError('Vui lòng nhập đủ 6 chữ số.');
    if (password.length < 8) return setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
    if (password !== confirm) return setError('Mật khẩu xác nhận không khớp.');
    setLoading(true);
    try {
      await resetPasswordOtp(email, otp, password);
      navigate('/login?passwordChanged=1', { replace: true });
    } catch (err) {
      setError(err.message);
      if (['OTP_EXPIRED', 'OTP_LOCKED', 'OTP_NOT_FOUND'].includes(err.code)) {
        setStep('email'); setOtp('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-3xl font-bold text-tsubaki-red tracking-tight block mb-2">
            Kizuna Nihongo
          </Link>
        </div>

        <div className="glass-card rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-tsubaki-red text-5xl mb-3 block">lock_reset</span>
            <h1 className="font-display text-2xl font-bold">{t('auth.forgot_heading')}</h1>
            <p className="text-sm text-on-muted mt-1">
              {step === 'email'
                ? 'Nhập email để nhận mã xác thực (OTP) đặt lại mật khẩu.'
                : <>Nhập mã 6 số đã gửi đến <strong className="text-charcoal">{email}</strong> và mật khẩu mới.</>}
            </p>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          {step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <Input label={t('auth.email')} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required />
              <Button type="submit" loading={loading} className="w-full mt-2">
                Gửi mã xác thực
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              <Input label="Mật khẩu mới" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự" required />
              <Input label="Xác nhận mật khẩu mới" type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Nhập lại mật khẩu mới" required />
              <Button type="submit" loading={loading} className="w-full mt-2">
                Đặt lại mật khẩu
              </Button>

              <p className="text-center text-sm text-on-muted">
                Không nhận được mã?{' '}
                {resendIn > 0 ? (
                  <span>Gửi lại sau {resendIn}s</span>
                ) : (
                  <button type="button" onClick={handleResend}
                    className="text-tsubaki-red font-semibold hover:underline">Gửi lại mã</button>
                )}
              </p>
            </form>
          )}

          <div className="text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              {t('auth.back_to_login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
