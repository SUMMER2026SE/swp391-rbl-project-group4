'use strict';

const { appName } = require('../config/site');
const { supabaseAdmin } = require('../config/supabase');

function getGreeting(t) {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return t('greetings.morning');
  if (h >= 12 && h < 14) return t('greetings.noon');
  if (h >= 14 && h < 18) return t('greetings.afternoon');
  if (h >= 18 && h < 22) return t('greetings.evening');
  return t('greetings.default');
}

function buildWeekCalendar(currentStreak, lastStudyDate, labels) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const anchor = lastStudyDate ? new Date(lastStudyDate) : today;
  anchor.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const isFuture = day > today;
    const isToday  = day.getTime() === today.getTime();
    const diffDays = Math.floor((anchor - day) / 864e5);
    const done     = !isFuture && diffDays >= 0 && diffDays < (currentStreak || 0);
    return { label: labels[i], num: day.getDate(), done, today: isToday, future: isFuture };
  });
}

exports.getDashboard = async (req, res) => {
  const userId = req.session.user.id;
  const t = req.t;

  const [profRes, dashRes] = await Promise.allSettled([
    supabaseAdmin
      .from('student_profiles')
      .select('jlpt_target_level, current_level, streak_days, last_study_date, daily_study_minutes, study_goal')
      .eq('user_id', userId)
      .single(),
    supabaseAdmin
      .from('student_dashboards')
      .select('current_streak, longest_streak, total_vocab_learned, total_kanji_learned, total_grammar_learned, total_study_minutes, total_exams_taken, avg_exam_score, skill_scores')
      .eq('student_id', userId)
      .single(),
  ]);

  const profile   = profRes.status  === 'fulfilled' ? (profRes.value.data  || {}) : {};
  const dashboard = dashRes.status  === 'fulfilled' ? (dashRes.value.data  || {}) : {};

  const skillScores = {
    listening: dashboard.skill_scores?.listening ?? 0,
    speaking:  dashboard.skill_scores?.speaking  ?? 0,
    reading:   dashboard.skill_scores?.reading   ?? 0,
    writing:   dashboard.skill_scores?.writing   ?? 0,
  };

  const streak       = dashboard.current_streak ?? profile.streak_days ?? 0;
  const dayLabels    = t('dashboard.day_labels');
  const weekCalendar = buildWeekCalendar(streak, profile.last_study_date, dayLabels);

  res.render('dashboard', {
    title:       `${appName} - ${t('dashboard.nav_dashboard')}`,
    user:        req.session.user,
    profile,
    dashboard,
    skillScores,
    greeting:    getGreeting(t),
    streak,
    weekCalendar,
  });
};
