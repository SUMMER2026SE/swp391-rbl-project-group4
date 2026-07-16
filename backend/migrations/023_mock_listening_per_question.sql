-- 023: Phần nghe chuyển hoàn toàn về TỪNG CÂU (mock_questions) — bỏ audio/transcript cấp mondai.
-- option_translations (jsonb, mảng string cùng độ dài options) thêm sẵn cho đợt bản dịch từng lựa chọn.
ALTER TABLE public.mock_question_groups
  DROP COLUMN IF EXISTS audio_url,
  DROP COLUMN IF EXISTS audio_transcript;

ALTER TABLE public.mock_questions
  ADD COLUMN IF NOT EXISTS audio_transcript text,
  ADD COLUMN IF NOT EXISTS option_translations jsonb;
