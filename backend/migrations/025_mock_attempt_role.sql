-- 025: Lưu snapshot vai trò user lúc bắt đầu attempt (teacher được thi đề free,
-- không lên leaderboard). Rows cũ toàn student → default 'student' là đúng.
ALTER TABLE jlpt_module.mock_attempts
  ADD COLUMN IF NOT EXISTS user_role text NOT NULL DEFAULT 'student';
