-- ═══════════════════════════════════════════════════════════════════════════════
-- 001 — Nguồn ghi danh khoá học (phục vụ tính năng giáo viên tự cấp quyền)
--
-- Chạy file này trên Supabase SQL Editor. Idempotent — chạy lại nhiều lần an toàn.
--
-- LÝ DO: gating nội dung khoá học chỉ dựa vào sự tồn tại của course_enrollments,
-- nên "cấp quyền" = tạo bản ghi enrollment. Nhưng nếu không phân biệt được nguồn thì
-- khi giáo viên thu hồi quyền có thể XOÁ NHẦM học viên đã tự bỏ tiền mua khoá học.
-- 3 cột dưới đây để tách bạch điều đó.
--
-- Giá trị source:
--   self          — học viên tự bấm "Đăng ký" (mặc định, giữ nguyên hành vi dữ liệu cũ)
--   purchase      — dành cho enrollment sinh ra từ thanh toán (hiện trigger vẫn ghi 'self')
--   teacher_grant — giáo viên cấp tay  → CHỈ loại này mới được thu hồi
--   admin_grant   — admin cấp tay
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE course_module.course_enrollments
  ADD COLUMN IF NOT EXISTS source     text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES users_module.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz;

ALTER TABLE course_module.course_enrollments
  DROP CONSTRAINT IF EXISTS ck_ce_source;
ALTER TABLE course_module.course_enrollments
  ADD CONSTRAINT ck_ce_source
  CHECK (source IN ('self', 'purchase', 'teacher_grant', 'admin_grant'));

-- Lọc nhanh danh sách "đã cấp" của một khoá
CREATE INDEX IF NOT EXISTS ix_ce_source
  ON course_module.course_enrollments (course_id, source);

NOTIFY pgrst, 'reload schema';
