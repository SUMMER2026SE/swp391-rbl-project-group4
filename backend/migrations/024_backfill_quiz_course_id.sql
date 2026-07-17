-- 024: Backfill exam_module.quizzes.course_id từ lesson cha (bịt lỗ hổng paywall).
-- createLessonQuiz (teacher) trước đây insert quiz chỉ với lesson_id, để course_id = NULL
-- khiến checkCourseContentAccess coi quiz "không thuộc khóa nào" và bỏ qua kiểm tra enroll.
UPDATE exam_module.quizzes q
SET course_id = l.course_id
FROM content_module.lessons l
WHERE q.lesson_id = l.id
  AND q.course_id IS NULL;
