import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../contexts/LangContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';

export default function ResetPassword() {
  const { t } = useLang();
  const [state, setState]   = useState('detecting'); // detecting | form | invalid
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    const hashParams  = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    const code         = queryParams.get('code');
    const accessToken  = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type         = hashParams.get('type');
    const hashError    = hashParams.get('error');

    const client = supabase;
    clientRef.current = client;

    if (code) {
      client.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) { setState('invalid'); setError(t('errors.reset_expired')); }
        else { history.replaceState(null, '', window.location.pathname); setState('form'); }
      });
    } else if (accessToken && type === 'recovery') {
      client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) { setState('invalid'); setError(t('errors.reset_expired')); }
        else { history.replaceState(null, '', window.location.pathname); setState('form'); }
      });
    } else if (hashError) {
      setState('invalid'); setError(t('errors.reset_expired'));
    } else {
      setState('invalid'); setError(t('errors.link_invalid'));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError(t('errors.reset_pass_short'));
    if (form.password !== form.confirm) return setError(t('errors.reset_mismatch'));
    setLoading(true);
    try {
      const { error } = await clientRef.current.auth.updateUser({ password: form.password });
      if (error) throw new Error(error.message);
      window.location.href = '/login?passwordChanged=1';
    } catch (err) {
      setError(err.message || t('errors.unexpected'));
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
            <span className="material-symbols-outlined text-tsubaki-red text-5xl mb-3 block">lock_open</span>
            <h1 className="font-display text-2xl font-bold">{t('auth.reset_heading')}</h1>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          {state === 'detecting' && (
            <div className="text-center py-4">
              <span className="material-symbols-outlined animate-spin text-on-muted text-4xl">progress_activity</span>
              <p className="text-sm text-on-muted mt-2">{t('auth.detecting')}</p>
            </div>
          )}

          {state === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label={t('auth.new_password')} type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Tối thiểu 8 ký tự" required />
              <Input label={t('auth.confirm_password')} type="password" value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                placeholder="Nhập lại mật khẩu mới" required />
              <Button type="submit" loading={loading} className="w-full">
                {t('auth.reset_submit')}
              </Button>
            </form>
          )}

          {state === 'invalid' && (
            <div className="text-center">
              <Link to="/forgot-password" className="inline-flex items-center gap-1 text-tsubaki-red text-sm font-semibold hover:underline">
                <span className="material-symbols-outlined text-lg">refresh</span>
                {t('auth.resend_reset')}
              </Link>
            </div>
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
