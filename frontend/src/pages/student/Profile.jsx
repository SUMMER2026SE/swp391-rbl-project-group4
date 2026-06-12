import { useEffect, useRef, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import TeacherLayout from '../../components/layout/TeacherLayout';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function Profile() {
  const { user, isAdmin, isTeacher } = useAuth();
  // Mỗi role thấy layout riêng của mình khi vào hồ sơ
  const Layout = isAdmin() ? AdminLayout : isTeacher() ? TeacherLayout : StudentLayout;
  const isStudent = !isAdmin() && !isTeacher();
  const { t, lang, switchLang } = useLang();
  const fileInputRef = useRef(null);

  const [profileData, setProfileData] = useState({});
  const [userData, setUserData]       = useState({});
  const [dashData, setDashData]       = useState({});
  const [form, setForm]               = useState({ fullname: '', phone: '', jlptTarget: '', bio: '' });
  const [alert, setAlert]             = useState({ type: '', msg: '' });
  const [saving, setSaving]           = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile]   = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pwLoading, setPwLoading]     = useState(false);
  const [pwForm, setPwForm]           = useState({ current: '', password: '', confirm: '' });

  useEffect(() => {
    api.get('/users/profile').then(r => {
      setUserData(r.data.userData || {});
      setProfileData(r.data.profileData || {});
      setDashData(r.data.dashData || {});
      setForm({
        fullname:   r.data.userData?.full_name    || '',
        phone:      r.data.userData?.phone        || '',
        jlptTarget: r.data.profileData?.jlpt_target_level || '',
        bio:        r.data.profileData?.study_goal || '',
      });
    }).catch(e => setAlert({ type: 'error', msg: e.message }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert({ type: '', msg: '' });
    try {
      await api.put('/users/profile', form);
      setAlert({ type: 'success', msg: t('success.profile_saved') });
    } catch (err) {
      setAlert({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', avatarFile);
      await api.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAlert({ type: 'success', msg: t('success.avatar_saved') });
      setAvatarFile(null);
    } catch (err) {
      setAlert({ type: 'error', msg: err.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.current)
      return setAlert({ type: 'error', msg: 'Vui lòng nhập mật khẩu hiện tại.' });
    if (pwForm.password.length < 8)
      return setAlert({ type: 'error', msg: t('errors.reset_pass_short') });
    if (pwForm.password !== pwForm.confirm)
      return setAlert({ type: 'error', msg: t('errors.reset_mismatch') });
    if (pwForm.current === pwForm.password)
      return setAlert({ type: 'error', msg: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    setPwLoading(true);
    setAlert({ type: '', msg: '' });
    try {
      await api.post('/users/change-password', { currentPassword: pwForm.current, password: pwForm.password });
      setAlert({ type: 'success', msg: 'Đổi mật khẩu thành công!' });
      setPwForm({ current: '', password: '', confirm: '' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.message });
    } finally {
      setPwLoading(false);
    }
  };

  const avatarSrc = avatarPreview || userData?.avatar_url;

  return (
    <Layout title={t('profile.title')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-6">{alert.msg}</Alert>}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: avatar + stats */}
        <div className="flex flex-col gap-4">
          {/* Avatar */}
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl bg-tsubaki-red flex items-center justify-center">
                {avatarSrc
                  ? <img src={avatarSrc} className="w-full h-full object-cover" alt="" />
                  : <span className="text-white font-bold text-4xl">{form.fullname?.[0]?.toUpperCase() || '?'}</span>
                }
              </div>
              <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            {avatarFile && (
              <Button size="sm" loading={uploadingAvatar} onClick={handleAvatarUpload}>
                {t('profile.save_avatar') || 'Lưu ảnh'}
              </Button>
            )}
            <div className="text-center">
              <p className="font-bold text-lg">{form.fullname}</p>
              <p className="text-sm text-on-muted">{userData?.email}</p>
            </div>
          </div>

          {/* Stats — chỉ học sinh mới có dữ liệu học tập */}
          {isStudent && (
          <div className="glass-card rounded-2xl p-5 grid grid-cols-2 gap-4">
            {[
              { label: t('profile.total_hours_label') || 'Giờ học', value: Math.floor((dashData?.total_study_minutes || 0) / 60) },
              { label: t('profile.streak_label') || 'Streak', value: `${dashData?.current_streak || 0} ngày` },
              { label: t('profile.jlpt_target_label') || 'Mục tiêu', value: profileData?.jlpt_target_level || '—' },
              { label: t('profile.current_level') || 'Trình độ', value: profileData?.current_level || '—' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-bold font-display text-tsubaki-red">{s.value}</p>
                <p className="text-xs text-on-muted">{s.label}</p>
              </div>
            ))}
          </div>
          )}

          {/* Language switcher */}
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-medium text-on-muted mb-3">{t('profile.display_lang')}</p>
            <div className="flex gap-2">
              {[['vi','Tiếng Việt'],['ja','日本語']].map(([l, label]) => (
                <button key={l} onClick={() => switchLang(l)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${lang === l ? 'border-tsubaki-red text-tsubaki-red' : 'border-outline text-on-muted hover:bg-surface-low'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: forms */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Personal info */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-tsubaki-red">person</span>
              {t('profile.personal_info')}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Input label={t('profile.fullname')} value={form.fullname}
                  onChange={e => setForm({ ...form, fullname: e.target.value })} required />
                <div>
                  <label className="block text-sm font-medium text-on-muted mb-1">{t('profile.email')}</label>
                  <input value={userData?.email || ''} readOnly
                    className="w-full px-4 py-3 bg-surface-low border border-outline rounded-xl text-sm text-on-muted cursor-not-allowed" />
                </div>
                <Input label={t('profile.phone')} value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+84..." />
                {isStudent && (
                <div>
                  <label className="block text-sm font-medium text-on-muted mb-1">{t('profile.jlpt_goal')}</label>
                  <select value={form.jlptTarget} onChange={e => setForm({ ...form, jlptTarget: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors">
                    <option value="">-- Chưa chọn --</option>
                    {JLPT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                )}
              </div>
              {isStudent && (
              <div>
                <label className="block text-sm font-medium text-on-muted mb-1">{t('profile.bio')}</label>
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3}
                  placeholder="Chia sẻ đôi chút về hành trình học tiếng Nhật của bạn..."
                  className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none" />
              </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={saving}>{t('profile.save')}</Button>
                <Button type="button" variant="secondary" onClick={() => setForm({ fullname: userData?.full_name || '', phone: userData?.phone || '', jlptTarget: profileData?.jlpt_target_level || '', bio: profileData?.study_goal || '' })}>
                  {t('profile.cancel')}
                </Button>
              </div>
            </form>
          </div>

          {/* Change password */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-tsubaki-red">lock_reset</span>
              {t('profile.change_password')}
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input label="Mật khẩu hiện tại" type="password" value={pwForm.current}
                onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                placeholder="Nhập mật khẩu đang dùng" required />
              <Input label="Mật khẩu mới" type="password" value={pwForm.password}
                onChange={e => setPwForm({ ...pwForm, password: e.target.value })}
                placeholder="Tối thiểu 8 ký tự" required />
              <Input label="Xác nhận mật khẩu mới" type="password" value={pwForm.confirm}
                onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                placeholder="Nhập lại mật khẩu mới" required />
              <Button type="submit" loading={pwLoading}>
                <span className="material-symbols-outlined text-lg">lock_reset</span>
                Đổi mật khẩu
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
