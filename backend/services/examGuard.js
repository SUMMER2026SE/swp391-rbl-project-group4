const { supabaseAdmin } = require('../config/supabase');

const jlptDb = supabaseAdmin.schema('jlpt_module');

// Trợ lý AI phải bị khoá khi học viên ĐANG làm bài thi — nếu không, chỉ cần mở
// /chat ở tab khác là hỏi được đáp án (ẩn bubble ở frontend không chặn được).
//
// Chỉ tính attempt còn hạn: attempt bỏ dở vẫn giữ status 'in_progress' vĩnh viễn,
// nếu không lọc theo deadline thì user sẽ bị khoá AI mãi mãi.
//
// LƯU Ý: chỉ phủ được thi thử (mock_attempts) — bảng này có bản ghi lúc BẮT ĐẦU.
// Quiz/bài tập (exam_module.quiz_attempts) chỉ ghi khi NỘP, nên server không hề
// biết học viên đang làm → không chặn được ở đây.
async function activeExam(userId) {
  const now = new Date().toISOString();

  // supabase-js không throw khi query lỗi — phải tự ném để caller không fail-open thầm lặng.
  const { data: mock, error } = await jlptDb.from('mock_attempts')
    .select('id').eq('user_id', userId).eq('status', 'in_progress')
    .gt('section_deadline_at', now).limit(1).maybeSingle();
  if (error) throw error;

  if (mock) return 'mock_exam';
  return null;
}

// Trả true nếu đã gửi response 403 (caller dừng lại).
async function blockIfExamInProgress(req, res) {
  let kind;
  try {
    kind = await activeExam(req.user.id);
  } catch (err) {
    console.error('examGuard error:', err);
    return false;   // fail-open: lỗi hạ tầng không nên chặn người dùng bình thường
  }
  if (!kind) return false;

  res.status(403).json({
    error: 'exam_in_progress',
    message: 'Bạn đang trong một bài thi thử nên trợ lý AI tạm khoá. Hãy nộp bài rồi quay lại nhé.',
  });
  return true;
}

module.exports = { activeExam, blockIfExamInProgress };
