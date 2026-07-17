-- 022: Câu chỉ dẫn (instruction) mondai chuyển thành hằng số tĩnh theo chuẩn JLPT
-- (frontend/src/lib/mockExamConstants.js — mondaiInstruction(level, type)), không lưu DB nữa.
ALTER TABLE public.mock_question_groups DROP COLUMN IF EXISTS instruction_text;
