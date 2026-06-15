import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  };

  // Bước 1: gửi thông tin đăng ký — backend gửi OTP về email
  const register = async (fullname, email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Đăng ký thất bại.');
      err.code = data.code;
      throw err;
    }
    return data; // { otpRequired: true }
  };

  // Bước 2: xác thực OTP — backend tạo tài khoản và trả session
  const verifyOtp = async (email, otp) => {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Xác thực thất bại.');
      err.code = data.code;
      throw err;
    }

    // Apply the session returned by the backend so the user is logged in immediately
    if (data.session) {
      await supabase.auth.setSession({
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    return data;
  };

  const resendOtp = async (email) => {
    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể gửi lại mã.');
    return data;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new Error(error.message);
  };

  // Bước 1: gửi OTP đặt lại mật khẩu qua SMTP (giống đăng ký)
  const forgotPassword = async (email) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể gửi mã.');
    return data;
  };

  // Bước 2: xác nhận OTP + đặt mật khẩu mới
  const resetPasswordOtp = async (email, otp, password) => {
    const res = await fetch('/api/auth/reset-password-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, password }),
    });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data.error || 'Đặt lại thất bại.'); e.code = data.code; throw e; }
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAdmin   = () => user?.user_metadata?.role === 'admin';
  const isTeacher = () => user?.user_metadata?.role === 'teacher';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, resendOtp, loginWithGoogle, forgotPassword, resetPasswordOtp, logout, isAdmin, isTeacher }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
