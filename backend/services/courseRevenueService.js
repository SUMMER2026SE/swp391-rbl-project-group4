'use strict';

// Doanh thu bán khóa học — luồng tiền TÁCH RIÊNG với quỹ chia sẻ VIP:
// mỗi lượt mua, giáo viên nhận thẳng phần teacher_payout, nền tảng giữ platform_fee
// (tỷ lệ theo courses.commission_rate, mặc định 10%). Quỹ VIP ở revenuePoolService
// là tiền gói Premium chia theo lượt dùng nội dung — không liên quan tới file này.

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('course_module');
const billingDb = supabaseAdmin.schema('billing_module');

const PAYMENT_FIELDS = 'id, student_id, course_id, amount, platform_fee, teacher_payout, created_at';

const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);

// Gắn tên khóa học vào các dòng payment (khác schema nên không embed được).
async function attachCourseTitles(rows) {
  const ids = [...new Set(rows.map(r => r.course_id).filter(Boolean))];
  if (!ids.length) return rows.map(r => ({ ...r, course: null }));

  const { data } = await contentDb.from('courses').select('id, title').in('id', ids);
  const map = Object.fromEntries((data || []).map(c => [c.id, c]));
  return rows.map(r => ({ ...r, course: map[r.course_id] || null }));
}

// Gắn thông tin học viên vào các dòng payment.
async function attachStudents(rows) {
  const ids = [...new Set(rows.map(r => r.student_id).filter(Boolean))];
  if (!ids.length) return rows.map(r => ({ ...r, student: null }));

  const { data } = await supabaseAdmin.from('users').select('id, full_name, email').in('id', ids);
  const map = Object.fromEntries((data || []).map(u => [u.id, u]));
  return rows.map(r => ({ ...r, student: map[r.student_id] || null }));
}

/**
 * Doanh thu bán khóa của một giáo viên: tổng đã bán, phần thực nhận sau hoa hồng,
 * và chi tiết theo từng khóa.
 */
async function getTeacherCourseRevenue(teacherId) {
  const { data: courses } = await contentDb
    .from('courses')
    .select('id, title, price, commission_rate')
    .eq('created_by', teacherId);

  const courseIds = (courses || []).map(c => c.id);
  const empty = { total_gross: 0, total_payout: 0, total_fee: 0, total_sales: 0, by_course: [] };
  if (!courseIds.length) return empty;

  const { data: payments } = await billingDb
    .from('payments')
    .select(PAYMENT_FIELDS)
    .eq('payment_status', 'completed')
    .in('course_id', courseIds);

  const rows = payments || [];

  // Chỉ liệt kê khóa đã bán được ít nhất 1 lượt, sắp xếp theo tiền thực nhận giảm dần.
  const by_course = (courses || [])
    .map(c => {
      const mine = rows.filter(p => p.course_id === c.id);
      return {
        course_id:      c.id,
        title:          c.title,
        sales:          mine.length,
        gross:          sum(mine, 'amount'),
        payout:         sum(mine, 'teacher_payout'),
        fee:            sum(mine, 'platform_fee'),
        commission_rate: Number(c.commission_rate ?? 0.10),
      };
    })
    .filter(c => c.sales > 0)
    .sort((a, b) => b.payout - a.payout);

  return {
    total_gross:  sum(rows, 'amount'),
    total_payout: sum(rows, 'teacher_payout'),
    total_fee:    sum(rows, 'platform_fee'),
    total_sales:  rows.length,
    by_course,
  };
}

/**
 * Toàn hệ thống: tổng tiền bán khóa, phần nền tảng thu, phần phải trả giáo viên,
 * kèm danh sách giao dịch có phân trang.
 */
async function getPlatformCourseRevenue({ page = 1, limit = 20 } = {}) {
  // Tổng phải tính trên toàn bộ giao dịch, không phải chỉ trang hiện tại.
  const { data: all } = await billingDb
    .from('payments')
    .select('amount, platform_fee, teacher_payout')
    .eq('payment_status', 'completed');

  const rows = all || [];
  const offset = (page - 1) * limit;

  const { data: pageRows, count } = await billingDb
    .from('payments')
    .select(PAYMENT_FIELDS, { count: 'exact' })
    .eq('payment_status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const transactions = await attachStudents(await attachCourseTitles(pageRows || []));

  return {
    total_gross:  sum(rows, 'amount'),
    total_fee:    sum(rows, 'platform_fee'),
    total_payout: sum(rows, 'teacher_payout'),
    total_sales:  rows.length,
    transactions,
    total: count || 0,
    page,
    limit,
  };
}

module.exports = { getTeacherCourseRevenue, getPlatformCourseRevenue };
