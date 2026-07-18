-- 024: Gom toàn bộ bảng thi thử JLPT về schema riêng `jlpt_module`
-- (trước đây nằm ở public — xem 013_mock_exams.sql). Idempotent: chạy lại an toàn.
-- RLS policies + index + FK tự đi theo bảng khi SET SCHEMA.
-- ⚠️ Sau khi chạy: phải thêm `jlpt_module` vào Exposed schemas
--    (Supabase Dashboard → Settings → API) thì PostgREST mới cho .schema('jlpt_module').

CREATE SCHEMA IF NOT EXISTS jlpt_module;

-- Quyền truy cập schema cho các role của Supabase (giống các *_module khác)
GRANT USAGE ON SCHEMA jlpt_module TO anon, authenticated, service_role;

-- Chuyển 6 bảng (bọc DO để idempotent — bảng đã chuyển rồi thì bỏ qua)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mock_exams', 'mock_exam_sections', 'mock_question_groups',
    'mock_questions', 'mock_attempts', 'mock_attempt_answers'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA jlpt_module', t);
    END IF;
  END LOOP;
END $$;

-- Quyền trên bảng/sequence hiện có trong schema mới
GRANT ALL ON ALL TABLES    IN SCHEMA jlpt_module TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA jlpt_module TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA jlpt_module TO anon, authenticated;

-- Bảng tạo sau này trong jlpt_module (vd: ngân hàng đề) tự có quyền tương tự
ALTER DEFAULT PRIVILEGES IN SCHEMA jlpt_module
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA jlpt_module
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA jlpt_module
  GRANT SELECT ON TABLES TO anon, authenticated;
