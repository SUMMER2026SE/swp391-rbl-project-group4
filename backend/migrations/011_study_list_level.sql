-- Migration 011: Thêm cột level (N5-N1) cho study_list_posts
-- Để trang duyệt bài đăng có thể nhóm/lọc theo cấp độ giống các trang
-- Từ vựng/Kanji/Ngữ pháp hiện có, thay vì chỉ sort mới nhất/nhiều lượt xem.

ALTER TABLE public.study_list_posts
  ADD COLUMN IF NOT EXISTS level text CHECK (level IN ('N5','N4','N3','N2','N1'));

CREATE INDEX IF NOT EXISTS idx_study_list_posts_type_level ON public.study_list_posts (list_type, level);

NOTIFY pgrst, 'reload schema';
