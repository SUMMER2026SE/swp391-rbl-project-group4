-- 024_grammar_points_created_by.sql
-- Thêm cột created_by cho grammar_points để áp cùng luật sở hữu với kanji:
-- NULL (mẫu hệ thống/nhập hàng loạt từ Mazii) — mọi giáo viên sửa được;
-- đã gán cho 1 giáo viên cụ thể — chỉ giáo viên đó (hoặc admin) sửa được.
-- 528 mẫu hiện có giữ NULL (không hồi tố chủ sở hữu).

ALTER TABLE public.grammar_points
  ADD COLUMN IF NOT EXISTS created_by uuid;

NOTIFY pgrst, 'reload schema';
