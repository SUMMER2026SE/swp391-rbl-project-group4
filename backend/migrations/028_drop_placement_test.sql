-- 028_drop_placement_test.sql
-- Gỡ bỏ hoàn toàn tính năng Kiểm tra năng lực (placement test):
-- drop cột tham chiếu trên learning_paths, các bảng placement_test_* và
-- dữ liệu quota liên quan. Lộ trình học từ nay lấy trình độ đầu vào do
-- học viên tự chọn (form /learning-path) hoặc từ student_profiles.current_level.

ALTER TABLE public.learning_paths DROP COLUMN IF EXISTS source_attempt_id;

DROP TABLE IF EXISTS public.placement_test_answers;
DROP TABLE IF EXISTS public.placement_test_question_snapshots;
DROP TABLE IF EXISTS public.placement_test_attempts;
DROP TABLE IF EXISTS public.placement_test_question_options;
DROP TABLE IF EXISTS public.placement_test_questions;
DROP TABLE IF EXISTS public.placement_test_configs;

DELETE FROM public.feature_entitlements   WHERE feature_code = 'placement_test_monthly';
DELETE FROM public.feature_usage_counters WHERE feature_code = 'placement_test_monthly';
