'use strict';

const { supabase, supabaseAdmin } = require('../config/supabase');

// POST /api/auth/register
exports.register = async (req, res) => {
  const { fullname, email, password } = req.body;
  if (!fullname || !email || !password)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });

  try {
    // Create user via admin API — email_confirm:true skips the confirmation email entirely
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullname.trim() },
      email_confirm: true,
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
        { id: created.user.id, full_name: fullname.trim(), email },
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
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) {
      // User created successfully — just can't auto-login (edge case); client will redirect to /login
      return res.status(201).json({ message: 'Đăng ký thành công. Vui lòng đăng nhập.', session: null });
    }

    res.status(201).json({
      message: 'Đăng ký thành công.',
      user: {
        id: loginData.user.id,
        email: loginData.user.email,
        fullname: fullname.trim(),
        role: loginData.user.user_metadata?.role || 'student',
      },
      session: loginData.session,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
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
