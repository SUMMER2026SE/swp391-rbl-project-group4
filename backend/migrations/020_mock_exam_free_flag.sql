-- 020: Cờ miễn phí cho đề thi thử JLPT (premium gating)
-- Đề is_free = true: mọi tài khoản đều thi được.
-- Đề is_free = false: chỉ tài khoản premium được BẮT ĐẦU attempt mới
-- (xem lại kết quả cũ và làm nốt attempt dở vẫn được).

ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

-- Backfill một lần: mỗi cấp độ lấy 2 đề đã publish sớm nhất làm đề free.
-- Idempotent: chỉ chạy cho cấp độ CHƯA có đề free nào.
WITH ranked AS (
  SELECT id, level,
         row_number() OVER (PARTITION BY level ORDER BY published_at ASC NULLS LAST, created_at ASC) AS rn
  FROM public.mock_exams
  WHERE is_published = true
)
UPDATE public.mock_exams e
SET is_free = true
FROM ranked r
WHERE e.id = r.id
  AND r.rn <= 2
  AND NOT EXISTS (
    SELECT 1 FROM public.mock_exams f
    WHERE f.level = r.level AND f.is_free = true
  );
