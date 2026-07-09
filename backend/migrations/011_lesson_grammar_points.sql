-- ═══════════════════════════════════════════════════════════════════════════════
-- 011_lesson_grammar_points.sql — bảng nối Mục ↔ điểm ngữ pháp
--
-- - Ngữ pháp trong Mục chuyển từ 1 field markdown (lessons.grammar_notes) sang
--   danh sách item rời, đồng nhất với lesson_vocabulary / lesson_kanji.
-- - grammar_notes vẫn giữ nguyên làm ghi chú tổng quan tùy chọn của giáo viên.
-- - Convention lấy theo lesson_vocabulary/lesson_kanji hiện có: composite PK
--   (lesson_id, <item>_id), FK ON DELETE CASCADE, RLS bật nhưng không có policy
--   (backend đi qua service_role nên bypass — xem pattern các bảng content_module).
-- - grammar_point_id trỏ tới public.grammar_points (từ điển ngữ pháp chuẩn, 010).
--
-- Idempotent: chạy lại an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_module.lesson_grammar_points (
  lesson_id        uuid NOT NULL,
  grammar_point_id uuid NOT NULL,
  CONSTRAINT pk_lesson_grammar_points PRIMARY KEY (lesson_id, grammar_point_id),
  CONSTRAINT fk_lgp_lesson  FOREIGN KEY (lesson_id)        REFERENCES content_module.lessons(id)  ON DELETE CASCADE,
  CONSTRAINT fk_lgp_grammar FOREIGN KEY (grammar_point_id) REFERENCES public.grammar_points(id)   ON DELETE CASCADE
);

GRANT ALL ON content_module.lesson_grammar_points TO anon, authenticated, service_role;

ALTER TABLE content_module.lesson_grammar_points ENABLE ROW LEVEL SECURITY;

-- PostgREST: nạp lại schema để thấy bảng mới
NOTIFY pgrst, 'reload schema';
