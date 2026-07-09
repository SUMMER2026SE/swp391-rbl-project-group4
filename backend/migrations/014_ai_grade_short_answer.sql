-- Migration 014: AI chấm điểm câu hỏi "Trả lời ngắn" (short_answer)
-- Lưu kết quả chấm AI theo từng câu vào quiz_attempts dưới dạng JSONB:
--   ai_feedback = { "<question_id>": { correct: bool, ai_used: bool, comment: string } }
-- Chỉ dùng cho short_answer không khớp đáp án chính xác (phải gọi AI đánh giá nghĩa).

ALTER TABLE exam_module.quiz_attempts
  ADD COLUMN IF NOT EXISTS ai_feedback JSONB;

-- Theo pattern module schema: bật RLS không tạo policy — backend dùng service_role
ALTER TABLE exam_module.quiz_attempts ENABLE ROW LEVEL SECURITY;
