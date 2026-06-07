import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';

export default function Login() {
  const { login, loginWithGoogle, isAdmin, user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm]     = useState({ email: params.get('email') || '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const role = user.user_metadata?.role;
    if (role === 'admin')        navigate('/admin',    { replace: true });
    else if (role === 'teacher') navigate('/teacher',  { replace: true });
    else                         navigate('/dashboard', { replace: true });
  }, [user]);

  const success = params.get('registered') === '1' ? t('success.registered')
    : params.get('passwordChanged') === '1' ? t('success.password_changed')
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      // navigate handled by useEffect above
    } catch (err) {
      setError(err.message.includes('Invalid login') ? t('errors.login_invalid') : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // Browser redirects to Google — page unloads, no further action needed
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

        <div className="glass-card rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-tsubaki-red text-5xl mb-3 block">lock_open</span>
            <h1 className="font-display text-2xl font-bold">{t('auth.login')}</h1>
          </div>

          {success && <Alert type="success">{success}</Alert>}
          {error && <Alert type="error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t('auth.email')} type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com" required />
            <div>
              <Input label={t('auth.password')} type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" required />
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-tsubaki-red hover:underline">{t('auth.forgot')}</Link>
              </div>
            </div>
            <Button type="submit" loading={loading} className="w-full mt-2">
              {t('auth.submit_login')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-outline/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/80 px-3 text-xs text-on-muted">{t('auth.or_use')}</span>
            </div>
          </div>

          {/* Google login */}
          <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}
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
            Đăng nhập với Google
          </button>

          <p className="text-center text-sm text-on-muted">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="text-tsubaki-red font-semibold hover:underline">{t('auth.register')}</Link>
          </p>

          <p className="text-center text-xs text-on-muted italic opacity-70 border-t border-outline/30 pt-4">
            {t('auth.zen_quote')}
          </p>
        </div>

        <p className="text-center text-xs text-on-muted mt-6 opacity-60">{t('common.copyright')}</p>
      </div>
    </div>
  );
}
