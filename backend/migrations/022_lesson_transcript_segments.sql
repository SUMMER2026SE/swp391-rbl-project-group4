-- 022_lesson_transcript_segments.sql
-- Transcript đồng bộ theo thời gian cho lesson video (đa ngôn ngữ trong cùng 1 dòng):
-- lessons.transcript_segments (jsonb, nullable) = mảng { start, end, parts: [{lang, text}] }.
-- parts có 1-3 phần tử theo đúng thứ tự ngôn ngữ thực tế được nói (vd: ja rồi vi rồi en).
-- Cột transcript (text) hiện có giữ nguyên làm fallback hiển thị tĩnh khi lesson chưa
-- có transcript_segments — không đổi hành vi của lesson cũ.

ALTER TABLE content_module.lessons
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb;

NOTIFY pgrst, 'reload schema';
