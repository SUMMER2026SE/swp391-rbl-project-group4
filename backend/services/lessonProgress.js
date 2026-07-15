'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Tiến độ mục học (lesson_progress) nằm ở content_module
const contentDb = supabaseAdmin.schema('content_module');

// Đánh dấu 1 mục là đã hoàn thành cho học sinh (upsert): đã có bản ghi thì update, chưa có thì insert.
// Dùng chung bởi lessonController.complete (hoàn thành thủ công) và quizController.submitAttempt
// (tự động khi quiz có ngưỡng và học sinh đạt).
async function markLessonCompleted(studentId, lessonId) {
  const { data: existing } = await contentDb.from('lesson_progress')
    .select('id').eq('lesson_id', lessonId).eq('student_id', studentId).maybeSingle();
  if (existing) {
    await contentDb.from('lesson_progress')
      .update({ status: 'completed', progress_pct: 100, completed_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await contentDb.from('lesson_progress').insert({
      student_id: studentId, lesson_id: lessonId,
      status: 'completed', progress_pct: 100, last_position: 0, time_spent_sec: 0,
      completed_at: new Date().toISOString(),
    });
  }
}

module.exports = { markLessonCompleted };
