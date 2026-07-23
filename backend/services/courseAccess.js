'use strict';

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('course_module');

/**
 * Kiểm tra quyền xem nội dung học của một khóa.
 * Trả về null nếu được xem; ngược lại trả body lỗi 403.
 * - Mọi khóa (kể cả miễn phí): phải có course_enrollments — học viên bấm "Đăng ký"
 *   để tạo (khóa có phí tạo tự động sau khi thanh toán khớp).
 * - Admin và giáo viên tạo khóa được miễn.
 */
async function checkCourseContentAccess(courseId, user) {
  if (!courseId || !user) return null;
  if (user.user_metadata?.role === 'admin') return null;

  const { data: course } = await contentDb.from('courses')
    .select('is_free, price, created_by').eq('id', courseId).maybeSingle();
  if (!course) return null;
  if (course.created_by === user.id) return null;

  const { data: enr } = await contentDb.from('course_enrollments')
    .select('id').eq('course_id', courseId).eq('student_id', user.id).maybeSingle();
  if (enr) return null;

  const isFree = course.is_free || !(Number(course.price) > 0);
  return {
    error: isFree
      ? 'Bạn cần đăng ký khóa học này để xem nội dung.'
      : 'Bạn cần mua khóa học này để xem nội dung.',
    code: 'ENROLLMENT_REQUIRED',
    course_id: courseId,
    is_free: isFree,
  };
}

module.exports = { checkCourseContentAccess };
