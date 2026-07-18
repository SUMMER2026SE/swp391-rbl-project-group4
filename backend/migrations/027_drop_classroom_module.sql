-- 027: Xóa hẳn tính năng Lớp học (classroom_module) + các view compat trong public.
-- Đã backup dữ liệu (21 dòng test) trước khi chạy — xem PR/task note.
-- KHÔNG đụng vào exam_module.quizzes/quiz_questions/quiz_attempts/quiz_lockouts/question_bank
-- và jlpt_module.* (dùng chung với quiz khóa học, đề thi giáo viên, ngân hàng JLPT, thi thử).
-- Cột exam_module.quiz_attempts.assignment_id giữ nguyên (dữ liệu lịch sử, NULL cho attempt mới).

BEGIN;

-- View compat trong public trỏ vào classroom_module
DROP VIEW IF EXISTS public.vw_class_student_progress;
DROP VIEW IF EXISTS public.exam_assignments;
DROP VIEW IF EXISTS public.class_enrollments;
DROP VIEW IF EXISTS public.classes;

-- Bảng con trước, bảng cha sau. CASCADE để gỡ FK từ bảng chết
-- exam_module.student_exam_attempts.assignment_id (chỉ gỡ constraint, không xóa bảng đó).
DROP TABLE IF EXISTS classroom_module.class_post_comments CASCADE;
DROP TABLE IF EXISTS classroom_module.class_posts CASCADE;
DROP TABLE IF EXISTS classroom_module.exam_assignments CASCADE;
DROP TABLE IF EXISTS classroom_module.class_enrollments CASCADE;
DROP TABLE IF EXISTS classroom_module.classes CASCADE;

DROP SCHEMA IF EXISTS classroom_module CASCADE;

COMMIT;
