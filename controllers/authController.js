'use strict';

const { appName } = require('../config/site');
const { supabase, supabaseAdmin } = require('../config/supabase');

function loginErrorMsg(message, t) {
  if (message.includes('Invalid login credentials')) return t('errors.login_invalid');
  if (message.includes('Email not confirmed'))        return t('errors.login_not_confirmed');
  if (message.includes('Too many requests'))          return t('errors.login_too_many');
  return t('errors.login_failed');
}

function registerErrorMsg(message, t) {
  if (message.includes('User already registered') || message.includes('already registered'))
    return t('errors.register_already');
  if (message.includes('Password should be'))
    return t('errors.register_weak_pass');
  if (message.includes('Too many requests'))
    return t('errors.register_too_many');
  return t('errors.register_failed');
}

// ─── GET /login ──────────────────────────────────────────────────────────────
exports.getLogin = (req, res) => {
  const t = req.t;
  let success = null;
  if (req.query.registered === '1')      success = t('success.registered');
  if (req.query.passwordChanged === '1') success = t('success.password_changed');
  res.render('login', { title: `${appName} - ${t('auth.login_heading')}`, error: null, success });
};

// ─── POST /login ─────────────────────────────────────────────────────────────
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  const t = req.t;

  if (!email || !password) {
    return res.render('login', {
      title: `${appName} - ${t('auth.login_heading')}`,
      error: t('errors.login_missing'),
      success: null,
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.render('login', {
        title: `${appName} - ${t('auth.login_heading')}`,
        error: loginErrorMsg(error.message, t),
        success: null,
      });
    }

    req.session.user = {
      id: data.user.id,
      email: data.user.email,
      fullname: data.user.user_metadata?.full_name || data.user.email,
    };

    req.session.save(err => {
      if (err) console.error('Session save error:', err);
      res.redirect(303, '/dashboard');
    });
  } catch (err) {
    console.error('Unexpected login error:', err);
    res.render('login', {
      title: `${appName} - ${t('auth.login_heading')}`,
      error: t('errors.unexpected'),
      success: null,
    });
  }
};

// ─── GET /register ───────────────────────────────────────────────────────────
exports.getRegister = (req, res) => {
  res.render('register', { title: `${appName} - ${req.t('auth.submit_register')}`, error: null });
};

// ─── POST /register ──────────────────────────────────────────────────────────
exports.postRegister = async (req, res) => {
  const { fullname, email, password, terms } = req.body;
  const t = req.t;

  if (!fullname || !email || !password) {
    return res.render('register', {
      title: `${appName} - ${t('auth.submit_register')}`,
      error: t('errors.register_missing'),
    });
  }
  if (!terms) {
    return res.render('register', {
      title: `${appName} - ${t('auth.submit_register')}`,
      error: t('errors.register_terms'),
    });
  }
  if (password.length < 8) {
    return res.render('register', {
      title: `${appName} - ${t('auth.submit_register')}`,
      error: t('errors.register_pass_short'),
    });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullname.trim() },
      },
    });

    if (error) {
      return res.render('register', {
        title: `${appName} - ${t('auth.submit_register')}`,
        error: registerErrorMsg(error.message, t),
      });
    }

    if (!data.session) {
      return res.redirect(303, '/login?registered=1');
    }

    req.session.user = {
      id: data.user.id,
      email: data.user.email,
      fullname: fullname.trim(),
    };
    req.session.save(err => {
      if (err) console.error('Session save error:', err);
      res.redirect(303, '/dashboard');
    });
  } catch (err) {
    console.error('Unexpected register error:', err);
    res.render('register', {
      title: `${appName} - ${t('auth.submit_register')}`,
      error: t('errors.unexpected'),
    });
  }
};

// ─── GET /logout ─────────────────────────────────────────────────────────────
exports.getLogout = (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Session destroy error:', err);
    res.redirect(303, '/');
  });
};

// ─── GET /forgot-password ────────────────────────────────────────────────────
exports.getForgotPassword = (req, res) => {
  res.render('forgot-password', {
    title: `${appName} - ${req.t('auth.forgot_heading')}`,
    error: null,
    success: null,
  });
};

// ─── POST /forgot-password ───────────────────────────────────────────────────
exports.postForgotPassword = async (req, res) => {
  const { email } = req.body;
  const t = req.t;

  if (!email) {
    return res.render('forgot-password', {
      title: `${appName} - ${t('auth.forgot_heading')}`,
      error: t('errors.forgot_missing'),
      success: null,
    });
  }

  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });

    if (error) {
      return res.render('forgot-password', {
        title: `${appName} - ${t('auth.forgot_heading')}`,
        error: t('errors.forgot_failed'),
        success: null,
      });
    }

    res.render('forgot-password', {
      title: `${appName} - ${t('auth.forgot_heading')}`,
      error: null,
      success: t('success.forgot_sent'),
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.render('forgot-password', {
      title: `${appName} - ${t('auth.forgot_heading')}`,
      error: t('errors.unexpected'),
      success: null,
    });
  }
};

// ─── GET /reset-password ─────────────────────────────────────────────────────
exports.getResetPassword = (req, res) => {
  res.render('reset-password', {
    title:       `${appName} - ${req.t('auth.reset_heading')}`,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
  });
};

// ─── GET /auth/callback — trang trung gian xử lý Google OAuth ────────────────
exports.getAuthCallback = (req, res) => {
  res.render('auth-callback', { title: `${appName} - Đang xác thực...` });
};

// ─── POST /auth/google-session — nhận access_token từ browser, set session ───
exports.postGoogleSession = async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'Thiếu token.' });

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
    if (error || !user) return res.status(401).json({ error: 'Token không hợp lệ.' });

    req.session.user = {
      id:       user.id,
      email:    user.email,
      fullname: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    req.session.save(err => {
      if (err) console.error('Session save error:', err);
      res.json({ redirect: '/dashboard' });
    });
  } catch (err) {
    console.error('Google session error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi.' });
  }
};
