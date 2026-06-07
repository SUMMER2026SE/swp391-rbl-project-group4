'use strict';

const path = require('path');
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
exports.uploadMiddleware = upload.single('avatar');

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const [userRes, profileRes, dashRes] = await Promise.allSettled([
      supabaseAdmin.from('users').select('full_name,email,phone,avatar_url,date_of_birth').eq('id', userId).single(),
      supabaseAdmin.from('student_profiles').select('jlpt_target_level,current_level,study_goal,daily_study_minutes,streak_days').eq('user_id', userId).single(),
      supabaseAdmin.from('student_dashboards').select('current_streak,total_study_minutes,longest_streak').eq('student_id', userId).single(),
    ]);
    res.json({
      userData:    userRes.status    === 'fulfilled' ? (userRes.value.data    || {}) : {},
      profileData: profileRes.status === 'fulfilled' ? (profileRes.value.data || {}) : {},
      dashData:    dashRes.status    === 'fulfilled' ? (dashRes.value.data    || {}) : {},
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  const userId   = req.user.id;
  const fullname = req.body.fullname?.trim();
  const phone    = req.body.phone?.trim()      || null;
  const jlpt     = req.body.jlptTarget?.trim() || null;
  const bio      = req.body.bio?.trim()        || null;

  if (!fullname) return res.status(400).json({ error: 'Họ và tên không được để trống.' });

  try {
    await Promise.all([
      supabaseAdmin.from('users').update({ full_name: fullname, phone }).eq('id', userId),
      supabaseAdmin.from('student_profiles').update({ jlpt_target_level: jlpt, study_goal: bio }).eq('user_id', userId),
      supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullname } }),
    ]);
    res.json({ message: 'Đã lưu thay đổi.' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Không thể lưu thay đổi.' });
  }
};

// POST /api/users/avatar
exports.uploadAvatar = async (req, res) => {
  const userId = req.user.id;
  if (!req.file) return res.status(400).json({ error: 'Không có file.' });

  try {
    const ext      = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const fileName = `${userId}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await Promise.all([
      supabaseAdmin.from('users').update({ avatar_url: avatarUrl }).eq('id', userId),
      supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { avatar_url: avatarUrl } }),
    ]);
    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Không thể tải ảnh lên.' });
  }
};

// POST /api/users/change-password
exports.changePassword = async (req, res) => {
  const userId   = req.user.id;
  const password = req.body.password?.trim();
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });

  try {
    // Use admin API — bypasses email confirmation entirely
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Không thể đổi mật khẩu.' });
  }
};

// GET /api/users/dashboard
exports.getDashboard = async (req, res) => {
  const userId = req.user.id;
  try {
    const [profRes, dashRes] = await Promise.allSettled([
      supabaseAdmin.from('student_profiles')
        .select('jlpt_target_level,current_level,streak_days,last_study_date,daily_study_minutes,study_goal')
        .eq('user_id', userId).single(),
      supabaseAdmin.from('student_dashboards')
        .select('current_streak,longest_streak,total_vocab_learned,total_kanji_learned,total_grammar_learned,total_study_minutes,total_exams_taken,avg_exam_score,skill_scores')
        .eq('student_id', userId).single(),
    ]);
    res.json({
      profile:   profRes.status  === 'fulfilled' ? (profRes.value.data  || {}) : {},
      dashboard: dashRes.status  === 'fulfilled' ? (dashRes.value.data  || {}) : {},
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};
