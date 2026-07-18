'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { buildQrUrl } = require('./paymentOrderService');

const contentDb = supabaseAdmin.schema('content_module');

// Prefix riêng (khác PREM của premium) để webhook SePay phân biệt giao dịch mua khóa học.
const COURSE_PREFIX = process.env.COURSE_TRANSFER_CONTENT_PREFIX || 'COURSE';
const EXPIRE_MIN    = parseInt(process.env.PAYMENT_ORDER_EXPIRE_MINUTES || '30', 10);

function generatePaymentCode() {
  return COURSE_PREFIX + crypto.randomBytes(4).toString('hex').toUpperCase();
}

const ORDER_FIELDS = 'id, order_code, payment_code, amount, currency, qr_url, bank_code, account_number, expires_at, status, course_id';

// Lịch sử khóa học đã mua (đã thanh toán) của một học viên — kèm tên khóa.
async function listMyCoursePurchases(studentId) {
  const { data, error } = await contentDb
    .from('course_payment_orders')
    .select('id, order_code, payment_code, amount, currency, paid_at, course:courses(title)')
    .eq('student_id', studentId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────

async function createCourseOrder(studentId, courseId) {
  const { data: course, error: cErr } = await contentDb
    .from('courses')
    .select('id, is_free, price, is_published')
    .eq('id', courseId)
    .single();
  if (cErr || !course) throw new Error('Khóa học không tồn tại.');
  if (!course.is_published) throw new Error('Khóa học chưa được xuất bản.');
  if (course.is_free || !(Number(course.price) > 0))
    throw new Error('Khóa học miễn phí không cần thanh toán.');

  const { data: enrolled } = await contentDb.from('course_enrollments')
    .select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
  if (enrolled) throw new Error('Bạn đã sở hữu khóa học này.');

  // Hủy các order pending cũ của cùng student + course
  await contentDb.from('course_payment_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('status', 'pending');

  const paymentCode = generatePaymentCode();
  const orderCode   = `CRS-${studentId.slice(0, 6).toUpperCase()}-${Date.now()}`;
  const expiresAt   = new Date(Date.now() + EXPIRE_MIN * 60_000).toISOString();
  const amount      = Number(course.price);

  const { data, error } = await contentDb
    .from('course_payment_orders')
    .insert({
      student_id:     studentId,
      course_id:      courseId,
      order_code:     orderCode,
      payment_code:   paymentCode,
      amount,
      currency:       'VND',
      provider:       process.env.PAYMENT_PROVIDER || 'sepay',
      bank_code:      process.env.QR_BANK_CODE || '',
      account_number: process.env.QR_ACCOUNT_NUMBER || '',
      qr_url:         buildQrUrl(paymentCode, amount),
      status:         'pending',
      expires_at:     expiresAt,
    })
    .select(ORDER_FIELDS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function getCourseOrder(orderId, studentId = null) {
  let query = contentDb.from('course_payment_orders')
    .select(`${ORDER_FIELDS}, paid_at, created_at`)
    .eq('id', orderId);
  if (studentId) query = query.eq('student_id', studentId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function cancelCourseOrder(orderId, studentId) {
  const order = await getCourseOrder(orderId, studentId);
  if (!order) throw new Error('Order không tồn tại.');
  if (order.status !== 'pending') throw new Error('Chỉ có thể huỷ order đang chờ thanh toán.');

  const { error } = await contentDb.from('course_payment_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
  return true;
}

async function getPendingCourseOrder(studentId, courseId) {
  const { data } = await contentDb.from('course_payment_orders')
    .select(ORDER_FIELDS)
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Hoàn tất mua khóa học sau khi order đã khớp giao dịch (mirror activateSubscription):
 * ghi row 'completed' vào content_module.payments → trigger trg_payments_enroll (008)
 * tự tạo course_enrollments (idempotent qua NOT EXISTS trong trigger).
 */
async function completeCoursePayment(order, externalTransactionId) {
  const { data: course } = await contentDb.from('courses')
    .select('commission_rate').eq('id', order.course_id).single();

  const rate        = Number(course?.commission_rate ?? 0.10);
  const amount      = Number(order.amount);
  const platformFee = Math.round(amount * rate);

  const { error } = await contentDb.from('payments').insert({
    student_id:              order.student_id,
    course_id:               order.course_id,
    amount,
    platform_fee:            platformFee,
    teacher_payout:          amount - platformFee,
    payment_status:          'completed',
    payment_provider:        'sepay',
    provider_transaction_id: externalTransactionId != null ? String(externalTransactionId) : null,
  });
  if (error) throw new Error(error.message);
}

module.exports = {
  COURSE_PREFIX,
  createCourseOrder,
  getCourseOrder,
  cancelCourseOrder,
  getPendingCourseOrder,
  completeCoursePayment,
  listMyCoursePurchases,
};
