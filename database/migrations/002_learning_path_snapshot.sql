-- ═══════════════════════════════════════════════════════════════════════════════
-- 002 — Hồ sơ năng lực tại thời điểm tạo lộ trình học
--
-- Chạy trên Supabase SQL Editor. Idempotent — chạy lại nhiều lần an toàn.
--
-- LÝ DO: lộ trình trước đây chỉ dựa vào 4 trường khai báo tay (trình độ, mục tiêu,
-- goal, phút/ngày) nên không thực sự cá nhân hoá. Nay backend dựng "hồ sơ năng lực"
-- từ dữ liệu học tập thật (điểm từng phần thi thử, quiz, bài viết, tiến độ học) và
-- lưu lại ở đây để:
--   1. Hiển thị mục "Phân tích năng lực" cho học viên thấy vì sao được gợi ý như vậy.
--   2. Lần "Tạo lại" biết lần trước dùng chiến lược nào → chọn chiến lược KHÁC.
--
-- Cấu trúc learner_snapshot (jsonb):
--   { strategy, hasData, mock: {...}, quiz: {...}, writing: {...}, study: {...},
--     weaknesses: [{skill, score, evidence}], strengths: [...] }
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE ai_module.learning_paths
  ADD COLUMN IF NOT EXISTS learner_snapshot jsonb;

NOTIFY pgrst, 'reload schema';
