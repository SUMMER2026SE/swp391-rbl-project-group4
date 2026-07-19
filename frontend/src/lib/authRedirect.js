// Điều hướng sau khi đăng nhập/đăng ký, và giữ ý định "đăng ký giáo viên" qua vòng
// redirect OAuth (Google). Ý định lưu ở sessionStorage vì state React mất sau redirect.

const KEY = 'pendingTeacherSignup';

export const setTeacherIntent   = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
export const clearTeacherIntent = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
const hasTeacherIntent = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

// Đưa user tới đúng trang theo vai trò; user có ý định giáo viên nhưng chưa được cấp
// quyền → tới bước nộp hồ sơ (/teacher-application).
export function postAuthRedirect(user, navigate) {
  const role = user?.user_metadata?.role;
  if (role === 'admin')   { clearTeacherIntent(); return navigate('/admin',   { replace: true }); }
  if (role === 'teacher') { clearTeacherIntent(); return navigate('/teacher',  { replace: true }); }
  if (hasTeacherIntent()) { clearTeacherIntent(); return navigate('/teacher-application', { replace: true }); }
  return navigate('/dashboard', { replace: true });
}
