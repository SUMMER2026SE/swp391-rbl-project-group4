-- Migration 017: Thêm cột topic (chủ đề) cho study_list_posts
-- Cho phép nhóm/lọc bài đăng theo chủ đề (Giao thông, Chào hỏi, ...) bên cạnh cấp độ,
-- giống layout danh mục chủ đề tham khảo từ dekiru.vn.

ALTER TABLE public.study_list_posts
  ADD COLUMN IF NOT EXISTS topic text;

CREATE INDEX IF NOT EXISTS idx_study_list_posts_type_topic ON public.study_list_posts (list_type, topic);

NOTIFY pgrst, 'reload schema';
