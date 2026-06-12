'use strict';

const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { sendOtpEmail } = require('../config/mailer');

// ── OTP store (in-memory) ─────────────────────────────────────────────────────
// email -> { fullname, password, otpHash, expiresAt, attempts, lastSentAt }
const OTP_TTL_MS      = 10 * 60 * 1000; // 10 phút
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60s giữa 2 lần gửi
const pendingRegistrations = new Map();

// Dọn các đăng ký hết hạn mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [email, p] of pendingRegistrations) {
    if (p.expiresAt < now) pendingRegistrations.delete(email);
  }
}, 5 * 60 * 1000).unref();

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');
const genOtp  = () => crypto.randomInt(100000, 1000000).toString();

async function emailAlreadyRegistered(email) {
  const { data } = await supabaseAdmin.from('users').select('id').ilike('email', email).limit(1);
  return Array.isArray(data) && data.length > 0;
}

// POST /api/auth/register — bước 1: nhận thông tin, gửi OTP qua SMTP
exports.register = async (req, res) => {
  const { fullname, email, password } = req.body;
  if (!fullname || !email || !password)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });

  const normEmail = email.trim().toLowerCase();
  try {
    if (await emailAlreadyRegistered(normEmail)) {
      return res.status(400).json({ error: 'Email này đã được đăng ký.', code: 'EMAIL_EXISTS' });
    }

    const existing = pendingRegistrations.get(normEmail);
    if (existing && Date.now() - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitS = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
      return res.status(429).json({ error: `Vui lòng đợi ${waitS} giây trước khi gửi lại mã.` });
    }

    const otp = genOtp();
    pendingRegistrations.set(normEmail, {
      fullname: fullname.trim(),
      password,
      otpHash: hashOtp(otp),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: Date.now(),
    });

    await sendOtpEmail(normEmail, otp, fullname.trim());
    res.json({ otpRequired: true, message: 'Mã xác thực đã được gửi đến email của bạn.' });
  } catch (err) {
    console.error('Register/send OTP error:', err);
    pendingRegistrations.delete(normEmail);
    res.status(500).json({ error: 'Không thể gửi email xác thực. Vui lòng thử lại.' });
  }
};

// POST /api/auth/verify-otp — bước 2: kiểm tra OTP, tạo tài khoản
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Thiếu email hoặc mã OTP.' });

  const normEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations.get(normEmail);

  if (!pending)
    return res.status(400).json({ error: 'Không tìm thấy yêu cầu đăng ký. Vui lòng đăng ký lại.', code: 'OTP_NOT_FOUND' });
  if (pending.expiresAt < Date.now()) {
    pendingRegistrations.delete(normEmail);
    return res.status(400).json({ error: 'Mã OTP đã hết hạn. Vui lòng đăng ký lại.', code: 'OTP_EXPIRED' });
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    pendingRegistrations.delete(normEmail);
    return res.status(400).json({ error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng đăng ký lại.', code: 'OTP_LOCKED' });
  }
  if (hashOtp(String(otp).trim()) !== pending.otpHash) {
    pending.attempts += 1;
    const left = OTP_MAX_ATTEMPTS - pending.attempts;
    return res.status(400).json({ error: `Mã OTP không đúng. Còn ${left} lần thử.`, code: 'OTP_WRONG' });
  }

  // OTP đúng → tạo tài khoản
  try {
    const { fullname, password } = pending;
    pendingRegistrations.delete(normEmail);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: normEmail,
      password,
      user_metadata: { full_name: fullname },
      email_confirm: true, // đã xác thực qua OTP của hệ thống
    });
    if (createErr) {
      const isDuplicate = createErr.message.includes('already registered') ||
                          createErr.message.includes('already been registered');
      return res.status(400).json({
        error: isDuplicate ? 'Email này đã được đăng ký.' : createErr.message,
        code:  isDuplicate ? 'EMAIL_EXISTS' : 'REGISTER_ERROR',
      });
    }

    // Ensure profile rows exist (trigger does this too — belt-and-suspenders)
    await Promise.allSettled([
      supabaseAdmin.from('users').upsert(
        { id: created.user.id, full_name: fullname, email: normEmail },
        { onConflict: 'id', ignoreDuplicates: true }
      ),
      supabaseAdmin.from('student_profiles').upsert(
        { user_id: created.user.id },
        { onConflict: 'user_id', ignoreDuplicates: true }
      ),
      supabaseAdmin.from('student_dashboards').upsert(
        { student_id: created.user.id },
        { onConflict: 'student_id', ignoreDuplicates: true }
      ),
    ]);

    // Sign in immediately so we can return a live session to the frontend
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: normEmail, password });
    if (loginErr) {
      return res.status(201).json({ message: 'Đăng ký thành công. Vui lòng đăng nhập.', session: null });
    }

    res.status(201).json({
      message: 'Đăng ký thành công.',
      user: {
        id: loginData.user.id,
        email: loginData.user.email,
        fullname,
        role: loginData.user.user_metadata?.role || 'student',
      },
      session: loginData.session,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
  }
};

// POST /api/auth/resend-otp — gửi lại mã
exports.resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Thiếu email.' });

  const normEmail = email.trim().toLowerCase();
  const pending = pendingRegistrations.get(normEmail);
  if (!pending)
    return res.status(400).json({ error: 'Không tìm thấy yêu cầu đăng ký. Vui lòng đăng ký lại.', code: 'OTP_NOT_FOUND' });

  if (Date.now() - pending.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const waitS = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - pending.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Vui lòng đợi ${waitS} giây trước khi gửi lại mã.` });
  }

  try {
    const otp = genOtp();
    pending.otpHash    = hashOtp(otp);
    pending.expiresAt  = Date.now() + OTP_TTL_MS;
    pending.attempts   = 0;
    pending.lastSentAt = Date.now();

    await sendOtpEmail(normEmail, otp, pending.fullname);
    res.json({ message: 'Đã gửi lại mã xác thực.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    const user = data.user;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullname: user.user_metadata?.full_name || email,
        role: user.user_metadata?.role || 'student',
        avatar_url: user.user_metadata?.avatar_url || null,
      },
      session: data.session,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Vui lòng nhập email.' });

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Email khôi phục đã được gửi. Vui lòng kiểm tra hộp thư.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Không thể gửi email.' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = req.user;
  try {
    const [profileRes, dashRes] = await Promise.allSettled([
      supabaseAdmin.from('student_profiles')
        .select('jlpt_target_level, current_level, study_goal, daily_study_minutes, streak_days')
        .eq('user_id', user.id).single(),
      supabaseAdmin.from('student_dashboards')
        .select('current_streak, total_study_minutes, total_vocab_learned, total_kanji_learned, total_grammar_learned, total_exams_taken, avg_exam_score')
        .eq('student_id', user.id).single(),
    ]);

    res.json({
      id: user.id,
      email: user.email,
      fullname: user.user_metadata?.full_name || user.email,
      role: user.user_metadata?.role || 'student',
      avatar_url: user.user_metadata?.avatar_url || null,
      profile: profileRes.status === 'fulfilled' ? (profileRes.value.data || {}) : {},
      dashboard: dashRes.status === 'fulfilled' ? (dashRes.value.data || {}) : {},
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};
