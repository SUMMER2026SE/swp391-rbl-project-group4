-- Migration 027: Truy vết nguồn bank của câu/nhóm trong đề thi thử JLPT
-- Phục vụ tính năng "Lấp đầy từ ngân hàng (random)": biết câu bank nào đã được
-- dùng ở đề nào để ưu tiên rút câu CHƯA dùng (chống trùng giữa các đề).
-- CỐ Ý KHÔNG đặt FK sang jlpt_bank_* — đề là snapshot bất biến, bank được
-- xóa/sửa tự do không ảnh hưởng đề; cột chỉ là dấu vết (nullable).
-- Idempotent: chạy lại an toàn.

ALTER TABLE jlpt_module.mock_questions
  ADD COLUMN IF NOT EXISTS bank_question_id uuid;

ALTER TABLE jlpt_module.mock_question_groups
  ADD COLUMN IF NOT EXISTS bank_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_mock_questions_bank_qid ON jlpt_module.mock_questions(bank_question_id) WHERE bank_question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mock_groups_bank_gid    ON jlpt_module.mock_question_groups(bank_group_id) WHERE bank_group_id IS NOT NULL;
