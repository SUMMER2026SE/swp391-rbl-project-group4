import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../contexts/LangContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email) return setError('Vui lòng nhập email.');
    setLoading(true);
    try {
      // Must be called from the browser so the PKCE code verifier
      // is stored in localStorage — the same browser that clicks the link
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      setSuccess(t('success.forgot_sent'));
    } catch (err) {
      setError(err.message);
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
            <p className="text-sm text-on-muted mt-1">{t('auth.forgot_sub')}</p>
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label={t('auth.email')} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required />
              <Button type="submit" loading={loading} className="w-full mt-2">
                {t('auth.forgot_submit')}
              </Button>
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
