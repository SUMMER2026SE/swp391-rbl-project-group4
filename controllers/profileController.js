'use strict';

const path = require('path');
const { appName } = require('../config/site');
const { supabase, supabaseAdmin } = require('../config/supabase');

async function fetchProfileData(userId) {
  const [userRes, profileRes, dashRes] = await Promise.allSettled([
    supabaseAdmin
      .from('users')
      .select('full_name, email, phone, is_email_verified, avatar_url, date_of_birth')
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('student_profiles')
      .select('jlpt_target_level, current_level, study_goal, daily_study_minutes, streak_days')
      .eq('user_id', userId)
      .single(),
    supabaseAdmin
      .from('student_dashboards')
      .select('current_streak, total_study_minutes, longest_streak')
      .eq('student_id', userId)
      .single(),
  ]);
  return {
    userData:    userRes.status    === 'fulfilled' ? (userRes.value.data    || {}) : {},
    profileData: profileRes.status === 'fulfilled' ? (profileRes.value.data || {}) : {},
    dashData:    dashRes.status    === 'fulfilled' ? (dashRes.value.data    || {}) : {},
  };
}

// ─── GET /profile ────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  const t = req.t;
  try {
    const { userData, profileData, dashData } = await fetchProfileData(req.session.user.id);
    res.render('profile', {
      title:       `${appName} - ${t('profile.nav_profile')}`,
      user:        req.session.user,
      userData, profileData, dashData,
      saved:       req.query.saved       === '1',
      avatarSaved: req.query.avatarSaved === '1',
      avatarError: req.query.avatarError === '1',
      emailSent:   req.query.emailSent   === '1',
      error:       null,
    });
  } catch (err) {
    console.error('Profile GET error:', err);
    res.render('profile', {
      title: `${appName} - ${t('profile.nav_profile')}`,
      user: req.session.user,
      userData: {}, profileData: {}, dashData: {},
      saved: false, avatarSaved: false, avatarError: false, emailSent: false,
      error: t('errors.profile_load_failed'),
    });
  }
};

// ─── POST /profile ───────────────────────────────────────────────────────────
exports.postProfile = async (req, res) => {
  const userId = req.session.user.id;
  const t = req.t;
  const fullname   = req.body.fullname?.trim();
  const phone      = req.body.phone?.trim()      || null;
  const jlptTarget = req.body.jlptTarget?.trim() || null;
  const bio        = req.body.bio?.trim()        || null;

  if (!fullname) {
    const { userData, profileData, dashData } = await fetchProfileData(userId).catch(() => ({ userData: {}, profileData: {}, dashData: {} }));
    return res.render('profile', {
      title: `${appName} - ${t('profile.nav_profile')}`,
      user: req.session.user,
      userData, profileData, dashData,
      saved: false, error: t('errors.profile_fullname_required'),
    });
  }

  try {
    await Promise.all([
      supabaseAdmin.from('users')
        .update({ full_name: fullname, phone })
        .eq('id', userId),
      supabaseAdmin.from('student_profiles')
        .update({ jlpt_target_level: jlptTarget, study_goal: bio })
        .eq('user_id', userId),
      supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: fullname },
      }),
    ]);

    req.session.user.fullname = fullname;
    await new Promise(resolve => req.session.save(resolve));

    res.redirect(303, '/profile?saved=1');
  } catch (err) {
    console.error('Profile POST error:', err);
    const { userData, profileData, dashData } = await fetchProfileData(userId).catch(() => ({ userData: {}, profileData: {}, dashData: {} }));
    res.render('profile', {
      title: `${appName} - ${t('profile.nav_profile')}`,
      user: req.session.user,
      userData, profileData, dashData,
      saved: false, error: t('errors.profile_save_failed'),
    });
  }
};

// ─── POST /profile/avatar ────────────────────────────────────────────────────
exports.postAvatar = async (req, res) => {
  const userId = req.session.user.id;

  if (!req.file) {
    return res.redirect(303, '/profile?avatarError=1');
  }

  try {
    const ext      = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const fileName = `${userId}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabaseAdmin.from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    req.session.user.avatar_url = avatarUrl;
    await new Promise(resolve => req.session.save(resolve));

    res.redirect(303, '/profile?avatarSaved=1');
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.redirect(303, '/profile?avatarError=1');
  }
};

// ─── POST /profile/change-password ───────────────────────────────────────────
exports.postChangePassword = async (req, res) => {
  const email   = req.session.user.email;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  try {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });
  } catch (err) {
    console.error('Change password email error:', err);
  }

  res.redirect(303, '/profile?emailSent=1');
};
