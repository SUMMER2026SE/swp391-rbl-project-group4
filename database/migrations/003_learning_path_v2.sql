-- ═══════════════════════════════════════════════════════════════════════════════
-- 003 — Lộ trình học v2: đủ 4 kỹ năng, quỹ thời gian, nguồn ngoài
--
-- Chạy trên Supabase SQL Editor SAU migration 002. Idempotent.
--
-- LÝ DO:
--  1. Lộ trình chỉ gợi ý được khoá học / study list / đề thi vì resource_type bị
--     CHECK giới hạn 3 loại → không đưa được bài luyện đọc, luyện nghe (hệ thống
--     đang có 29 bài đọc + 5 bài nghe đã publish) nên không phát triển đều 4 kỹ năng.
--  2. Nguồn học ngoài (YouTube bảng chữ cái/phát âm cho người mới) và trang luyện
--     cố định (/writing) KHÔNG có bản ghi uuid → resource_id NOT NULL chặn mất.
--  3. daily_minutes trước đây không ảnh hưởng lộ trình → thêm estimated_days để
--     mỗi mốc có khối lượng tính theo quỹ thời gian thật của học viên.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Mở rộng loại học liệu
ALTER TABLE ai_module.learning_path_steps
  DROP CONSTRAINT IF EXISTS learning_path_steps_resource_type_check;
ALTER TABLE ai_module.learning_path_steps
  ADD CONSTRAINT learning_path_steps_resource_type_check
  CHECK (resource_type IN (
    'course', 'study_list', 'mock_exam',   -- nội dung sẵn có
    'article',                             -- bài luyện đọc (practice_module.articles)
    'listening',                           -- bài luyện nghe (practice_module.listening_dialogues)
    'practice',                            -- trang luyện cố định trong web (/writing, /kanji/writing)
    'external'                             -- nguồn ngoài đã kiểm duyệt (YouTube…)
  ));

-- 2. Mục không gắn với bản ghi trong DB (external / practice) thì không có uuid
ALTER TABLE ai_module.learning_path_steps
  ALTER COLUMN resource_id DROP NOT NULL;

ALTER TABLE ai_module.learning_path_steps
  ADD COLUMN IF NOT EXISTS external_url    text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS estimated_days  integer;

-- 3. Trọng tâm kỹ năng do học viên chọn (vd {reading,listening} hoặc {kanji})
ALTER TABLE ai_module.learning_paths
  ADD COLUMN IF NOT EXISTS focus_skills text[];

-- 4. Cho phép trình độ 'BEGINNER' (người mới chưa biết bảng chữ cái — thấp hơn N5).
--    CHECK cũ chỉ nhận N5..N1 nên lưu lộ trình của người mới sẽ bị chặn.
--    target_level giữ nguyên N5..N1 vì mục tiêu luôn là một cấp JLPT.
ALTER TABLE ai_module.learning_paths
  DROP CONSTRAINT IF EXISTS learning_paths_current_level_check;
ALTER TABLE ai_module.learning_paths
  ADD CONSTRAINT learning_paths_current_level_check
  CHECK (current_level IN ('BEGINNER', 'N5', 'N4', 'N3', 'N2', 'N1'));

-- 5. Bổ sung kỹ năng 'writing' — nay lộ trình có mốc luyện viết (/writing) nên
--    skill_focus có thể mang giá trị này.
ALTER TABLE ai_module.learning_path_steps
  DROP CONSTRAINT IF EXISTS learning_path_steps_skill_focus_check;
ALTER TABLE ai_module.learning_path_steps
  ADD CONSTRAINT learning_path_steps_skill_focus_check
  CHECK (skill_focus IN ('vocabulary', 'kanji', 'grammar', 'reading', 'listening', 'writing', 'mixed'));

-- 6. Mốc nguồn ngoài / trang luyện không gắn cấp JLPT nào → resource_level phải cho NULL.
--    (CHECK cũ chỉ liệt kê N5..N1; cột vốn nullable nhưng ghi rõ cho chắc.)
ALTER TABLE ai_module.learning_path_steps
  DROP CONSTRAINT IF EXISTS learning_path_steps_resource_level_check;
ALTER TABLE ai_module.learning_path_steps
  ADD CONSTRAINT learning_path_steps_resource_level_check
  CHECK (resource_level IS NULL OR resource_level IN ('N5', 'N4', 'N3', 'N2', 'N1'));

NOTIFY pgrst, 'reload schema';
