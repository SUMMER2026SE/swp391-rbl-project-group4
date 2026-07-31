'use strict';

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('course_module');

// Giáo viên cấp quyền học khoá của mình cho học viên theo email (không cần thanh toán).
// Quyền học = có row course_module.course_enrollments (xem services/courseAccess.js),
// nên cấp quyền = tạo enrollment với source='teacher_grant'.
//
// QUAN TRỌNG: chỉ enrollment do giáo viên cấp mới được thu hồi. Học viên tự đăng ký
// (self) hoặc đã thanh toán (purchase) phải giữ nguyên — nếu không sẽ xoá nhầm người
// đã bỏ tiền mua khoá học.

const MAX_EMAILS = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tách chuỗi người dùng dán vào (mỗi dòng / phân tách bằng dấu phẩy hoặc chấm phẩy)
// → mảng email đã chuẩn hoá, bỏ trùng, giữ thứ tự nhập.
function parseEmails(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[\n,;]+/);
  const seen = new Set();
  const emails = [];
  for (const item of raw) {
    const e = String(item || '').trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    emails.push(e);
  }
  return emails;
}

/**
 * Đối chiếu danh sách email với tài khoản trong hệ thống + trạng thái ghi danh hiện tại.
 * Dùng cho bước xác nhận trước khi cấp — giáo viên phải nhìn thấy đúng người rồi mới bấm.
 * Trả về mảng theo đúng thứ tự nhập, mỗi phần tử có `status`:
 *   ok        — sẽ được cấp
 *   already   — đã có quyền rồi (kèm source để hiển thị lý do)
 *   is_owner  — chính người tạo khoá
 *   not_found — email chưa có tài khoản
 */
async function resolveEmails(input, courseId, ownerId) {
  const emails = parseEmails(input);
  if (!emails.length) return { emails: [], results: [] };

  const invalid = emails.filter(e => !EMAIL_RE.test(e));
  if (invalid.length) {
    const err = new Error(`Email không hợp lệ: ${invalid.slice(0, 5).join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (emails.length > MAX_EMAILS) {
    const err = new Error(`Tối đa ${MAX_EMAILS} email mỗi lần (bạn nhập ${emails.length}).`);
    err.status = 400;
    throw err;
  }

  // public.users là view mirror của users_module.users
  const { data: users, error } = await supabaseAdmin
    .from('users').select('id, full_name, email, avatar_url').in('email', emails);
  if (error) throw new Error(error.message);

  const byEmail = new Map((users || []).map(u => [String(u.email || '').toLowerCase(), u]));

  const ids = (users || []).map(u => u.id);
  let enrolledBy = new Map();
  if (ids.length) {
    const { data: enr, error: eErr } = await contentDb.from('course_enrollments')
      .select('student_id, source').eq('course_id', courseId).in('student_id', ids);
    if (eErr) throw new Error(eErr.message);
    enrolledBy = new Map((enr || []).map(r => [r.student_id, r.source]));
  }

  const results = emails.map(email => {
    const u = byEmail.get(email);
    if (!u) return { email, status: 'not_found' };
    const base = { email, user_id: u.id, full_name: u.full_name, avatar_url: u.avatar_url };
    if (u.id === ownerId) return { ...base, status: 'is_owner' };
    if (enrolledBy.has(u.id)) return { ...base, status: 'already', source: enrolledBy.get(u.id) };
    return { ...base, status: 'ok' };
  });

  return { emails, results };
}

/**
 * Cấp quyền cho danh sách userId. Bỏ qua (không ghi đè) người đã có enrollment —
 * giữ nguyên source cũ để không biến người đã mua thành 'teacher_grant'.
 */
async function grantAccess(courseId, teacherId, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { granted: 0, skipped: 0, grantedIds: [] };

  const { data: existing, error: exErr } = await contentDb.from('course_enrollments')
    .select('student_id').eq('course_id', courseId).in('student_id', ids);
  if (exErr) throw new Error(exErr.message);

  const has = new Set((existing || []).map(r => r.student_id));
  const toInsert = ids.filter(id => !has.has(id) && id !== teacherId);
  if (!toInsert.length) return { granted: 0, skipped: ids.length, grantedIds: [] };

  const now = new Date().toISOString();
  const { data, error } = await contentDb.from('course_enrollments')
    .insert(toInsert.map(student_id => ({
      course_id: courseId,
      student_id,
      source: 'teacher_grant',
      granted_by: teacherId,
      granted_at: now,
    })))
    .select('student_id');
  if (error) throw new Error(error.message);

  const grantedIds = (data || []).map(r => r.student_id);
  return { granted: grantedIds.length, skipped: ids.length - grantedIds.length, grantedIds };
}

/** Danh sách học viên được cấp tay cho khoá này (chỉ source='teacher_grant'). */
async function listGranted(courseId) {
  const { data: rows, error } = await contentDb.from('course_enrollments')
    .select('student_id, granted_at, enrolled_at, progress_pct')
    .eq('course_id', courseId).eq('source', 'teacher_grant')
    .order('granted_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!rows?.length) return [];

  const { data: users } = await supabaseAdmin
    .from('users').select('id, full_name, email, avatar_url')
    .in('id', rows.map(r => r.student_id));
  const byId = new Map((users || []).map(u => [u.id, u]));

  return rows.map(r => {
    const u = byId.get(r.student_id) || {};
    return {
      student_id: r.student_id,
      full_name: u.full_name || null,
      email: u.email || null,
      avatar_url: u.avatar_url || null,
      granted_at: r.granted_at || r.enrolled_at,
      progress_pct: r.progress_pct,
    };
  });
}

/**
 * Thu hồi quyền. CHỈ xoá enrollment do giáo viên cấp — học viên tự đăng ký hoặc đã
 * thanh toán thì từ chối (tránh xoá mất quyền của người đã trả tiền).
 */
async function revokeAccess(courseId, studentId) {
  const { data: row, error } = await contentDb.from('course_enrollments')
    .select('id, source').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    const e = new Error('Học viên này không có quyền truy cập khoá học.');
    e.status = 404;
    throw e;
  }
  if (row.source !== 'teacher_grant') {
    const e = new Error('Học viên này tự đăng ký hoặc đã thanh toán — không thể thu hồi.');
    e.status = 409;
    throw e;
  }

  const { error: dErr } = await contentDb.from('course_enrollments').delete().eq('id', row.id);
  if (dErr) throw new Error(dErr.message);
  return true;
}

module.exports = { MAX_EMAILS, parseEmails, resolveEmails, grantAccess, listGranted, revokeAccess };
