-- ═══════════════════════════════════════════════════════════════════════════════
-- 005 — Tài khoản ngân hàng nhận thu nhập của giáo viên
--
-- Chạy file này trên Supabase SQL Editor. Idempotent — chạy lại nhiều lần an toàn.
--
-- LÝ DO: hệ thống tính ra được mỗi giáo viên nhận bao nhiêu (quỹ chia sẻ Premium +
-- tiền bán khoá học) và tạo lệnh chi trong billing_module.teacher_payouts, nhưng
-- việc chuyển khoản thật do admin thực hiện thủ công — API chi tiền ra tài khoản
-- người khác đòi hỏi pháp nhân doanh nghiệp và hợp đồng với trung gian thanh toán.
--
-- Trước migration này admin nhìn thấy "phải trả 49.016đ" nhưng không biết chuyển
-- vào đâu, phải hỏi riêng từng giáo viên. 3 cột dưới đây khép kín mắt xích đó.
--
-- Lưu ý: các cột bank_code/account_number đã có ở billing_module.payment_orders là
-- tài khoản NHẬN tiền của nền tảng (để sinh mã QR), không liên quan tới đây.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users_module.users
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name   text;

COMMENT ON COLUMN users_module.users.bank_name           IS 'Tên/mã ngân hàng nhận thu nhập (giáo viên tự nhập)';
COMMENT ON COLUMN users_module.users.bank_account_number IS 'Số tài khoản nhận thu nhập';
COMMENT ON COLUMN users_module.users.bank_account_name   IS 'Tên chủ tài khoản, để admin đối chiếu khi chuyển khoản';

-- View public.users liệt kê cứng từng cột nên phải khai báo lại, nếu không backend
-- (gọi supabaseAdmin.from('users')) sẽ không thấy 3 cột vừa thêm.
-- Giữ nguyên security_invoker=true: users_module.users bật RLS và không có policy nào,
-- nên anon/authenticated vẫn không đọc được dòng nào — chỉ service_role truy cập được.
CREATE OR REPLACE VIEW public.users WITH (security_invoker = true) AS
  SELECT id,
         full_name,
         email,
         phone,
         avatar_url,
         date_of_birth,
         created_at,
         updated_at,
         is_email_verified,
         bank_name,
         bank_account_number,
         bank_account_name
    FROM users_module.users;

NOTIFY pgrst, 'reload schema';
