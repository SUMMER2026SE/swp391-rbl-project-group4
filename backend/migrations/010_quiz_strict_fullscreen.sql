-- Migration 010: Strict fullscreen mode for quizzes
-- Thêm cờ strict_fullscreen (độc lập với mode proctored) và bảng quiz_lockouts
-- đếm số lần thoát fullscreen phía server: đạt 5 lần → khóa thi 20 phút.

ALTER TABLE exam_module.quizzes
  ADD COLUMN IF NOT EXISTS strict_fullscreen BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS exam_module.quiz_lockouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         UUID NOT NULL REFERENCES exam_module.quizzes(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  violation_count INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id)
);

-- Theo pattern module schema: bật RLS không tạo policy — backend dùng service_role
ALTER TABLE exam_module.quiz_lockouts ENABLE ROW LEVEL SECURITY;
