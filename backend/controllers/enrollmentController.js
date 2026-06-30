'use strict';

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('content_module');

// POST /api/courses/:id/enroll
// - Khóa miễn phí → đăng ký thẳng.
// - Khóa có phí → phải có payment 'completed' trước, nếu không trả 402.
// - Không cho đăng ký 2 lần (UNIQUE course_id+student_id).
exports.enroll = async (req, res) => {
  const courseId = req.params.id;
  const studentId = req.user.id;
  try {
    const { data: course, error: cErr } = await contentDb.from('courses')
      .select('id,is_free').eq('id', courseId).single();
    if (cErr || !course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });

    const { data: existing } = await contentDb.from('course_enrollments')
      .select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Bạn đã đăng ký khóa học này.' });

    // TODO(payment): tạm thời cho đăng ký khóa có phí mà không cần payment 'completed'
    // (chưa có cổng thanh toán) để học viên trải nghiệm luồng vào học. Khi tích hợp
    // VNPay/Momo, khôi phục lại kiểm tra: nếu !course.is_free và chưa có payment completed → 402.

    const { data, error } = await contentDb.from('course_enrollments')
      .insert({ course_id: courseId, student_id: studentId }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Bạn đã đăng ký khóa học này.' });
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ error: 'Không thể đăng ký khóa học.' });
  }
};

// GET /api/courses/:id/enrollment-status → { enrolled, payment_status }
exports.status = async (req, res) => {
  const courseId = req.params.id;
  const studentId = req.user.id;
  try {
    const { data: enr } = await contentDb.from('course_enrollments')
      .select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
    const { data: pay } = await contentDb.from('payments')
      .select('payment_status').eq('course_id', courseId).eq('student_id', studentId)
      .order('created_at', { ascending: false }).limit(1);
    res.json({
      enrolled: !!enr,
      payment_status: pay && pay.length ? pay[0].payment_status : null,
    });
  } catch (err) {
    console.error('Enrollment status error:', err);
    res.status(500).json({ error: 'Không thể tải trạng thái đăng ký.' });
  }
};

// DELETE /api/courses/:id/unenroll — chỉ cho hủy khóa miễn phí.
exports.unenroll = async (req, res) => {
  const courseId = req.params.id;
  const studentId = req.user.id;
  try {
    const { data: course, error: cErr } = await contentDb.from('courses')
      .select('id,is_free').eq('id', courseId).single();
    if (cErr || !course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });
    if (!course.is_free)
      return res.status(403).json({ error: 'Không thể tự hủy đăng ký khóa học có phí.' });

    const { error } = await contentDb.from('course_enrollments')
      .delete().eq('course_id', courseId).eq('student_id', studentId);
    if (error) throw error;
    res.json({ message: 'Đã hủy đăng ký khóa học.' });
  } catch (err) {
    console.error('Unenroll error:', err);
    res.status(500).json({ error: 'Không thể hủy đăng ký.' });
  }
};
