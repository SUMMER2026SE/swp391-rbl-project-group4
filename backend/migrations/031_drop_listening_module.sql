-- 031: Xóa schema listening_module — bản sao cũ bị bỏ rơi của tính năng luyện nghe.
-- Idempotent: chạy lại an toàn.
--
-- Bối cảnh: listening_module.dialogues/dialogue_lines/user_audios là bản gốc trước khi
-- team gặp vấn đề expose schema và tạo lại bảng ở public với prefix listening_
-- (nay đã chuyển về practice_module ở migration 029). Dữ liệu bên trong là snapshot
-- đóng băng từ 30/06/2026, trùng 100% UUID với 5 dòng đầu của bảng đang dùng;
-- mọi dữ liệu mới sau đó chỉ ghi vào bảng đang dùng.
--
-- Đã kiểm chứng trước khi drop:
--   - Không code nào (backend/frontend/EJS) tham chiếu .schema('listening_module')
--   - Không FK từ schema khác trỏ vào, không view/hàm nào phụ thuộc
--   - Luyện nghe hiện tại đọc/ghi practice_module.listening_* — không liên quan

DROP SCHEMA IF EXISTS listening_module CASCADE;

-- Gỡ khỏi exposed schemas + search_path của PostgREST
ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, graphql_public, course_module, language_module, users_module, ai_module, practice_module, billing_module, dictionary_module, flashcard_module, exam_module, jlpt_module';

ALTER ROLE authenticator SET search_path =
  'public, exam_module, users_module, ai_module, language_module, course_module, flashcard_module, dictionary_module, practice_module, billing_module, jlpt_module';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
