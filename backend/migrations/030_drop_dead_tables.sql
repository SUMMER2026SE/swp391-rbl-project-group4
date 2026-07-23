-- 030: Dọn dẹp sau tái tổ chức schema (029) — xóa các bảng chết của mô hình exam cũ
-- (0 dòng, không còn code nào tham chiếu) và 2 schema đã rỗng. Idempotent.
--
-- Nội dung:
--   1. Drop 11 compat view ở public trỏ vào các bảng chết
--   2. Drop 6 FK từ bảng sống trỏ vào bảng chết
--   3. Drop 8 bảng exam_module cũ + materials_module.reading_materials/listening_materials
--   4. Drop schema reading_module, materials_module (đã rỗng)
--      (KHÔNG đụng listening_module — dữ liệu cũ giữ lại theo quyết định riêng)
--   5. Gỡ materials_module/reading_module khỏi exposed schemas của PostgREST

-- ─── 1. Compat views ────────────────────────────────────────────────────────

DROP VIEW IF EXISTS
  public.exams,
  public.exam_questions,
  public.questions,
  public.question_answers,
  public.student_answers,
  public.student_exam_attempts,
  public.jlpt_tests,
  public.exam_behavior_logs,
  public.reading_materials,
  public.listening_materials,
  public.vw_exam_attempts_with_flags;

-- ─── 2. FK từ bảng sống → bảng chết ─────────────────────────────────────────

ALTER TABLE ai_module.ai_generated_questions      DROP CONSTRAINT IF EXISTS fk_agq_question;
ALTER TABLE practice_module.writing_submissions   DROP CONSTRAINT IF EXISTS fk_ws_attempt;
ALTER TABLE practice_module.writing_submissions   DROP CONSTRAINT IF EXISTS fk_ws_question;
ALTER TABLE practice_module.writing_submissions   DROP CONSTRAINT IF EXISTS fk_ws_rm;
ALTER TABLE practice_module.pronunciation_assessments DROP CONSTRAINT IF EXISTS fk_pa_lm;
ALTER TABLE practice_module.pronunciation_assessments DROP CONSTRAINT IF EXISTS fk_pa_question;

-- ─── 3. Bảng chết (0 dòng, không code nào dùng) ─────────────────────────────
-- CASCADE để kéo theo FK nội bộ giữa chính các bảng chết này.

DROP TABLE IF EXISTS exam_module.exam_behavior_logs    CASCADE;
DROP TABLE IF EXISTS exam_module.student_answers       CASCADE;
DROP TABLE IF EXISTS exam_module.question_answers      CASCADE;
DROP TABLE IF EXISTS exam_module.student_exam_attempts CASCADE;
DROP TABLE IF EXISTS exam_module.exam_questions        CASCADE;
DROP TABLE IF EXISTS exam_module.questions             CASCADE;
DROP TABLE IF EXISTS exam_module.exams                 CASCADE;
DROP TABLE IF EXISTS exam_module.jlpt_tests            CASCADE;
DROP TABLE IF EXISTS materials_module.reading_materials   CASCADE;
DROP TABLE IF EXISTS materials_module.listening_materials CASCADE;

-- ─── 4. Schema rỗng ─────────────────────────────────────────────────────────
-- Không dùng CASCADE: nếu còn sót object nào thì migration fail để rà lại.

DROP SCHEMA IF EXISTS reading_module;
DROP SCHEMA IF EXISTS materials_module;

-- ─── 5. Exposed schemas PostgREST (gỡ 2 schema đã xóa) ──────────────────────

ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, graphql_public, course_module, language_module, users_module, ai_module, practice_module, billing_module, dictionary_module, flashcard_module, exam_module, listening_module, jlpt_module';

ALTER ROLE authenticator SET search_path =
  'public, exam_module, users_module, ai_module, language_module, course_module, flashcard_module, dictionary_module, listening_module, practice_module, billing_module, jlpt_module';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
