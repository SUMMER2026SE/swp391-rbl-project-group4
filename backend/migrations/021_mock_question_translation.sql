-- 021: Bản dịch tiếng Việt cho câu hỏi đề thi thử JLPT
-- AI tự sinh kèm khi gen câu hỏi; câu admin nhập tay thì không bắt buộc.
-- Chỉ hiển thị ở màn Review (xem đáp án) — KHÔNG trả về lúc student đang thi.

ALTER TABLE public.mock_questions
  ADD COLUMN IF NOT EXISTS translation_vi text;
