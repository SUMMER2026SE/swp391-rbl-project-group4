'use strict';

// Thực thi tool của trợ lý AI bằng cách gọi lại chính API của mình, KÈM Bearer token
// của người dùng. Nhờ đó requireAuth + mọi kiểm tra sở hữu trong controller tự áp dụng
// → AI không thể đọc/sửa dữ liệu của người khác, kể cả khi bị prompt injection.
// (RLS đang TẮT toàn hệ thống nên đây là lớp bảo vệ thật sự duy nhất — tuyệt đối
//  không thay bằng truy vấn supabaseAdmin trực tiếp.)

const { BY_NAME, roleOf } = require('./registry');

const BASE = () => `http://127.0.0.1:${process.env.API_PORT || 3001}/api`;
const MAX_RESULT_CHARS = 4000; // cắt bớt để không thổi phồng prompt

function makeCaller(authorization) {
  return async function call(method, path, body) {
    const r = await fetch(BASE() + path, {
      method,
      headers: {
        Authorization: authorization,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) {
      const msg = data?.error || data?.message || `HTTP ${r.status}`;
      const e = new Error(msg); e.status = r.status; e.data = data;
      throw e;
    }
    return data;
  };
}

/**
 * Chạy 1 tool. Trả { ok, result } hoặc { ok:false, error }.
 * @param {string} name  tên tool (phải nằm trong whitelist)
 * @param {object} args  tham số do AI đề xuất (được validate lại ở server)
 * @param {object} ctx   { user, authorization }
 * @param {object} opts  { allowWrite } — chỉ true khi người dùng đã bấm xác nhận
 */
async function runTool(name, args = {}, ctx, opts = {}) {
  const tool = BY_NAME[name];
  if (!tool) return { ok: false, error: `Công cụ "${name}" không tồn tại.` };

  // Phân quyền theo vai trò
  const role = roleOf(ctx.user);
  if (!tool.roles.includes(role)) return { ok: false, error: 'Bạn không có quyền dùng công cụ này.' };

  // Ghi chỉ chạy khi đã được người dùng xác nhận
  if (tool.kind === 'write' && !opts.allowWrite)
    return { ok: false, error: 'Thao tác ghi cần người dùng xác nhận.' };

  // Validate tham số ở server (không tin AI)
  const bad = tool.validate ? tool.validate(args) : null;
  if (bad) return { ok: false, error: bad };

  const call = makeCaller(ctx.authorization);
  try {
    let body;
    if (tool.prepare)      body = await tool.prepare(args, { call });
    else if (tool.body)    body = tool.body(args);

    const result = await call(tool.method, tool.path(args), body);
    let json = JSON.stringify(result ?? null);
    if (json.length > MAX_RESULT_CHARS) json = json.slice(0, MAX_RESULT_CHARS) + '…(đã cắt bớt)';
    return { ok: true, result: json };
  } catch (err) {
    return { ok: false, error: err.message || 'Không thực hiện được.' };
  }
}

// Mô tả việc sắp làm để hiện thẻ xác nhận cho người dùng.
function describeAction(name, args = {}) {
  const tool = BY_NAME[name];
  if (!tool) return name;
  try { return tool.summary ? tool.summary(args) : tool.desc; }
  catch { return tool.desc; }
}

const isWrite = (name) => BY_NAME[name]?.kind === 'write';

module.exports = { runTool, describeAction, isWrite };
