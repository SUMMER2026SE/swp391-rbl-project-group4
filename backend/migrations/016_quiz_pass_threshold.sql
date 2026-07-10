-- Migration 016: Ngưỡng điểm đạt (pass threshold) cho quiz/đề thi + cột passed cho bài làm.
-- passing_type = NULL  → không cấu hình ngưỡng (giữ hành vi cũ: hoàn thành tự do).
-- passing_type = 'percent' → passing_value là % số câu đúng tối thiểu (1..100).
-- passing_type = 'count'   → passing_value là số câu đúng tối thiểu (>=1, <= tổng số câu).
-- quiz_attempts.passed = NULL khi quiz không cấu hình ngưỡng (hoặc đề thi tự luận chưa chấm).

ALTER TABLE exam_module.quizzes
  ADD COLUMN IF NOT EXISTS passing_type  text
    CHECK (passing_type IS NULL OR passing_type IN ('percent','count')),
  ADD COLUMN IF NOT EXISTS passing_value numeric;

ALTER TABLE exam_module.quiz_attempts
  ADD COLUMN IF NOT EXISTS passed boolean;
