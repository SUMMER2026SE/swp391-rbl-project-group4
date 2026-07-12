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
  async (err) => {
    const status = err.response?.status;

    // Token hết hạn / không hợp lệ → thử refresh 1 lần, thất bại thì đăng xuất
    if (status === 401 && err.config && !err.config._retried) {
      err.config._retried = true;
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data?.session) {
        err.config.headers.Authorization = `Bearer ${data.session.access_token}`;
        return api.request(err.config);
      }
      await supabase.auth.signOut();
      window.location.href = '/login?expired=1';
      return new Promise(() => {}); // trang sắp chuyển hướng — treo promise
    }

    const msg = err.response?.data?.error || 'Đã xảy ra lỗi. Vui lòng thử lại.';
    const wrapped = new Error(msg);
    wrapped.status = status;
    wrapped.data = err.response?.data;
    return Promise.reject(wrapped);
  }
);

// ── Course enrollment ─────────────────────────────────────────────────────────
export const enrollCourse        = (courseId) => api.post(`/courses/${courseId}/enroll`).then(r => r.data);
export const getEnrollmentStatus = (courseId) => api.get(`/courses/${courseId}/enrollment-status`).then(r => r.data);
export const unenrollCourse      = (courseId) => api.delete(`/courses/${courseId}/unenroll`).then(r => r.data);

// ── Course reviews ────────────────────────────────────────────────────────────
export const getCourseReviews = (courseId, page = 1, limit = 10) =>
  api.get(`/courses/${courseId}/reviews?page=${page}&limit=${limit}`).then(r => r.data);
export const createReview = (courseId, data)           => api.post(`/courses/${courseId}/reviews`, data).then(r => r.data);
export const updateReview = (courseId, reviewId, data) => api.put(`/courses/${courseId}/reviews/${reviewId}`, data).then(r => r.data);
export const deleteReview = (courseId, reviewId)       => api.delete(`/courses/${courseId}/reviews/${reviewId}`).then(r => r.data);

// ── Teacher applications (Đăng ký giáo viên) ──────────────────────────────────
export const submitTeacherApplication = (formData) =>
  api.post('/teacher-applications', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const getMyTeacherApplication = () => api.get('/teacher-applications/me').then(r => r.data);
export const adminListTeacherApplications = (status = 'pending') =>
  api.get(`/admin/teacher-applications?status=${status}`).then(r => r.data);
export const adminReviewTeacherApplication = (id, body) =>
  api.post(`/admin/teacher-applications/${id}/review`, body).then(r => r.data);

// ── Learning path (Lộ trình học) ──────────────────────────────────────────────
export const getLearningPath        = ()               => api.get('/learning-path').then(r => r.data);
export const generateLearningPath   = (body)           => api.post('/learning-path/generate', body).then(r => r.data);
export const regenerateLearningPath = (body)           => api.post('/learning-path/regenerate', body).then(r => r.data);
export const completeLearningStep   = (id, status = 'completed') =>
  api.patch(`/learning-path/steps/${id}`, { status }).then(r => r.data);

export default api;
