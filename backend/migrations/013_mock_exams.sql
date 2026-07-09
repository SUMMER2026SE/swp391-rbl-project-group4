-- Migration 013: JLPT Mock Exams (Thi thử JLPT)
-- Đề thi thử theo format JLPT thật: đề → phần thi (section, có timer riêng)
-- → nhóm mondai (question group — passage/audio chung) → câu hỏi.
-- Attempt lưu deadline từng section phía server + điểm theo cột chấm JLPT.

-- ── mock_exams ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_exams (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level         text NOT NULL CHECK (level IN ('N5','N4','N3','N2','N1')),
  title         text NOT NULL,
  description   text,
  is_published  boolean DEFAULT false,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  published_at  timestamptz
);

-- ── mock_exam_sections (phần thi — timer riêng, làm tuần tự) ─────────────────
CREATE TABLE IF NOT EXISTS public.mock_exam_sections (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id             uuid NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  position            int NOT NULL DEFAULT 0,
  section_type        text NOT NULL CHECK (section_type IN ('vocab','grammar_reading','language_reading','listening')),
  title               text NOT NULL DEFAULT '',
  time_limit_minutes  int NOT NULL DEFAULT 30
);

-- ── mock_question_groups (1 group = 1 mondai / 1 passage / 1 audio) ──────────
CREATE TABLE IF NOT EXISTS public.mock_question_groups (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id        uuid NOT NULL REFERENCES public.mock_exam_sections(id) ON DELETE CASCADE,
  position          int NOT NULL DEFAULT 0,
  mondai_number     int NOT NULL DEFAULT 1,
  mondai_type       text NOT NULL CHECK (mondai_type IN (
    'kanji_reading','orthography','word_formation','context','paraphrase','usage',
    'grammar_form','sentence_assembly','text_grammar',
    'reading_short','reading_mid','reading_long','integrated_reading','thematic_reading','info_retrieval',
    'task_comprehension','point_comprehension','summary_comprehension',
    'utterance_expression','quick_response','integrated_listening'
  )),
  -- Cột CHẤM điểm (khác với phần thi): N1–N3 = language/reading/listening,
  -- N4–N5 = language_reading/listening
  score_category    text NOT NULL CHECK (score_category IN ('language','reading','listening','language_reading')),
  instruction_text  text,
  passage_text      text,
  image_url         text,
  audio_url         text,
  audio_transcript  text
);

-- ── mock_questions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_questions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id       uuid NOT NULL REFERENCES public.mock_question_groups(id) ON DELETE CASCADE,
  position       int NOT NULL DEFAULT 0,
  question_text  text,            -- có thể rỗng (即時応答 chỉ nghe)
  image_url      text,
  audio_url      text,            -- khi mỗi câu 1 file audio riêng
  options        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- mảng 3–4 string
  correct_index  int NOT NULL DEFAULT 0,
  explanation    text
);

-- ── mock_attempts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_attempts (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id                   uuid NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number            int NOT NULL DEFAULT 1,  -- 1 = lần đầu (tính leaderboard)
  status                    text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','expired')),
  current_section_position  int NOT NULL DEFAULT 0,
  section_deadline_at       timestamptz,
  started_at                timestamptz DEFAULT now(),
  submitted_at              timestamptz,
  scores                    jsonb,   -- { language: 42, reading: 38, listening: 40, ... }
  total_score               int,
  passed                    boolean,
  duration_seconds          int
);

-- ── mock_attempt_answers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_attempt_answers (
  attempt_id     uuid NOT NULL REFERENCES public.mock_attempts(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.mock_questions(id) ON DELETE CASCADE,
  selected_index int,
  is_correct     boolean,
  answered_at    timestamptz DEFAULT now(),
  PRIMARY KEY (attempt_id, question_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mock_exams_pub        ON public.mock_exams(is_published, level);
CREATE INDEX IF NOT EXISTS idx_mock_sections_exam    ON public.mock_exam_sections(exam_id, position);
CREATE INDEX IF NOT EXISTS idx_mock_groups_section   ON public.mock_question_groups(section_id, position);
CREATE INDEX IF NOT EXISTS idx_mock_questions_group  ON public.mock_questions(group_id, position);
-- Leaderboard: chỉ lần làm đầu, điểm cao trước, cùng điểm thì thời gian ngắn hơn xếp trên
CREATE INDEX IF NOT EXISTS idx_mock_attempts_board   ON public.mock_attempts(exam_id, total_score DESC, duration_seconds ASC) WHERE status = 'submitted' AND attempt_number = 1;
CREATE INDEX IF NOT EXISTS idx_mock_attempts_user    ON public.mock_attempts(user_id, exam_id, started_at);
-- Chặn 2 attempt dở dang song song trên cùng đề (chống double-click start)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mock_attempt_inprogress ON public.mock_attempts(exam_id, user_id) WHERE status = 'in_progress';

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Backend dùng service role (bypass RLS). Policy read-published chỉ là lớp bảo vệ
-- tối thiểu nếu client anon truy cập trực tiếp; KHÔNG mở đọc mock_questions cho
-- anon vì bảng chứa correct_index/explanation.
ALTER TABLE public.mock_exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_exam_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_attempt_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_exams_read_published" ON public.mock_exams;
CREATE POLICY "mock_exams_read_published" ON public.mock_exams
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "mock_sections_read_published" ON public.mock_exam_sections;
CREATE POLICY "mock_sections_read_published" ON public.mock_exam_sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mock_exams e WHERE e.id = exam_id AND e.is_published = true)
  );

DROP POLICY IF EXISTS "mock_attempts_read_own" ON public.mock_attempts;
CREATE POLICY "mock_attempts_read_own" ON public.mock_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_attempt_answers_read_own" ON public.mock_attempt_answers;
CREATE POLICY "mock_attempt_answers_read_own" ON public.mock_attempt_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mock_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
  );
