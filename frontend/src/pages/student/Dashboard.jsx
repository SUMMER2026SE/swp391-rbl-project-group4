import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

function StatCard({ label, value, icon, color = 'text-tsubaki-red', loading }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <span className={`material-symbols-outlined text-3xl ${color}`}>{icon}</span>
      <div>
        {loading
          ? <div className="h-7 w-12 bg-surface-low rounded animate-pulse mb-1" />
          : <p className="text-2xl font-bold font-display text-charcoal">{value ?? 0}</p>
        }
        <p className="text-xs text-on-muted font-medium">{label}</p>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-3 animate-pulse">
      <div className="h-5 w-32 bg-surface-low rounded" />
      <div className="h-10 w-20 bg-surface-low rounded" />
      <div className="h-4 w-48 bg-surface-low rounded" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [dashData, setDashData]     = useState(null);
  const [latestCourse, setLatestCourse] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const fullname = user?.user_metadata?.full_name || user?.email || '';
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  useEffect(() => {
    Promise.allSettled([
      api.get('/users/dashboard'),
      api.get('/courses?limit=1&page=1'),
    ]).then(([dashRes, courseRes]) => {
      if (dashRes.status === 'fulfilled') setDashData(dashRes.value.data);
      else setError(dashRes.reason.message);
      if (courseRes.status === 'fulfilled') setLatestCourse(courseRes.value.data.data?.[0] || null);
    }).finally(() => setLoading(false));
  }, []);

  const dash    = dashData?.dashboard || {};
  const profile = dashData?.profile   || {};
  const streak  = dash.current_streak ?? 0;
  const recentActivity = dashData?.recentActivity || [];
  const myClasses      = dashData?.myClasses || [];
  return (
    <StudentLayout title={t('dashboard.title')}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Hero greeting */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-on-muted uppercase tracking-widest mb-1">{greeting}</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-charcoal">
          {fullname}
        </h1>
        <p className="text-sm text-on-muted mt-1 italic">
          Hành trình vạn dặm bắt đầu từ những bước chân nhỏ bé hôm nay.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard loading={loading} label={t('dashboard.vocab_learned')}   value={dash.total_vocab_learned}   icon="translate" />
        <StatCard loading={loading} label={t('dashboard.kanji_learned')}   value={dash.total_kanji_learned}   icon="font_download" color="text-sumire-purple" />
        <StatCard loading={loading} label={t('dashboard.grammar_learned')} value={dash.total_grammar_learned} icon="spellcheck"    color="text-green-600" />
        <StatCard loading={loading} label={t('dashboard.total_hours')}     value={Math.floor((dash.total_study_minutes || 0) / 60)} icon="schedule" color="text-amber-500" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Streak */}
        {loading ? <CardSkeleton /> : (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-500 text-2xl fill">local_fire_department</span>
              <h2 className="font-display font-bold text-lg">{t('dashboard.streak')}</h2>
            </div>
            {streak > 0 ? (
              <>
                <p className="text-4xl font-bold font-display text-tsubaki-red mb-1">
                  {streak} <span className="text-lg text-on-muted font-normal">ngày</span>
                </p>
                <p className="text-sm text-on-muted">
                  {streak >= 7
                    ? 'Xuất sắc! Não bộ đang hấp thụ kiến thức theo cấp số nhân.'
                    : streak >= 3
                    ? 'Hãy duy trì thêm để kiến thức đi vào tiềm thức.'
                    : 'Tuyệt vời! Hãy tiếp tục giữ vững chuỗi ngày này.'}
                </p>
              </>
            ) : (
              <div>
                <p className="text-4xl font-bold font-display text-on-muted/30 mb-2">0</p>
                <p className="text-sm text-on-muted">Bắt đầu học hôm nay để tạo chuỗi ngày đầu tiên!</p>
                <Link to="/courses" className="mt-3 inline-flex items-center gap-1 text-sm text-tsubaki-red font-semibold hover:underline">
                  Xem khóa học <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* JLPT Goal */}
        {loading ? <CardSkeleton /> : (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-sumire-purple text-2xl">workspace_premium</span>
              <h2 className="font-display font-bold text-lg">Mục tiêu JLPT</h2>
            </div>
            {profile.jlpt_target_level ? (
              <>
                <p className="text-4xl font-bold font-display text-sumire-purple mb-1">{profile.jlpt_target_level}</p>
                <p className="text-sm text-on-muted">
                  Trình độ hiện tại: <strong>{profile.current_level || 'Chưa xác định'}</strong>
                </p>
              </>
            ) : (
              <div>
                <p className="text-4xl font-bold font-display text-on-muted/30 mb-2">—</p>
                <p className="text-sm text-on-muted mb-3">Chưa đặt mục tiêu JLPT.</p>
                <Link to="/profile" className="inline-flex items-center gap-1 text-sm text-sumire-purple font-semibold hover:underline">
                  Thiết lập ngay <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Next course / CTA */}
        {loading ? <CardSkeleton /> : (
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
            {latestCourse ? (
              <>
                <div>
                  <p className="text-xs font-bold text-tsubaki-red uppercase tracking-widest mb-2">{t('dashboard.next_lesson')}</p>
                  {latestCourse.level && (
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-tsubaki-red/10 text-tsubaki-red font-bold mb-2">
                      {latestCourse.level}
                    </span>
                  )}
                  <h3 className="font-display font-bold text-base mb-1 line-clamp-2">{latestCourse.title}</h3>
                  {latestCourse.description && (
                    <p className="text-sm text-on-muted line-clamp-2">{latestCourse.description}</p>
                  )}
                </div>
                <Link
                  to={`/courses/${latestCourse.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-tsubaki-red font-semibold hover:underline"
                >
                  {t('dashboard.start_now')} <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs font-bold text-on-muted uppercase tracking-widest mb-2">Khám phá</p>
                  <h3 className="font-display font-bold text-base mb-1">Chưa có khóa học nào</h3>
                  <p className="text-sm text-on-muted">Các khóa học mới sẽ sớm được thêm vào.</p>
                </div>
                <Link
                  to="/courses"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-tsubaki-red font-semibold hover:underline"
                >
                  Xem tất cả <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
        {/* Recent activity & My classes */}
        <div className="mt-6 grid md:grid-cols-2 gap-6">
            {/* Recent Activity Log */}
            {loading ? <CardSkeleton /> : (
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-tsubaki-red text-2xl">history</span>
                        <h2 className="font-display font-bold text-lg">{t('dashboard.recent_activity')}</h2>
                    </div>
                    {recentActivity.length > 0 ? (
                        <div className="space-y-2">
                            {recentActivity.map(a => {
                                const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
                                const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
                                return (
                                    <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-low/40">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="material-symbols-outlined text-on-muted shrink-0">quiz</span>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate">{a.quiz_title}</p>
                                                <p className="text-xs text-on-muted mt-0.5">{a.completed_at ? new Date(a.completed_at).toLocaleString('vi-VN') : '—'}</p>
                                            </div>
                                        </div>
                                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>{a.score}/{a.total_questions} ({pct}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-on-muted">{t('dashboard.no_activity')}</p>
                    )}
                </div>
            )}

            {/* My Classes */}
            {loading ? <CardSkeleton /> : (
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-sumire-purple text-2xl">school</span>
                        <h2 className="font-display font-bold text-lg">{t('dashboard.my_classes')}</h2>
                    </div>
                    {myClasses.length > 0 ? (
                        <div className="space-y-2">
                            {myClasses.map(e => (
                                <Link key={e.id} to="/classes" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-low/40 hover:bg-surface-low transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm truncate">{e.class?.name || '—'}</p>
                                        {e.class?.description && <p className="text-xs text-on-muted mt-0.5 truncate">{e.class.description}</p>}
                                    </div>
                                    <span className="material-symbols-outlined text-on-muted shrink-0">chevron_right</span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-on-muted mb-3">{t('dashboard.no_classes')}</p>
                            <Link to="/classes" className="inline-flex items-center gap-1 text-sm text-sumire-purple font-semibold hover:underline">
                                {t('dashboard.classes')} <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
      {/* Quick links */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/courses',    icon: 'menu_book',  label: t('courses.title') },
          { to: '/vocabulary', icon: 'translate',  label: t('vocab.title') },
          { to: '/profile',    icon: 'person',     label: t('profile.title') },
          { to: '/courses',    icon: 'quiz',       label: 'Bài kiểm tra' },
        ].map(link => (
          <Link key={link.to + link.label} to={link.to}
            className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-lg hover:border-tsubaki-red/20 transition-all group">
            <span className="material-symbols-outlined text-2xl text-tsubaki-red group-hover:scale-110 transition-transform">{link.icon}</span>
            <span className="text-sm font-semibold text-charcoal">{link.label}</span>
          </Link>
        ))}
      </div>
    </StudentLayout>
  );
}
