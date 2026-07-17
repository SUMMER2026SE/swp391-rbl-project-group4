-- 020_question_passage_snapshot.sql
-- Fix: reading/listening passage was lost when a bank question is "taken out"
-- (imported into a quiz/exam/mock, or copied bank→bank). Store a frozen snapshot
-- of the passage on the destination question so it travels with the question.
-- Snapshot shape:
--   { kind:'reading'|'listening', title, content, image_url, audio_url, transcript, description, duration_sec }

ALTER TABLE exam_module.quiz_questions
  ADD COLUMN IF NOT EXISTS passage_snapshot jsonb;

ALTER TABLE exam_module.teacher_question_bank
  ADD COLUMN IF NOT EXISTS passage_snapshot jsonb;

ALTER TABLE public.mock_questions
  ADD COLUMN IF NOT EXISTS passage_snapshot jsonb;
