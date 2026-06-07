import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({ baseURL: '/api' });

// Attach Supabase JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || 'Đã xảy ra lỗi. Vui lòng thử lại.';
    return Promise.reject(new Error(msg));
  }
);

export default api;
