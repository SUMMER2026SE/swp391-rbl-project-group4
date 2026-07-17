-- Migration 019: Khóa/mở bài đăng danh sách (kiểm duyệt nội dung của admin)
-- Admin có thể khóa 1 bài đăng để ẩn khỏi học sinh + yêu cầu giáo viên chỉnh
-- sửa (kèm ghi chú lý do); giáo viên vẫn sửa được bình thường khi bị khóa.

ALTER TABLE public.study_list_posts
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_note text;

CREATE INDEX IF NOT EXISTS idx_study_list_posts_is_locked ON public.study_list_posts (is_locked);

NOTIFY pgrst, 'reload schema';
