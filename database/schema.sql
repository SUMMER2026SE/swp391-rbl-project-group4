-- =============================================================================
-- Kizuna Nihongo (Sorakara) - Full Database Schema
-- Project: KizunaNihongo (kcjepoaksgbrhqytkjrw)
-- Generated from the LIVE database on 2026-07-24 via schema introspection.
-- Idempotent where possible (IF NOT EXISTS / OR REPLACE). Structure only (no row data).
-- Order: schemas -> extensions -> sequences -> tables -> constraints -> functions
--        -> views -> triggers -> indexes -> RLS -> policies -> role config.
-- NOTE: expose the *_module schemas in Supabase (Settings > API > Exposed schemas);
--       lookup/seed rows (jlpt_levels, skills, roles, subscription_plans, feature_entitlements) are NOT included.
-- =============================================================================

-- --------------------------------------------------------------------------
-- SCHEMAS  (Các schema theo domain)
-- --------------------------------------------------------------------------

-- ai_module: Trợ lý AI (chat), lộ trình học cá nhân hoá, thông báo, dashboard học viên
CREATE SCHEMA IF NOT EXISTS ai_module;

-- billing_module: Thanh toán, gói Premium, hạn mức tính năng (quota), doanh thu giáo viên
CREATE SCHEMA IF NOT EXISTS billing_module;

-- course_module: Khoá học, chương (unit), bài học, ghi danh, đánh giá
CREATE SCHEMA IF NOT EXISTS course_module;

-- dictionary_module: Từ điển Nhật–Việt (mục từ, nghĩa, ví dụ, kanji)
CREATE SCHEMA IF NOT EXISTS dictionary_module;

-- exam_module: Quiz/bài kiểm tra + ngân hàng câu hỏi (admin & giáo viên)
CREATE SCHEMA IF NOT EXISTS exam_module;

-- flashcard_module: Flashcard: thư mục, học phần, thẻ, tiến độ, bài kiểm tra AI
CREATE SCHEMA IF NOT EXISTS flashcard_module;

-- jlpt_module: Thi thử JLPT + ngân hàng câu hỏi JLPT theo mondai
CREATE SCHEMA IF NOT EXISTS jlpt_module;

-- language_module: Kho từ vựng / kanji / ngữ pháp + danh sách học (study list)
CREATE SCHEMA IF NOT EXISTS language_module;

-- practice_module: Luyện đọc / nghe / viết + chấm phát âm
CREATE SCHEMA IF NOT EXISTS practice_module;

-- users_module: Người dùng, hồ sơ học viên/giáo viên, vai trò, đơn xin làm giáo viên
CREATE SCHEMA IF NOT EXISTS users_module;

-- --------------------------------------------------------------------------
-- EXTENSIONS  (Tiện ích mở rộng Postgres)
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------------
-- SEQUENCES  (Sequence (bộ sinh số tự tăng))
-- --------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS language_module.topics_id_seq;

-- --------------------------------------------------------------------------
-- TABLES  (Bảng dữ liệu)
-- --------------------------------------------------------------------------

-- Nhật ký câu hỏi do AI sinh (prompt, tham số, model)
CREATE TABLE IF NOT EXISTS ai_module.ai_generated_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  generation_prompt text NOT NULL,
  generation_params jsonb NOT NULL,
  raw_ai_response text,
  ai_model character varying(100),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Lộ trình học do AI tạo (bản ghi/analytics)
CREATE TABLE IF NOT EXISTS ai_module.ai_learning_paths (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  path_data jsonb NOT NULL,
  ai_model_version character varying(50),
  rationale_vi text,
  strength_skills jsonb,
  weakness_skills jsonb
);

-- Tin nhắn trong phiên chat với trợ lý AI
CREATE TABLE IF NOT EXISTS ai_module.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  context_items jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Phiên trò chuyện với trợ lý AI
CREATE TABLE IF NOT EXISTS ai_module.chat_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Cuộc trò chuyện mới'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Bảng tập viết kanji sinh cho học viên
CREATE TABLE IF NOT EXISTS ai_module.kanji_writing_sheets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  kanji_set_id uuid,
  jlpt_level_id smallint,
  kanji_ids jsonb NOT NULL,
  file_url character varying(500),
  generated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Các bước trong một lộ trình học
CREATE TABLE IF NOT EXISTS ai_module.learning_path_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  skill_focus text,
  rationale text,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  resource_level text,
  status text NOT NULL DEFAULT 'pending'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Lộ trình học cá nhân hoá theo trình độ
CREATE TABLE IF NOT EXISTS ai_module.learning_paths (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_level text NOT NULL,
  target_level text NOT NULL,
  study_goal text,
  daily_minutes smallint,
  status text NOT NULL DEFAULT 'active'::text,
  ai_model text,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Thông báo gửi tới người dùng
CREATE TABLE IF NOT EXISTS ai_module.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  sender_id uuid,
  type character varying(50) NOT NULL,
  title character varying(200) NOT NULL,
  body text,
  metadata jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Số liệu tổng hợp dashboard học viên (streak, điểm...)
CREATE TABLE IF NOT EXISTS ai_module.student_dashboards (
  student_id uuid NOT NULL,
  total_study_days integer NOT NULL DEFAULT 0,
  total_study_minutes integer NOT NULL DEFAULT 0,
  total_vocab_learned integer NOT NULL DEFAULT 0,
  total_kanji_learned integer NOT NULL DEFAULT 0,
  total_grammar_learned integer NOT NULL DEFAULT 0,
  total_exams_taken integer NOT NULL DEFAULT 0,
  avg_exam_score numeric(5,2),
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  skill_scores jsonb,
  last_updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sự kiện dùng nội dung của giáo viên (tính chia doanh thu)
CREATE TABLE IF NOT EXISTS billing_module.content_usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  period_key text NOT NULL,
  day_key date NOT NULL DEFAULT CURRENT_DATE
);

-- Đơn thanh toán mua khoá học (SePay QR)
CREATE TABLE IF NOT EXISTS billing_module.course_payment_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  order_code text NOT NULL,
  payment_code text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'VND'::text,
  provider text NOT NULL DEFAULT 'sepay'::text,
  bank_code text,
  account_number text,
  qr_url text,
  status text NOT NULL DEFAULT 'pending'::text,
  expires_at timestamp with time zone NOT NULL,
  paid_at timestamp with time zone,
  matched_transaction_id text,
  matched_reference_number text,
  matched_transaction_time timestamp with time zone,
  raw_match_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Hạn mức tính năng theo gói (free/premium)
CREATE TABLE IF NOT EXISTS billing_module.feature_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tier text NOT NULL,
  feature_code text NOT NULL,
  limit_value integer NOT NULL DEFAULT '-1'::integer,
  period_type text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Bộ đếm lượt dùng tính năng theo kỳ (quota)
CREATE TABLE IF NOT EXISTS billing_module.feature_usage_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_code text NOT NULL,
  period_type text NOT NULL,
  period_key text NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  used_amount numeric NOT NULL DEFAULT 0,
  tier_at_time text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Đơn thanh toán nâng cấp gói Premium
CREATE TABLE IF NOT EXISTS billing_module.payment_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  order_code text NOT NULL,
  payment_code text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'VND'::text,
  provider text NOT NULL DEFAULT 'sepay'::text,
  bank_code text,
  account_number text,
  qr_url text,
  status text NOT NULL DEFAULT 'pending'::text,
  expires_at timestamp with time zone NOT NULL,
  paid_at timestamp with time zone,
  matched_transaction_id text,
  matched_reference_number text,
  matched_transaction_time timestamp with time zone,
  raw_match_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Giao dịch ngân hàng nhận từ webhook SePay
CREATE TABLE IF NOT EXISTS billing_module.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'sepay'::text,
  external_transaction_id text,
  reference_number text,
  account_number text,
  bank_brand_name text,
  amount_in numeric(12,2),
  amount_out numeric(12,2),
  transaction_content text,
  transaction_date timestamp with time zone,
  raw_payload jsonb,
  matched_order_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  matched_course_order_id uuid
);

-- Thanh toán khoá học (phí nền tảng + chia giáo viên)
CREATE TABLE IF NOT EXISTS billing_module.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  platform_fee numeric(12,2) NOT NULL,
  teacher_payout numeric(12,2) NOT NULL,
  payment_status character varying(20) DEFAULT 'pending'::character varying,
  payment_provider character varying(20),
  provider_transaction_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Kỳ chia doanh thu pool cho giáo viên
CREATE TABLE IF NOT EXISTS billing_module.revenue_pool_periods (
  period_key text NOT NULL,
  total_vip_revenue numeric NOT NULL DEFAULT 0,
  pool_pct numeric NOT NULL,
  pool_amount numeric NOT NULL DEFAULT 0,
  total_uses integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'finalized'::text,
  finalized_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Danh mục gói đăng ký
CREATE TABLE IF NOT EXISTS billing_module.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  tier text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'none'::text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VND'::text,
  is_active boolean NOT NULL DEFAULT true,
  features_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Chi trả cho giáo viên theo kỳ
CREATE TABLE IF NOT EXISTS billing_module.teacher_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_key text NOT NULL,
  teacher_id uuid NOT NULL,
  uses integer NOT NULL DEFAULT 0,
  share_pct numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone
);

-- Gói đăng ký hiện tại của người dùng
CREATE TABLE IF NOT EXISTS billing_module.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  tier text NOT NULL DEFAULT 'free'::text,
  status text NOT NULL DEFAULT 'active'::text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  expired_at timestamp with time zone,
  auto_renew boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ghi danh học viên vào khoá học
CREATE TABLE IF NOT EXISTS course_module.course_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  progress_pct smallint NOT NULL DEFAULT 0
);

-- Đánh giá/nhận xét khoá học
CREATE TABLE IF NOT EXISTS course_module.course_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Khoá học
CREATE TABLE IF NOT EXISTS course_module.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying(200) NOT NULL,
  description text,
  jlpt_level_id smallint NOT NULL,
  skill_id smallint,
  thumbnail_url character varying(500),
  is_published boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title_ja character varying,
  description_ja text,
  is_free boolean NOT NULL DEFAULT true,
  price numeric(12,2) DEFAULT 0,
  commission_rate numeric(4,3) DEFAULT 0.10,
  creator_type character varying(10),
  enrollment_count integer DEFAULT 0,
  avg_rating numeric(3,2) DEFAULT 0,
  difficulty_level character varying(10),
  reference_curriculum text
);

-- Bảng nối bài học ↔ mẫu ngữ pháp
CREATE TABLE IF NOT EXISTS course_module.lesson_grammar (
  lesson_id uuid NOT NULL,
  pattern_id uuid NOT NULL
);

-- Bảng nối bài học ↔ điểm ngữ pháp
CREATE TABLE IF NOT EXISTS course_module.lesson_grammar_points (
  lesson_id uuid NOT NULL,
  grammar_point_id uuid NOT NULL
);

-- Bảng nối bài học ↔ kanji
CREATE TABLE IF NOT EXISTS course_module.lesson_kanji (
  lesson_id uuid NOT NULL,
  kanji_id uuid NOT NULL
);

-- Tiến độ học từng bài của học viên
CREATE TABLE IF NOT EXISTS course_module.lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  status character varying(20) NOT NULL DEFAULT 'not_started'::character varying,
  progress_pct smallint NOT NULL DEFAULT 0,
  last_position integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone,
  time_spent_sec integer NOT NULL DEFAULT 0
);

-- Bảng nối bài học ↔ từ vựng
CREATE TABLE IF NOT EXISTS course_module.lesson_vocabulary (
  lesson_id uuid NOT NULL,
  vocabulary_id uuid NOT NULL
);

-- Bài học trong khoá (video/đọc/nghe...)
CREATE TABLE IF NOT EXISTS course_module.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title character varying(200) NOT NULL,
  description text,
  skill_id smallint,
  content_type character varying(30) NOT NULL,
  content_body text,
  content_url character varying(500),
  transcript text,
  grammar_notes text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title_ja character varying,
  unit_id uuid,
  duration_minutes integer DEFAULT 0,
  question_count integer DEFAULT 0,
  reading_article_id uuid,
  transcript_segments jsonb
);

-- Bảng tra cứu kỹ năng (nghe/nói/đọc/viết...)
CREATE TABLE IF NOT EXISTS course_module.skills (
  id smallint NOT NULL,
  name character varying(20) NOT NULL,
  name_vi character varying(30) NOT NULL
);

-- Chương/phần trong khoá học
CREATE TABLE IF NOT EXISTS course_module.units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title character varying NOT NULL,
  title_ja character varying,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  level character varying(10)
);

-- Mục từ điển (kanji/kana/romaji)
CREATE TABLE IF NOT EXISTS dictionary_module.dict_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kanji text,
  kana text NOT NULL,
  romaji text,
  jlpt_level text,
  is_common boolean DEFAULT false,
  source text,
  source_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Câu ví dụ cho nghĩa từ (kèm furigana)
CREATE TABLE IF NOT EXISTS dictionary_module.dict_examples (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sense_id uuid NOT NULL,
  sentence_jp text NOT NULL,
  sentence_vi text,
  created_at timestamp with time zone DEFAULT now(),
  furigana text
);

-- Tra cứu kanji (âm Hán Việt, âm on/kun)
CREATE TABLE IF NOT EXISTS dictionary_module.dict_kanji (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "character" text NOT NULL,
  sino_vi text,
  meaning_vi text,
  reading_on text[],
  reading_kun text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Từ liên quan/đồng nghĩa/trái nghĩa
CREATE TABLE IF NOT EXISTS dictionary_module.dict_related_words (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  related_id uuid NOT NULL,
  relation_type text DEFAULT 'related'::text,
  created_at timestamp with time zone DEFAULT now()
);

-- Các nghĩa của một mục từ
CREATE TABLE IF NOT EXISTS dictionary_module.dict_senses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  pos text,
  meaning_vi text NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Đoạn nghe dùng cho ngân hàng câu hỏi
CREATE TABLE IF NOT EXISTS exam_module.listening_passages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  audio_url text,
  transcript text,
  description text,
  level text,
  topic text,
  source text,
  duration_sec integer,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  transcript_segments jsonb,
  transcript_language text,
  image_url text
);

-- Ngân hàng câu hỏi (admin)
CREATE TABLE IF NOT EXISTS exam_module.question_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text,
  explanation text,
  level text,
  skill text,
  topic text,
  difficulty text DEFAULT 'medium'::text,
  status text DEFAULT 'pending'::text,
  is_ai_generated boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  question_type text NOT NULL DEFAULT 'single_choice'::text,
  passage_id uuid,
  listening_passage_id uuid
);

-- Lượt làm quiz của người dùng
CREATE TABLE IF NOT EXISTS exam_module.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  user_id uuid,
  score integer DEFAULT 0,
  total_questions integer DEFAULT 0,
  answers jsonb,
  completed_at timestamp with time zone DEFAULT now(),
  mode text DEFAULT 'normal'::text,
  violation_count integer NOT NULL DEFAULT 0,
  proctor_events jsonb,
  snapshots jsonb,
  assignment_id uuid,
  attempt_number integer DEFAULT 1,
  status text DEFAULT 'graded'::text,
  manual_score integer,
  feedback text,
  graded_by uuid,
  graded_at timestamp with time zone,
  ai_feedback jsonb,
  passed boolean
);

-- Khoá làm bài khi vi phạm giám sát (proctor)
CREATE TABLE IF NOT EXISTS exam_module.quiz_lockouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  violation_count integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Câu hỏi trong quiz
CREATE TABLE IF NOT EXISTS exam_module.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid,
  question text NOT NULL,
  options jsonb,
  correct_answer text,
  explanation text,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  question_type text NOT NULL DEFAULT 'single_choice'::text,
  bank_question_id uuid,
  correct_answer_data jsonb,
  passage_snapshot jsonb
);

-- Bài quiz / bài kiểm tra
CREATE TABLE IF NOT EXISTS exam_module.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_ja text,
  description text,
  course_id uuid,
  lesson_id uuid,
  type text DEFAULT 'multiple_choice'::text,
  time_limit integer,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  mode text NOT NULL DEFAULT 'normal'::text,
  teacher_id uuid,
  is_exam boolean DEFAULT false,
  strict_fullscreen boolean NOT NULL DEFAULT false,
  passing_type text,
  passing_value numeric
);

-- Đoạn đọc dùng cho câu hỏi
CREATE TABLE IF NOT EXISTS exam_module.reading_passages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  content text,
  level text,
  topic text,
  source text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text
);

-- Ngân hàng câu hỏi của giáo viên
CREATE TABLE IF NOT EXISTS exam_module.teacher_question_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  question_text text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text,
  explanation text,
  level text,
  skill text,
  topic text,
  difficulty text DEFAULT 'medium'::text,
  status text DEFAULT 'approved'::text,
  is_ai_generated boolean DEFAULT false,
  question_type text DEFAULT 'single_choice'::text,
  passage_id uuid,
  source_bank_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  passage_snapshot jsonb
);

-- Đoạn đọc của giáo viên
CREATE TABLE IF NOT EXISTS exam_module.teacher_reading_passages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text,
  content text,
  image_url text,
  level text,
  topic text,
  source text,
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng nối thư mục ↔ học phần
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_folder_sets (
  folder_id uuid NOT NULL,
  set_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now()
);

-- Thư mục flashcard
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tiến độ thuộc/chưa thuộc từng thẻ
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_progress (
  student_id uuid NOT NULL,
  card_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'learning'::text,
  last_reviewed_at timestamp with time zone DEFAULT now()
);

-- Học phần flashcard
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Bài kiểm tra flashcard sinh bằng AI
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Thẻ (từ + định nghĩa)
CREATE TABLE IF NOT EXISTS flashcard_module.flashcards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL,
  term text NOT NULL,
  definition text NOT NULL,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Nhóm câu hỏi ngân hàng JLPT (theo mondai)
CREATE TABLE IF NOT EXISTS jlpt_module.jlpt_bank_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  mondai_type text NOT NULL,
  title text,
  passage_text text,
  image_url text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Câu hỏi ngân hàng JLPT
CREATE TABLE IF NOT EXISTS jlpt_module.jlpt_bank_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid,
  level text NOT NULL,
  mondai_type text NOT NULL,
  score_category text NOT NULL,
  question_text text,
  image_url text,
  audio_url text,
  audio_transcript text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  translation_vi text,
  option_translations jsonb,
  source text NOT NULL DEFAULT 'manual'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Đáp án từng câu trong lượt thi thử
CREATE TABLE IF NOT EXISTS jlpt_module.mock_attempt_answers (
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_index integer,
  is_correct boolean,
  answered_at timestamp with time zone DEFAULT now()
);

-- Lượt thi thử JLPT
CREATE TABLE IF NOT EXISTS jlpt_module.mock_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress'::text,
  current_section_position integer NOT NULL DEFAULT 0,
  section_deadline_at timestamp with time zone,
  started_at timestamp with time zone DEFAULT now(),
  submitted_at timestamp with time zone,
  scores jsonb,
  total_score integer,
  passed boolean,
  duration_seconds integer,
  user_role text NOT NULL DEFAULT 'student'::text
);

-- Phần (section) của đề thi thử
CREATE TABLE IF NOT EXISTS jlpt_module.mock_exam_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  section_type text NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  time_limit_minutes integer NOT NULL DEFAULT 30
);

-- Đề thi thử JLPT
CREATE TABLE IF NOT EXISTS jlpt_module.mock_exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  title text NOT NULL,
  description text,
  is_published boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone,
  is_free boolean NOT NULL DEFAULT false
);

-- Nhóm câu hỏi trong một section
CREATE TABLE IF NOT EXISTS jlpt_module.mock_question_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  mondai_number integer NOT NULL DEFAULT 1,
  mondai_type text NOT NULL,
  score_category text NOT NULL,
  passage_text text,
  image_url text,
  bank_group_id uuid
);

-- Câu hỏi trong đề thi thử
CREATE TABLE IF NOT EXISTS jlpt_module.mock_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  question_text text,
  image_url text,
  audio_url text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  translation_vi text,
  passage_snapshot jsonb,
  audio_transcript text,
  option_translations jsonb,
  bank_question_id uuid
);

-- Mẫu ngữ pháp (kho ngữ pháp)
CREATE TABLE IF NOT EXISTS language_module.grammar_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pattern character varying(200) NOT NULL,
  structure character varying(500),
  meaning_vi text NOT NULL,
  meaning_en text,
  jlpt_level_id smallint NOT NULL,
  usage_notes text,
  example_sentences jsonb,
  related_patterns jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_public boolean NOT NULL DEFAULT true
);

-- Điểm ngữ pháp gắn với bài học
CREATE TABLE IF NOT EXISTS language_module.grammar_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_ja text,
  meaning_vi text NOT NULL,
  explanation text,
  example_sentence text,
  level text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Bảng nối bộ ngữ pháp ↔ mẫu
CREATE TABLE IF NOT EXISTS language_module.grammar_set_items (
  set_id uuid NOT NULL,
  pattern_id uuid NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

-- Bộ sưu tập ngữ pháp
CREATE TABLE IF NOT EXISTS language_module.grammar_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(200) NOT NULL,
  description text,
  created_by uuid NOT NULL,
  jlpt_level_id smallint,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 0
);

-- Bảng tra cứu cấp độ JLPT (N5–N1)
CREATE TABLE IF NOT EXISTS language_module.jlpt_levels (
  id smallint NOT NULL,
  name character(2) NOT NULL,
  description character varying(100)
);

-- Kho kanji
CREATE TABLE IF NOT EXISTS language_module.kanji (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "character" character(1) NOT NULL,
  stroke_count smallint,
  onyomi character varying(200),
  kunyomi character varying(200),
  meaning_vi text NOT NULL,
  meaning_en text,
  jlpt_level_id smallint,
  radical character varying(10),
  stroke_order_url character varying(500),
  example_words jsonb,
  mnemonic_vi text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  han_viet character varying,
  lesson_id uuid,
  created_by uuid,
  is_public boolean NOT NULL DEFAULT true
);

-- Bảng nối bộ kanji ↔ kanji
CREATE TABLE IF NOT EXISTS language_module.kanji_set_items (
  set_id uuid NOT NULL,
  kanji_id uuid NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

-- Bộ sưu tập kanji
CREATE TABLE IF NOT EXISTS language_module.kanji_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(200) NOT NULL,
  description text,
  created_by uuid NOT NULL,
  jlpt_level_id smallint,
  topic_id integer,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 0
);

-- Mục trong một danh sách học
CREATE TABLE IF NOT EXISTS language_module.study_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  item_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Bài đăng danh sách học (admin/giáo viên tạo)
CREATE TABLE IF NOT EXISTS language_module.study_list_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  list_type text NOT NULL,
  title text NOT NULL,
  description text,
  creator_type character varying(10) NOT NULL,
  created_by uuid NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  level text,
  topic text,
  is_locked boolean NOT NULL DEFAULT false,
  lock_note text
);

-- Kanji do giáo viên đóng góp (chờ duyệt)
CREATE TABLE IF NOT EXISTS language_module.teacher_kanji (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  "character" text NOT NULL,
  reading_on text[],
  reading_kun text[],
  meaning_vi text NOT NULL,
  stroke_count integer,
  level text,
  status text NOT NULL DEFAULT 'draft'::text,
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Từ vựng do giáo viên đóng góp (chờ duyệt)
CREATE TABLE IF NOT EXISTS language_module.teacher_vocabulary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  kanji text,
  reading text NOT NULL,
  meaning_vi text NOT NULL,
  meaning_ja text,
  level text,
  type text,
  example_sentence text,
  status text NOT NULL DEFAULT 'draft'::text,
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  han_viet character varying(200)
);

-- Chủ đề (bảng tra cứu, dùng sequence)
CREATE TABLE IF NOT EXISTS language_module.topics (
  id integer NOT NULL DEFAULT nextval('language_module.topics_id_seq'::regclass),
  name_vi character varying(100) NOT NULL,
  name_en character varying(100),
  name_ja character varying(100),
  icon_url character varying(500),
  parent_id integer
);

-- Kho từ vựng
CREATE TABLE IF NOT EXISTS language_module.vocabulary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  word character varying(100) NOT NULL,
  reading character varying(100) NOT NULL,
  romaji character varying(100),
  meaning_vi text NOT NULL,
  meaning_en text,
  part_of_speech character varying(30),
  jlpt_level_id smallint,
  example_sentence text,
  example_sentence_vi text,
  audio_url character varying(500),
  image_url character varying(500),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  lesson_id uuid,
  topic character varying,
  created_by uuid,
  is_public boolean NOT NULL DEFAULT true,
  han_viet character varying(200)
);

-- Bảng nối bộ từ vựng ↔ từ
CREATE TABLE IF NOT EXISTS language_module.vocabulary_set_items (
  set_id uuid NOT NULL,
  vocabulary_id uuid NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

-- Bộ sưu tập từ vựng
CREATE TABLE IF NOT EXISTS language_module.vocabulary_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(200) NOT NULL,
  description text,
  created_by uuid NOT NULL,
  jlpt_level_id smallint,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  view_count integer NOT NULL DEFAULT 0
);

-- Bảng nối từ vựng ↔ chủ đề
CREATE TABLE IF NOT EXISTS language_module.vocabulary_topics (
  vocabulary_id uuid NOT NULL,
  topic_id integer NOT NULL
);

-- Lượt đọc bài (dedupe + đếm quota/ngày)
CREATE TABLE IF NOT EXISTS practice_module.article_reads (
  article_id uuid NOT NULL,
  user_id uuid NOT NULL,
  first_read_at timestamp with time zone DEFAULT now(),
  read_date date DEFAULT CURRENT_DATE
);

-- Bài luyện đọc (furigana + dịch theo câu)
CREATE TABLE IF NOT EXISTS practice_module.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_vi text,
  summary_vi text,
  level text,
  thumbnail_url text,
  content text,
  segments jsonb DEFAULT '[]'::jsonb,
  is_published boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  questions jsonb DEFAULT '[]'::jsonb,
  vocab jsonb DEFAULT '[]'::jsonb,
  grammar jsonb DEFAULT '[]'::jsonb,
  view_count integer NOT NULL DEFAULT 0,
  published_at timestamp with time zone,
  creator_type text DEFAULT 'admin'::text
);

-- Từng dòng hội thoại luyện nghe
CREATE TABLE IF NOT EXISTS practice_module.listening_dialogue_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dialogue_id uuid NOT NULL,
  line_order integer NOT NULL,
  speaker text NOT NULL DEFAULT 'A'::text,
  text_jp text NOT NULL,
  text_plain text NOT NULL,
  text_vi text,
  created_at timestamp with time zone DEFAULT now()
);

-- Hội thoại luyện nghe (admin tạo)
CREATE TABLE IF NOT EXISTS practice_module.listening_dialogues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_vi text,
  level text NOT NULL,
  topic text,
  thumbnail_icon text DEFAULT 'headphones'::text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  creator_type text DEFAULT 'admin'::text,
  is_published boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now()
);

-- Nội dung luyện nghe tự tạo (TTS/audio/video/YouTube)
CREATE TABLE IF NOT EXISTS practice_module.listening_user_audios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Bài nghe'::text,
  level text,
  audio_url text,
  storage_path text,
  transcript text DEFAULT ''::text,
  segments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  creator_type text DEFAULT 'student'::text,
  is_public boolean DEFAULT false,
  source_type text,
  content_url text,
  title_vi text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Kết quả chấm phát âm bằng AI
CREATE TABLE IF NOT EXISTS practice_module.pronunciation_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid,
  listening_material_id uuid,
  question_id uuid,
  target_text text NOT NULL,
  target_reading text,
  audio_url character varying(500) NOT NULL,
  ai_overall_score numeric(4,2),
  ai_fluency_score numeric(4,2),
  ai_feedback_vi text,
  ai_model_version character varying(50),
  assessed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Bộ đề luyện đọc
CREATE TABLE IF NOT EXISTS practice_module.reading_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text,
  jlpt_level text,
  difficulty text DEFAULT 'medium'::text,
  topic text,
  short_description text,
  instructions text,
  estimated_time_minutes integer,
  source_type text DEFAULT 'manual'::text,
  status text DEFAULT 'draft'::text,
  tags text[] DEFAULT '{}'::text[],
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone
);

-- Bản nháp bộ đề luyện đọc
CREATE TABLE IF NOT EXISTS practice_module.rs_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reading_set_id uuid,
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Lựa chọn đáp án câu hỏi luyện đọc
CREATE TABLE IF NOT EXISTS practice_module.rs_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  option_text text NOT NULL DEFAULT ''::text,
  is_correct boolean DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

-- Đoạn văn trong bộ đề luyện đọc
CREATE TABLE IF NOT EXISTS practice_module.rs_passages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reading_set_id uuid NOT NULL,
  title text,
  content text NOT NULL DEFAULT ''::text,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  needs_review boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Câu hỏi luyện đọc
CREATE TABLE IF NOT EXISTS practice_module.rs_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reading_set_id uuid NOT NULL,
  passage_id uuid NOT NULL,
  question_type text NOT NULL DEFAULT 'single_choice'::text,
  question_text text NOT NULL DEFAULT ''::text,
  explanation text,
  skill_tags text[] DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  needs_review boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Bài viết học viên nộp (chấm AI/giáo viên)
CREATE TABLE IF NOT EXISTS practice_module.writing_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  question_id uuid,
  attempt_id uuid,
  lesson_id uuid,
  reading_material_id uuid,
  submission_text text NOT NULL,
  ai_score numeric(5,2),
  ai_grammar_score numeric(5,2),
  ai_vocabulary_score numeric(5,2),
  ai_coherence_score numeric(5,2),
  ai_feedback_vi text,
  ai_corrected_text text,
  ai_model_version character varying(50),
  teacher_score numeric(5,2),
  teacher_feedback text,
  teacher_corrected_text text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  topic text,
  level character varying(5)
);

-- Cấu hình hệ thống (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Phiên đăng nhập (express-session store)
CREATE TABLE IF NOT EXISTS public.session (
  sid character varying NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) without time zone NOT NULL
);

-- Bảng tra cứu vai trò (student/teacher/admin)
CREATE TABLE IF NOT EXISTS users_module.roles (
  id smallint NOT NULL,
  name character varying(20) NOT NULL,
  description character varying(255)
);

-- Hồ sơ học viên
CREATE TABLE IF NOT EXISTS users_module.student_profiles (
  user_id uuid NOT NULL,
  jlpt_target_level character(2),
  current_level character(2),
  native_language character varying(50) NOT NULL DEFAULT 'vi'::character varying,
  study_goal text,
  daily_study_minutes smallint NOT NULL DEFAULT 20,
  streak_days integer NOT NULL DEFAULT 0,
  last_study_date date,
  onboarding_done boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Đơn xin làm giáo viên (kèm AI screening)
CREATE TABLE IF NOT EXISTS users_module.teacher_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  decided_by text,
  phone text,
  highest_qualification text,
  specialization text,
  years_experience integer,
  education text,
  bio text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_verdict text,
  ai_summary text,
  ai_flags jsonb,
  ai_confidence integer,
  ai_model text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Hồ sơ giáo viên đã duyệt
CREATE TABLE IF NOT EXISTS users_module.teacher_profiles (
  user_id uuid NOT NULL,
  bio text,
  qualifications text,
  approval_status character varying(20) NOT NULL DEFAULT 'pending'::character varying,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Nhật ký thao tác của admin trên người dùng
CREATE TABLE IF NOT EXISTS users_module.user_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_id uuid NOT NULL,
  action character varying(30) NOT NULL,
  old_value character varying(200),
  new_value character varying(200),
  reason character varying(500),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Người dùng (mirror auth.users + hồ sơ)
CREATE TABLE IF NOT EXISTS users_module.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying(255) NOT NULL,
  role_id smallint NOT NULL DEFAULT 1,
  full_name character varying(100) NOT NULL,
  avatar_url character varying(500),
  phone character varying(20),
  date_of_birth date,
  is_active boolean NOT NULL DEFAULT true,
  is_email_verified boolean NOT NULL DEFAULT false,
  lock_reason character varying(500),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- PRIMARY KEYS  (Khoá chính)
-- --------------------------------------------------------------------------

ALTER TABLE ai_module.ai_generated_questions ADD CONSTRAINT pk_ai_gen_q PRIMARY KEY (id);

ALTER TABLE ai_module.ai_learning_paths ADD CONSTRAINT pk_ai_paths PRIMARY KEY (id);

ALTER TABLE ai_module.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE ai_module.chat_sessions ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ai_module.kanji_writing_sheets ADD CONSTRAINT pk_kanji_writing_sheets PRIMARY KEY (id);

ALTER TABLE ai_module.learning_path_steps ADD CONSTRAINT learning_path_steps_pkey PRIMARY KEY (id);

ALTER TABLE ai_module.learning_paths ADD CONSTRAINT learning_paths_pkey PRIMARY KEY (id);

ALTER TABLE ai_module.notifications ADD CONSTRAINT pk_notifications PRIMARY KEY (id);

ALTER TABLE ai_module.student_dashboards ADD CONSTRAINT pk_dashboards PRIMARY KEY (student_id);

ALTER TABLE billing_module.content_usage_events ADD CONSTRAINT content_usage_events_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.course_payment_orders ADD CONSTRAINT course_payment_orders_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.feature_entitlements ADD CONSTRAINT feature_entitlements_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.feature_usage_counters ADD CONSTRAINT feature_usage_counters_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.payment_orders ADD CONSTRAINT payment_orders_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.payment_transactions ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.revenue_pool_periods ADD CONSTRAINT revenue_pool_periods_pkey PRIMARY KEY (period_key);

ALTER TABLE billing_module.subscription_plans ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.teacher_payouts ADD CONSTRAINT teacher_payouts_pkey PRIMARY KEY (id);

ALTER TABLE billing_module.user_subscriptions ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE course_module.course_enrollments ADD CONSTRAINT pk_course_enrollments PRIMARY KEY (id);

ALTER TABLE course_module.course_reviews ADD CONSTRAINT course_reviews_pkey PRIMARY KEY (id);

ALTER TABLE course_module.courses ADD CONSTRAINT pk_courses PRIMARY KEY (id);

ALTER TABLE course_module.lesson_grammar ADD CONSTRAINT pk_lesson_grammar PRIMARY KEY (lesson_id, pattern_id);

ALTER TABLE course_module.lesson_grammar_points ADD CONSTRAINT pk_lesson_grammar_points PRIMARY KEY (lesson_id, grammar_point_id);

ALTER TABLE course_module.lesson_kanji ADD CONSTRAINT pk_lesson_kanji PRIMARY KEY (lesson_id, kanji_id);

ALTER TABLE course_module.lesson_progress ADD CONSTRAINT pk_lesson_progress PRIMARY KEY (id);

ALTER TABLE course_module.lesson_vocabulary ADD CONSTRAINT pk_lesson_vocab PRIMARY KEY (lesson_id, vocabulary_id);

ALTER TABLE course_module.lessons ADD CONSTRAINT pk_lessons PRIMARY KEY (id);

ALTER TABLE course_module.skills ADD CONSTRAINT pk_skills PRIMARY KEY (id);

ALTER TABLE course_module.units ADD CONSTRAINT units_pkey PRIMARY KEY (id);

ALTER TABLE dictionary_module.dict_entries ADD CONSTRAINT dict_entries_pkey PRIMARY KEY (id);

ALTER TABLE dictionary_module.dict_examples ADD CONSTRAINT dict_examples_pkey PRIMARY KEY (id);

ALTER TABLE dictionary_module.dict_kanji ADD CONSTRAINT dict_kanji_pkey PRIMARY KEY (id);

ALTER TABLE dictionary_module.dict_related_words ADD CONSTRAINT dict_related_words_pkey PRIMARY KEY (id);

ALTER TABLE dictionary_module.dict_senses ADD CONSTRAINT dict_senses_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.listening_passages ADD CONSTRAINT listening_passages_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.quiz_attempts ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.quiz_lockouts ADD CONSTRAINT quiz_lockouts_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.quiz_questions ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.quizzes ADD CONSTRAINT quizzes_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.reading_passages ADD CONSTRAINT reading_passages_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_pkey PRIMARY KEY (id);

ALTER TABLE exam_module.teacher_reading_passages ADD CONSTRAINT teacher_reading_passages_pkey PRIMARY KEY (id);

ALTER TABLE flashcard_module.flashcard_folder_sets ADD CONSTRAINT flashcard_folder_sets_pkey PRIMARY KEY (folder_id, set_id);

ALTER TABLE flashcard_module.flashcard_folders ADD CONSTRAINT flashcard_folders_pkey PRIMARY KEY (id);

ALTER TABLE flashcard_module.flashcard_progress ADD CONSTRAINT flashcard_progress_pkey PRIMARY KEY (student_id, card_id);

ALTER TABLE flashcard_module.flashcard_sets ADD CONSTRAINT flashcard_sets_pkey PRIMARY KEY (id);

ALTER TABLE flashcard_module.flashcard_tests ADD CONSTRAINT flashcard_tests_pkey PRIMARY KEY (id);

ALTER TABLE flashcard_module.flashcards ADD CONSTRAINT flashcards_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.jlpt_bank_groups ADD CONSTRAINT jlpt_bank_groups_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.mock_attempt_answers ADD CONSTRAINT mock_attempt_answers_pkey PRIMARY KEY (attempt_id, question_id);

ALTER TABLE jlpt_module.mock_attempts ADD CONSTRAINT mock_attempts_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.mock_exam_sections ADD CONSTRAINT mock_exam_sections_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.mock_exams ADD CONSTRAINT mock_exams_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.mock_question_groups ADD CONSTRAINT mock_question_groups_pkey PRIMARY KEY (id);

ALTER TABLE jlpt_module.mock_questions ADD CONSTRAINT mock_questions_pkey PRIMARY KEY (id);

ALTER TABLE language_module.grammar_patterns ADD CONSTRAINT pk_grammar_patterns PRIMARY KEY (id);

ALTER TABLE language_module.grammar_points ADD CONSTRAINT grammar_points_pkey PRIMARY KEY (id);

ALTER TABLE language_module.grammar_set_items ADD CONSTRAINT pk_grammar_set_items PRIMARY KEY (set_id, pattern_id);

ALTER TABLE language_module.grammar_sets ADD CONSTRAINT pk_grammar_sets PRIMARY KEY (id);

ALTER TABLE language_module.jlpt_levels ADD CONSTRAINT pk_jlpt_levels PRIMARY KEY (id);

ALTER TABLE language_module.kanji ADD CONSTRAINT pk_kanji PRIMARY KEY (id);

ALTER TABLE language_module.kanji_set_items ADD CONSTRAINT pk_kanji_set_items PRIMARY KEY (set_id, kanji_id);

ALTER TABLE language_module.kanji_sets ADD CONSTRAINT pk_kanji_sets PRIMARY KEY (id);

ALTER TABLE language_module.study_list_items ADD CONSTRAINT study_list_items_pkey PRIMARY KEY (id);

ALTER TABLE language_module.study_list_posts ADD CONSTRAINT study_list_posts_pkey PRIMARY KEY (id);

ALTER TABLE language_module.teacher_kanji ADD CONSTRAINT teacher_kanji_pkey PRIMARY KEY (id);

ALTER TABLE language_module.teacher_vocabulary ADD CONSTRAINT teacher_vocabulary_pkey PRIMARY KEY (id);

ALTER TABLE language_module.topics ADD CONSTRAINT pk_topics PRIMARY KEY (id);

ALTER TABLE language_module.vocabulary ADD CONSTRAINT pk_vocabulary PRIMARY KEY (id);

ALTER TABLE language_module.vocabulary_set_items ADD CONSTRAINT pk_vsi PRIMARY KEY (set_id, vocabulary_id);

ALTER TABLE language_module.vocabulary_sets ADD CONSTRAINT pk_vocab_sets PRIMARY KEY (id);

ALTER TABLE language_module.vocabulary_topics ADD CONSTRAINT pk_vocab_topics PRIMARY KEY (vocabulary_id, topic_id);

ALTER TABLE practice_module.article_reads ADD CONSTRAINT news_article_reads_pkey PRIMARY KEY (article_id, user_id);

ALTER TABLE practice_module.articles ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.listening_dialogue_lines ADD CONSTRAINT listening_dialogue_lines_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.listening_dialogues ADD CONSTRAINT listening_dialogues_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.listening_user_audios ADD CONSTRAINT listening_user_audios_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.pronunciation_assessments ADD CONSTRAINT pk_pron_assess PRIMARY KEY (id);

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.rs_drafts ADD CONSTRAINT rs_drafts_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.rs_options ADD CONSTRAINT rs_options_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.rs_passages ADD CONSTRAINT rs_passages_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.rs_questions ADD CONSTRAINT rs_questions_pkey PRIMARY KEY (id);

ALTER TABLE practice_module.writing_submissions ADD CONSTRAINT pk_writing_sub PRIMARY KEY (id);

ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);

ALTER TABLE public.session ADD CONSTRAINT session_pkey PRIMARY KEY (sid);

ALTER TABLE users_module.roles ADD CONSTRAINT pk_roles PRIMARY KEY (id);

ALTER TABLE users_module.student_profiles ADD CONSTRAINT pk_student_profiles PRIMARY KEY (user_id);

ALTER TABLE users_module.teacher_applications ADD CONSTRAINT teacher_applications_pkey PRIMARY KEY (id);

ALTER TABLE users_module.teacher_profiles ADD CONSTRAINT pk_teacher_profiles PRIMARY KEY (user_id);

ALTER TABLE users_module.user_audit_logs ADD CONSTRAINT pk_user_audit_logs PRIMARY KEY (id);

ALTER TABLE users_module.users ADD CONSTRAINT pk_users PRIMARY KEY (id);

-- --------------------------------------------------------------------------
-- UNIQUE CONSTRAINTS  (Ràng buộc duy nhất)
-- --------------------------------------------------------------------------

ALTER TABLE billing_module.course_payment_orders ADD CONSTRAINT course_payment_orders_order_code_key UNIQUE (order_code);

ALTER TABLE billing_module.course_payment_orders ADD CONSTRAINT course_payment_orders_payment_code_key UNIQUE (payment_code);

ALTER TABLE billing_module.feature_entitlements ADD CONSTRAINT feature_entitlements_tier_feature_code_key UNIQUE (tier, feature_code);

ALTER TABLE billing_module.feature_usage_counters ADD CONSTRAINT feature_usage_counters_user_id_feature_code_period_key_key UNIQUE (user_id, feature_code, period_key);

ALTER TABLE billing_module.payment_orders ADD CONSTRAINT payment_orders_order_code_key UNIQUE (order_code);

ALTER TABLE billing_module.payment_orders ADD CONSTRAINT payment_orders_payment_code_key UNIQUE (payment_code);

ALTER TABLE billing_module.payment_transactions ADD CONSTRAINT payment_transactions_provider_external_transaction_id_key UNIQUE (provider, external_transaction_id);

ALTER TABLE billing_module.subscription_plans ADD CONSTRAINT subscription_plans_code_key UNIQUE (code);

ALTER TABLE billing_module.teacher_payouts ADD CONSTRAINT teacher_payouts_period_key_teacher_id_key UNIQUE (period_key, teacher_id);

ALTER TABLE course_module.course_enrollments ADD CONSTRAINT uq_ce UNIQUE (course_id, student_id);

ALTER TABLE course_module.course_reviews ADD CONSTRAINT course_reviews_course_id_student_id_key UNIQUE (course_id, student_id);

ALTER TABLE course_module.lesson_progress ADD CONSTRAINT uq_lp UNIQUE (student_id, lesson_id);

ALTER TABLE course_module.skills ADD CONSTRAINT uq_skills_name UNIQUE (name);

ALTER TABLE dictionary_module.dict_entries ADD CONSTRAINT dict_entries_source_source_id_key UNIQUE (source, source_id);

ALTER TABLE dictionary_module.dict_examples ADD CONSTRAINT dict_examples_sense_id_sentence_jp_key UNIQUE (sense_id, sentence_jp);

ALTER TABLE dictionary_module.dict_kanji ADD CONSTRAINT dict_kanji_character_key UNIQUE ("character");

ALTER TABLE dictionary_module.dict_related_words ADD CONSTRAINT dict_related_words_entry_id_related_id_relation_type_key UNIQUE (entry_id, related_id, relation_type);

ALTER TABLE dictionary_module.dict_senses ADD CONSTRAINT dict_senses_entry_id_order_index_key UNIQUE (entry_id, order_index);

ALTER TABLE exam_module.quiz_lockouts ADD CONSTRAINT quiz_lockouts_quiz_id_user_id_key UNIQUE (quiz_id, user_id);

ALTER TABLE flashcard_module.flashcard_tests ADD CONSTRAINT flashcard_tests_set_id_key UNIQUE (set_id);

ALTER TABLE language_module.jlpt_levels ADD CONSTRAINT uq_jlpt_name UNIQUE (name);

ALTER TABLE language_module.kanji ADD CONSTRAINT uq_kanji_char UNIQUE ("character");

ALTER TABLE language_module.study_list_items ADD CONSTRAINT study_list_items_post_id_item_id_key UNIQUE (post_id, item_id);

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_code_key UNIQUE (code);

ALTER TABLE users_module.roles ADD CONSTRAINT uq_roles_name UNIQUE (name);

ALTER TABLE users_module.users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- --------------------------------------------------------------------------
-- CHECK CONSTRAINTS  (Ràng buộc kiểm tra giá trị)
-- --------------------------------------------------------------------------

ALTER TABLE ai_module.chat_messages ADD CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));

ALTER TABLE ai_module.learning_path_steps ADD CONSTRAINT learning_path_steps_resource_level_check CHECK ((resource_level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE ai_module.learning_path_steps ADD CONSTRAINT learning_path_steps_resource_type_check CHECK ((resource_type = ANY (ARRAY['course'::text, 'study_list'::text, 'mock_exam'::text])));

ALTER TABLE ai_module.learning_path_steps ADD CONSTRAINT learning_path_steps_skill_focus_check CHECK ((skill_focus = ANY (ARRAY['vocabulary'::text, 'kanji'::text, 'grammar'::text, 'reading'::text, 'listening'::text, 'mixed'::text])));

ALTER TABLE ai_module.learning_path_steps ADD CONSTRAINT learning_path_steps_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text])));

ALTER TABLE ai_module.learning_paths ADD CONSTRAINT learning_paths_current_level_check CHECK ((current_level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE ai_module.learning_paths ADD CONSTRAINT learning_paths_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])));

ALTER TABLE ai_module.learning_paths ADD CONSTRAINT learning_paths_target_level_check CHECK ((target_level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE billing_module.content_usage_events ADD CONSTRAINT content_usage_events_content_type_check CHECK ((content_type = ANY (ARRAY['listening'::text, 'reading'::text, 'study_list'::text])));

ALTER TABLE billing_module.course_payment_orders ADD CONSTRAINT course_payment_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'cancelled'::text])));

ALTER TABLE billing_module.feature_entitlements ADD CONSTRAINT feature_entitlements_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'monthly'::text, 'none'::text])));

ALTER TABLE billing_module.feature_usage_counters ADD CONSTRAINT feature_usage_counters_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'monthly'::text, 'none'::text])));

ALTER TABLE billing_module.payment_orders ADD CONSTRAINT payment_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'cancelled'::text, 'failed'::text])));

ALTER TABLE billing_module.payments ADD CONSTRAINT payments_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'refunded'::character varying, 'failed'::character varying])::text[])));

ALTER TABLE billing_module.subscription_plans ADD CONSTRAINT subscription_plans_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'none'::text])));

ALTER TABLE billing_module.subscription_plans ADD CONSTRAINT subscription_plans_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'premium'::text])));

ALTER TABLE billing_module.teacher_payouts ADD CONSTRAINT teacher_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])));

ALTER TABLE billing_module.user_subscriptions ADD CONSTRAINT user_subscriptions_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'sepay'::text, 'admin_grant'::text])));

ALTER TABLE billing_module.user_subscriptions ADD CONSTRAINT user_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text, 'pending'::text, 'grace_period'::text])));

ALTER TABLE course_module.course_enrollments ADD CONSTRAINT ck_ce_pct CHECK (((progress_pct >= 0) AND (progress_pct <= 100)));

ALTER TABLE course_module.course_reviews ADD CONSTRAINT course_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));

ALTER TABLE course_module.courses ADD CONSTRAINT courses_creator_type_check CHECK (((creator_type)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying])::text[])));

ALTER TABLE course_module.courses ADD CONSTRAINT courses_difficulty_level_check CHECK (((difficulty_level)::text = ANY ((ARRAY['N5'::character varying, 'N4'::character varying, 'N3'::character varying, 'N2'::character varying, 'N1'::character varying, 'mixed'::character varying])::text[])));

ALTER TABLE course_module.lesson_progress ADD CONSTRAINT ck_lp_pct CHECK (((progress_pct >= 0) AND (progress_pct <= 100)));

ALTER TABLE course_module.lesson_progress ADD CONSTRAINT ck_lp_status CHECK (((status)::text = ANY ((ARRAY['not_started'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])));

ALTER TABLE course_module.lessons ADD CONSTRAINT ck_lessons_ctype CHECK (((content_type)::text = ANY (ARRAY['text'::text, 'audio'::text, 'video'::text, 'kaiwa'::text, 'reading'::text, 'exercise'::text, 'grammar'::text, 'quiz'::text, 'vocabulary'::text, 'kanji'::text])));

ALTER TABLE dictionary_module.dict_entries ADD CONSTRAINT dict_entries_jlpt_level_check CHECK ((jlpt_level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE dictionary_module.dict_related_words ADD CONSTRAINT dict_related_words_check CHECK ((entry_id <> related_id));

ALTER TABLE dictionary_module.dict_related_words ADD CONSTRAINT dict_related_words_relation_type_check CHECK ((relation_type = ANY (ARRAY['related'::text, 'synonym'::text, 'antonym'::text])));

ALTER TABLE exam_module.listening_passages ADD CONSTRAINT listening_passages_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])));

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_skill_check CHECK ((skill = ANY (ARRAY['Đọc hiểu'::text, 'Nghe hiểu'::text, 'Nói'::text, 'Viết'::text])));

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'draft'::text])));

ALTER TABLE exam_module.quizzes ADD CONSTRAINT quizzes_mode_check CHECK ((mode = ANY (ARRAY['normal'::text, 'proctored'::text])));

ALTER TABLE exam_module.quizzes ADD CONSTRAINT quizzes_passing_type_check CHECK (((passing_type IS NULL) OR (passing_type = ANY (ARRAY['percent'::text, 'count'::text]))));

ALTER TABLE exam_module.quizzes ADD CONSTRAINT quizzes_type_check CHECK ((type = ANY (ARRAY['multiple_choice'::text, 'fill_blank'::text, 'matching'::text, 'mixed'::text, 'grammar'::text, 'reading'::text, 'practice'::text])));

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])));

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_skill_check CHECK ((skill = ANY (ARRAY['Đọc hiểu'::text, 'Nghe hiểu'::text, 'Nói'::text, 'Viết'::text])));

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'draft'::text])));

ALTER TABLE flashcard_module.flashcard_progress ADD CONSTRAINT flashcard_progress_status_check CHECK ((status = ANY (ARRAY['learning'::text, 'mastered'::text])));

ALTER TABLE jlpt_module.jlpt_bank_groups ADD CONSTRAINT jlpt_bank_groups_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE jlpt_module.jlpt_bank_groups ADD CONSTRAINT jlpt_bank_groups_mondai_type_check CHECK ((mondai_type = ANY (ARRAY['kanji_reading'::text, 'orthography'::text, 'word_formation'::text, 'context'::text, 'paraphrase'::text, 'usage'::text, 'grammar_form'::text, 'sentence_assembly'::text, 'text_grammar'::text, 'reading_short'::text, 'reading_mid'::text, 'reading_long'::text, 'integrated_reading'::text, 'thematic_reading'::text, 'info_retrieval'::text, 'task_comprehension'::text, 'point_comprehension'::text, 'summary_comprehension'::text, 'utterance_expression'::text, 'quick_response'::text, 'integrated_listening'::text])));

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_mondai_type_check CHECK ((mondai_type = ANY (ARRAY['kanji_reading'::text, 'orthography'::text, 'word_formation'::text, 'context'::text, 'paraphrase'::text, 'usage'::text, 'grammar_form'::text, 'sentence_assembly'::text, 'text_grammar'::text, 'reading_short'::text, 'reading_mid'::text, 'reading_long'::text, 'integrated_reading'::text, 'thematic_reading'::text, 'info_retrieval'::text, 'task_comprehension'::text, 'point_comprehension'::text, 'summary_comprehension'::text, 'utterance_expression'::text, 'quick_response'::text, 'integrated_listening'::text])));

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_score_category_check CHECK ((score_category = ANY (ARRAY['language'::text, 'reading'::text, 'listening'::text, 'language_reading'::text])));

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ai'::text, 'import'::text])));

ALTER TABLE jlpt_module.mock_attempts ADD CONSTRAINT mock_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'expired'::text])));

ALTER TABLE jlpt_module.mock_exam_sections ADD CONSTRAINT mock_exam_sections_section_type_check CHECK ((section_type = ANY (ARRAY['vocab'::text, 'grammar_reading'::text, 'language_reading'::text, 'listening'::text])));

ALTER TABLE jlpt_module.mock_exams ADD CONSTRAINT mock_exams_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE jlpt_module.mock_question_groups ADD CONSTRAINT mock_question_groups_mondai_type_check CHECK ((mondai_type = ANY (ARRAY['kanji_reading'::text, 'orthography'::text, 'word_formation'::text, 'context'::text, 'paraphrase'::text, 'usage'::text, 'grammar_form'::text, 'sentence_assembly'::text, 'text_grammar'::text, 'reading_short'::text, 'reading_mid'::text, 'reading_long'::text, 'integrated_reading'::text, 'thematic_reading'::text, 'info_retrieval'::text, 'task_comprehension'::text, 'point_comprehension'::text, 'summary_comprehension'::text, 'utterance_expression'::text, 'quick_response'::text, 'integrated_listening'::text])));

ALTER TABLE jlpt_module.mock_question_groups ADD CONSTRAINT mock_question_groups_score_category_check CHECK ((score_category = ANY (ARRAY['language'::text, 'reading'::text, 'listening'::text, 'language_reading'::text])));

ALTER TABLE language_module.grammar_points ADD CONSTRAINT grammar_points_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE language_module.study_list_posts ADD CONSTRAINT study_list_posts_creator_type_check CHECK (((creator_type)::text = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying])::text[])));

ALTER TABLE language_module.study_list_posts ADD CONSTRAINT study_list_posts_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE language_module.study_list_posts ADD CONSTRAINT study_list_posts_list_type_check CHECK ((list_type = ANY (ARRAY['vocabulary'::text, 'kanji'::text, 'grammar'::text])));

ALTER TABLE language_module.teacher_kanji ADD CONSTRAINT teacher_kanji_level_check CHECK ((level = ANY (ARRAY['N1'::text, 'N2'::text, 'N3'::text, 'N4'::text, 'N5'::text])));

ALTER TABLE language_module.teacher_kanji ADD CONSTRAINT teacher_kanji_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE language_module.teacher_vocabulary ADD CONSTRAINT teacher_vocabulary_level_check CHECK ((level = ANY (ARRAY['N1'::text, 'N2'::text, 'N3'::text, 'N4'::text, 'N5'::text])));

ALTER TABLE language_module.teacher_vocabulary ADD CONSTRAINT teacher_vocabulary_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE practice_module.articles ADD CONSTRAINT news_articles_level_check CHECK ((level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])));

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_jlpt_level_check CHECK ((jlpt_level = ANY (ARRAY['N5'::text, 'N4'::text, 'N3'::text, 'N2'::text, 'N1'::text])));

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_source_type_check CHECK ((source_type = ANY (ARRAY['manual'::text, 'ai_generated'::text, 'imported'::text])));

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'published'::text, 'archived'::text])));

ALTER TABLE practice_module.rs_questions ADD CONSTRAINT rs_questions_question_type_check CHECK ((question_type = ANY (ARRAY['single_choice'::text, 'multiple_choice'::text, 'fill_blank'::text, 'short_answer'::text, 'true_false'::text])));

ALTER TABLE users_module.teacher_applications ADD CONSTRAINT teacher_applications_decided_by_check CHECK ((decided_by = ANY (ARRAY['ai'::text, 'admin'::text])));

ALTER TABLE users_module.teacher_applications ADD CONSTRAINT teacher_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE users_module.teacher_profiles ADD CONSTRAINT ck_tp_status CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])));

ALTER TABLE users_module.user_audit_logs ADD CONSTRAINT ck_ual_action CHECK (((action)::text = ANY ((ARRAY['lock'::character varying, 'unlock'::character varying, 'role_change'::character varying, 'approve_teacher'::character varying, 'reject_teacher'::character varying])::text[])));

-- --------------------------------------------------------------------------
-- FOREIGN KEYS  (Khoá ngoại)
-- --------------------------------------------------------------------------

ALTER TABLE ai_module.ai_generated_questions ADD CONSTRAINT fk_agq_requester FOREIGN KEY (requested_by) REFERENCES users_module.users(id);

ALTER TABLE ai_module.ai_learning_paths ADD CONSTRAINT fk_alp_student FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE ai_module.chat_messages ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES ai_module.chat_sessions(id) ON DELETE CASCADE;

ALTER TABLE ai_module.chat_sessions ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ai_module.kanji_writing_sheets ADD CONSTRAINT fk_kws_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE ai_module.kanji_writing_sheets ADD CONSTRAINT fk_kws_kanji_set FOREIGN KEY (kanji_set_id) REFERENCES language_module.kanji_sets(id);

ALTER TABLE ai_module.kanji_writing_sheets ADD CONSTRAINT fk_kws_student FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE ai_module.learning_path_steps ADD CONSTRAINT learning_path_steps_path_id_fkey FOREIGN KEY (path_id) REFERENCES ai_module.learning_paths(id) ON DELETE CASCADE;

ALTER TABLE ai_module.learning_paths ADD CONSTRAINT learning_paths_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ai_module.notifications ADD CONSTRAINT fk_notif_recipient FOREIGN KEY (recipient_id) REFERENCES users_module.users(id);

ALTER TABLE ai_module.notifications ADD CONSTRAINT fk_notif_sender FOREIGN KEY (sender_id) REFERENCES users_module.users(id);

ALTER TABLE ai_module.student_dashboards ADD CONSTRAINT fk_dash_student FOREIGN KEY (student_id) REFERENCES users_module.users(id) ON DELETE CASCADE;

ALTER TABLE billing_module.course_payment_orders ADD CONSTRAINT course_payment_orders_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_module.courses(id) ON DELETE CASCADE;

ALTER TABLE billing_module.course_payment_orders ADD CONSTRAINT course_payment_orders_student_id_fkey FOREIGN KEY (student_id) REFERENCES users_module.users(id) ON DELETE CASCADE;

ALTER TABLE billing_module.feature_usage_counters ADD CONSTRAINT feature_usage_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE billing_module.payment_orders ADD CONSTRAINT payment_orders_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES billing_module.subscription_plans(id);

ALTER TABLE billing_module.payment_orders ADD CONSTRAINT payment_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE billing_module.payment_transactions ADD CONSTRAINT payment_transactions_matched_course_order_id_fkey FOREIGN KEY (matched_course_order_id) REFERENCES billing_module.course_payment_orders(id);

ALTER TABLE billing_module.payment_transactions ADD CONSTRAINT payment_transactions_matched_order_id_fkey FOREIGN KEY (matched_order_id) REFERENCES billing_module.payment_orders(id);

ALTER TABLE billing_module.payments ADD CONSTRAINT payments_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_module.courses(id);

ALTER TABLE billing_module.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE billing_module.user_subscriptions ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES billing_module.subscription_plans(id);

ALTER TABLE billing_module.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE course_module.course_enrollments ADD CONSTRAINT fk_ce_course FOREIGN KEY (course_id) REFERENCES course_module.courses(id) ON DELETE CASCADE;

ALTER TABLE course_module.course_enrollments ADD CONSTRAINT fk_ce_student FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE course_module.course_reviews ADD CONSTRAINT course_reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_module.courses(id) ON DELETE CASCADE;

ALTER TABLE course_module.course_reviews ADD CONSTRAINT course_reviews_student_id_fkey FOREIGN KEY (student_id) REFERENCES users_module.users(id) ON DELETE CASCADE;

ALTER TABLE course_module.courses ADD CONSTRAINT fk_courses_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE course_module.courses ADD CONSTRAINT fk_courses_skill FOREIGN KEY (skill_id) REFERENCES course_module.skills(id);

ALTER TABLE course_module.courses ADD CONSTRAINT fk_courses_user FOREIGN KEY (created_by) REFERENCES users_module.users(id);

ALTER TABLE course_module.lesson_grammar ADD CONSTRAINT fk_lg_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_grammar ADD CONSTRAINT fk_lg_pattern FOREIGN KEY (pattern_id) REFERENCES language_module.grammar_patterns(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_grammar_points ADD CONSTRAINT fk_lgp_grammar FOREIGN KEY (grammar_point_id) REFERENCES language_module.grammar_points(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_grammar_points ADD CONSTRAINT fk_lgp_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_kanji ADD CONSTRAINT fk_lk_kanji FOREIGN KEY (kanji_id) REFERENCES language_module.kanji(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_kanji ADD CONSTRAINT fk_lk_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_progress ADD CONSTRAINT fk_lp_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id);

ALTER TABLE course_module.lesson_progress ADD CONSTRAINT fk_lp_student FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE course_module.lesson_vocabulary ADD CONSTRAINT fk_lv_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id) ON DELETE CASCADE;

ALTER TABLE course_module.lesson_vocabulary ADD CONSTRAINT fk_lv_vocab FOREIGN KEY (vocabulary_id) REFERENCES language_module.vocabulary(id) ON DELETE CASCADE;

ALTER TABLE course_module.lessons ADD CONSTRAINT fk_lessons_course FOREIGN KEY (course_id) REFERENCES course_module.courses(id) ON DELETE CASCADE;

ALTER TABLE course_module.lessons ADD CONSTRAINT fk_lessons_skill FOREIGN KEY (skill_id) REFERENCES course_module.skills(id);

ALTER TABLE course_module.lessons ADD CONSTRAINT fk_lessons_user FOREIGN KEY (created_by) REFERENCES users_module.users(id);

ALTER TABLE course_module.lessons ADD CONSTRAINT lessons_reading_article_id_fkey FOREIGN KEY (reading_article_id) REFERENCES practice_module.articles(id) ON DELETE SET NULL;

ALTER TABLE course_module.lessons ADD CONSTRAINT lessons_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES course_module.units(id) ON DELETE CASCADE;

ALTER TABLE course_module.units ADD CONSTRAINT units_course_id_fkey FOREIGN KEY (course_id) REFERENCES course_module.courses(id) ON DELETE CASCADE;

ALTER TABLE dictionary_module.dict_examples ADD CONSTRAINT dict_examples_sense_id_fkey FOREIGN KEY (sense_id) REFERENCES dictionary_module.dict_senses(id) ON DELETE CASCADE;

ALTER TABLE dictionary_module.dict_related_words ADD CONSTRAINT dict_related_words_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES dictionary_module.dict_entries(id) ON DELETE CASCADE;

ALTER TABLE dictionary_module.dict_related_words ADD CONSTRAINT dict_related_words_related_id_fkey FOREIGN KEY (related_id) REFERENCES dictionary_module.dict_entries(id) ON DELETE CASCADE;

ALTER TABLE dictionary_module.dict_senses ADD CONSTRAINT dict_senses_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES dictionary_module.dict_entries(id) ON DELETE CASCADE;

ALTER TABLE exam_module.listening_passages ADD CONSTRAINT listening_passages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_listening_passage_id_fkey FOREIGN KEY (listening_passage_id) REFERENCES exam_module.listening_passages(id) ON DELETE SET NULL;

ALTER TABLE exam_module.question_bank ADD CONSTRAINT question_bank_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES exam_module.reading_passages(id) ON DELETE SET NULL;

ALTER TABLE exam_module.quiz_attempts ADD CONSTRAINT quiz_attempts_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users_module.users(id) ON DELETE SET NULL;

ALTER TABLE exam_module.quiz_attempts ADD CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES exam_module.quizzes(id) ON DELETE CASCADE;

ALTER TABLE exam_module.quiz_attempts ADD CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE exam_module.quiz_lockouts ADD CONSTRAINT quiz_lockouts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES exam_module.quizzes(id) ON DELETE CASCADE;

ALTER TABLE exam_module.quiz_lockouts ADD CONSTRAINT quiz_lockouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE exam_module.quiz_questions ADD CONSTRAINT quiz_questions_bank_question_id_fkey FOREIGN KEY (bank_question_id) REFERENCES exam_module.question_bank(id) ON DELETE SET NULL;

ALTER TABLE exam_module.quiz_questions ADD CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES exam_module.quizzes(id) ON DELETE CASCADE;

ALTER TABLE exam_module.quizzes ADD CONSTRAINT quizzes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users_module.users(id) ON DELETE SET NULL;

ALTER TABLE exam_module.reading_passages ADD CONSTRAINT reading_passages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES exam_module.teacher_reading_passages(id) ON DELETE SET NULL;

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_source_bank_id_fkey FOREIGN KEY (source_bank_id) REFERENCES exam_module.question_bank(id) ON DELETE SET NULL;

ALTER TABLE exam_module.teacher_question_bank ADD CONSTRAINT teacher_question_bank_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE exam_module.teacher_reading_passages ADD CONSTRAINT teacher_reading_passages_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_folder_sets ADD CONSTRAINT flashcard_folder_sets_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES flashcard_module.flashcard_folders(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_folder_sets ADD CONSTRAINT flashcard_folder_sets_set_id_fkey FOREIGN KEY (set_id) REFERENCES flashcard_module.flashcard_sets(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_folders ADD CONSTRAINT flashcard_folders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_progress ADD CONSTRAINT flashcard_progress_card_id_fkey FOREIGN KEY (card_id) REFERENCES flashcard_module.flashcards(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_progress ADD CONSTRAINT flashcard_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_sets ADD CONSTRAINT flashcard_sets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_tests ADD CONSTRAINT flashcard_tests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcard_tests ADD CONSTRAINT flashcard_tests_set_id_fkey FOREIGN KEY (set_id) REFERENCES flashcard_module.flashcard_sets(id) ON DELETE CASCADE;

ALTER TABLE flashcard_module.flashcards ADD CONSTRAINT flashcards_set_id_fkey FOREIGN KEY (set_id) REFERENCES flashcard_module.flashcard_sets(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.jlpt_bank_groups ADD CONSTRAINT jlpt_bank_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE jlpt_module.jlpt_bank_questions ADD CONSTRAINT jlpt_bank_questions_group_id_fkey FOREIGN KEY (group_id) REFERENCES jlpt_module.jlpt_bank_groups(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_attempt_answers ADD CONSTRAINT mock_attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES jlpt_module.mock_attempts(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_attempt_answers ADD CONSTRAINT mock_attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES jlpt_module.mock_questions(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_attempts ADD CONSTRAINT mock_attempts_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES jlpt_module.mock_exams(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_attempts ADD CONSTRAINT mock_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_exam_sections ADD CONSTRAINT mock_exam_sections_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES jlpt_module.mock_exams(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_exams ADD CONSTRAINT mock_exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE jlpt_module.mock_question_groups ADD CONSTRAINT mock_question_groups_section_id_fkey FOREIGN KEY (section_id) REFERENCES jlpt_module.mock_exam_sections(id) ON DELETE CASCADE;

ALTER TABLE jlpt_module.mock_questions ADD CONSTRAINT mock_questions_group_id_fkey FOREIGN KEY (group_id) REFERENCES jlpt_module.mock_question_groups(id) ON DELETE CASCADE;

ALTER TABLE language_module.grammar_patterns ADD CONSTRAINT fk_gp_creator FOREIGN KEY (created_by) REFERENCES users_module.users(id);

ALTER TABLE language_module.grammar_patterns ADD CONSTRAINT fk_gp_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE language_module.grammar_set_items ADD CONSTRAINT fk_gsi_pattern FOREIGN KEY (pattern_id) REFERENCES language_module.grammar_patterns(id) ON DELETE CASCADE;

ALTER TABLE language_module.grammar_set_items ADD CONSTRAINT fk_gsi_set FOREIGN KEY (set_id) REFERENCES language_module.grammar_sets(id) ON DELETE CASCADE;

ALTER TABLE language_module.grammar_sets ADD CONSTRAINT fk_gs_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE language_module.grammar_sets ADD CONSTRAINT fk_gs_user FOREIGN KEY (created_by) REFERENCES users_module.users(id);

ALTER TABLE language_module.kanji ADD CONSTRAINT fk_kanji_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE language_module.kanji ADD CONSTRAINT kanji_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE language_module.kanji_set_items ADD CONSTRAINT fk_ksi_kanji FOREIGN KEY (kanji_id) REFERENCES language_module.kanji(id) ON DELETE CASCADE;

ALTER TABLE language_module.kanji_set_items ADD CONSTRAINT fk_ksi_set FOREIGN KEY (set_id) REFERENCES language_module.kanji_sets(id) ON DELETE CASCADE;

ALTER TABLE language_module.kanji_sets ADD CONSTRAINT fk_ks_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE language_module.kanji_sets ADD CONSTRAINT fk_ks_topic FOREIGN KEY (topic_id) REFERENCES language_module.topics(id);

ALTER TABLE language_module.kanji_sets ADD CONSTRAINT fk_ks_user FOREIGN KEY (created_by) REFERENCES users_module.users(id);

ALTER TABLE language_module.study_list_items ADD CONSTRAINT study_list_items_post_id_fkey FOREIGN KEY (post_id) REFERENCES language_module.study_list_posts(id) ON DELETE CASCADE;

ALTER TABLE language_module.study_list_posts ADD CONSTRAINT study_list_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES users_module.users(id) ON DELETE CASCADE;

ALTER TABLE language_module.teacher_kanji ADD CONSTRAINT teacher_kanji_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE language_module.teacher_vocabulary ADD CONSTRAINT teacher_vocabulary_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE language_module.topics ADD CONSTRAINT fk_topics_parent FOREIGN KEY (parent_id) REFERENCES language_module.topics(id);

ALTER TABLE language_module.vocabulary ADD CONSTRAINT fk_vocab_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE language_module.vocabulary ADD CONSTRAINT vocabulary_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE language_module.vocabulary_set_items ADD CONSTRAINT fk_vsi_set FOREIGN KEY (set_id) REFERENCES language_module.vocabulary_sets(id) ON DELETE CASCADE;

ALTER TABLE language_module.vocabulary_set_items ADD CONSTRAINT fk_vsi_vocab FOREIGN KEY (vocabulary_id) REFERENCES language_module.vocabulary(id) ON DELETE CASCADE;

ALTER TABLE language_module.vocabulary_sets ADD CONSTRAINT fk_vs_jlpt FOREIGN KEY (jlpt_level_id) REFERENCES language_module.jlpt_levels(id);

ALTER TABLE language_module.vocabulary_sets ADD CONSTRAINT fk_vs_user FOREIGN KEY (created_by) REFERENCES users_module.users(id);

ALTER TABLE language_module.vocabulary_topics ADD CONSTRAINT fk_vt_topic FOREIGN KEY (topic_id) REFERENCES language_module.topics(id) ON DELETE CASCADE;

ALTER TABLE language_module.vocabulary_topics ADD CONSTRAINT fk_vt_vocab FOREIGN KEY (vocabulary_id) REFERENCES language_module.vocabulary(id) ON DELETE CASCADE;

ALTER TABLE practice_module.article_reads ADD CONSTRAINT news_article_reads_article_id_fkey FOREIGN KEY (article_id) REFERENCES practice_module.articles(id) ON DELETE CASCADE;

ALTER TABLE practice_module.article_reads ADD CONSTRAINT news_article_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE practice_module.articles ADD CONSTRAINT news_articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE practice_module.listening_dialogue_lines ADD CONSTRAINT listening_dialogue_lines_dialogue_id_fkey FOREIGN KEY (dialogue_id) REFERENCES practice_module.listening_dialogues(id) ON DELETE CASCADE;

ALTER TABLE practice_module.pronunciation_assessments ADD CONSTRAINT fk_pa_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id);

ALTER TABLE practice_module.pronunciation_assessments ADD CONSTRAINT fk_pa_student FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE practice_module.reading_sets ADD CONSTRAINT reading_sets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE practice_module.rs_drafts ADD CONSTRAINT rs_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE practice_module.rs_drafts ADD CONSTRAINT rs_drafts_reading_set_id_fkey FOREIGN KEY (reading_set_id) REFERENCES practice_module.reading_sets(id) ON DELETE CASCADE;

ALTER TABLE practice_module.rs_options ADD CONSTRAINT rs_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES practice_module.rs_questions(id) ON DELETE CASCADE;

ALTER TABLE practice_module.rs_passages ADD CONSTRAINT rs_passages_reading_set_id_fkey FOREIGN KEY (reading_set_id) REFERENCES practice_module.reading_sets(id) ON DELETE CASCADE;

ALTER TABLE practice_module.rs_questions ADD CONSTRAINT rs_questions_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES practice_module.rs_passages(id) ON DELETE CASCADE;

ALTER TABLE practice_module.rs_questions ADD CONSTRAINT rs_questions_reading_set_id_fkey FOREIGN KEY (reading_set_id) REFERENCES practice_module.reading_sets(id) ON DELETE CASCADE;

ALTER TABLE practice_module.writing_submissions ADD CONSTRAINT fk_ws_lesson FOREIGN KEY (lesson_id) REFERENCES course_module.lessons(id);

ALTER TABLE practice_module.writing_submissions ADD CONSTRAINT fk_ws_reviewer FOREIGN KEY (reviewed_by) REFERENCES users_module.users(id);

ALTER TABLE practice_module.writing_submissions ADD CONSTRAINT fk_ws_student FOREIGN KEY (student_id) REFERENCES users_module.users(id);

ALTER TABLE users_module.student_profiles ADD CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users_module.users(id) ON DELETE CASCADE;

ALTER TABLE users_module.teacher_applications ADD CONSTRAINT teacher_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE users_module.teacher_profiles ADD CONSTRAINT fk_tp_approved_by FOREIGN KEY (approved_by) REFERENCES users_module.users(id);

ALTER TABLE users_module.teacher_profiles ADD CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users_module.users(id) ON DELETE CASCADE;

ALTER TABLE users_module.user_audit_logs ADD CONSTRAINT fk_ual_admin FOREIGN KEY (admin_id) REFERENCES users_module.users(id);

ALTER TABLE users_module.user_audit_logs ADD CONSTRAINT fk_ual_target FOREIGN KEY (target_id) REFERENCES users_module.users(id);

ALTER TABLE users_module.users ADD CONSTRAINT fk_users_auth FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE users_module.users ADD CONSTRAINT fk_users_roles FOREIGN KEY (role_id) REFERENCES users_module.roles(id);

-- --------------------------------------------------------------------------
-- FUNCTIONS  (Hàm (function/trigger function/RPC))
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION course_module.trg_payment_completed_enroll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.payment_status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'completed') THEN
    INSERT INTO course_module.course_enrollments (course_id, student_id)
    SELECT NEW.course_id, NEW.student_id
    WHERE NOT EXISTS (
      SELECT 1 FROM course_module.course_enrollments e
      WHERE e.course_id = NEW.course_id AND e.student_id = NEW.student_id);
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION course_module.trg_recalc_course_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_course uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_id ELSE NEW.course_id END;
BEGIN
  UPDATE course_module.courses c
  SET avg_rating = COALESCE((
        SELECT round(avg(r.rating)::numeric, 2)
        FROM course_module.course_reviews r
        WHERE r.course_id = v_course), 0)
  WHERE c.id = v_course;

  IF TG_OP = 'UPDATE' AND NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    UPDATE course_module.courses c
    SET avg_rating = COALESCE((
          SELECT round(avg(r.rating)::numeric, 2)
          FROM course_module.course_reviews r
          WHERE r.course_id = OLD.course_id), 0)
    WHERE c.id = OLD.course_id;
  END IF;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION course_module.trg_recalc_enrollment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_course uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_id ELSE NEW.course_id END;
BEGIN
  UPDATE course_module.courses c
  SET enrollment_count = (
        SELECT count(*) FROM course_module.course_enrollments e
        WHERE e.course_id = v_course)
  WHERE c.id = v_course;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION dictionary_module.search_dict_by_meaning(p_query text, p_limit integer, p_offset integer)
 RETURNS TABLE(entry_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  WITH q AS (
    SELECT
      lower(btrim(p_query))                    AS qa,  -- query đúng dấu (lowercase)
      public.f_unaccent(lower(btrim(p_query))) AS qn,  -- query bỏ dấu
      regexp_replace(lower(btrim(p_query)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')                    AS qa_re,
      regexp_replace(public.f_unaccent(lower(btrim(p_query))), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') AS qn_re
  )
  SELECT s.entry_id
  FROM dictionary_module.dict_senses s CROSS JOIN q
  WHERE public.f_unaccent(s.meaning_vi) ~* ('(^|[^a-z])' || q.qn_re || '([^a-z]|$)')
  GROUP BY s.entry_id
  ORDER BY MAX(GREATEST(
    CASE WHEN lower(s.meaning_vi) = q.qa THEN 6
         WHEN public.f_unaccent(lower(s.meaning_vi)) = q.qn THEN 5 ELSE 0 END,
    CASE WHEN ('; ' || lower(s.meaning_vi) || ';') ~ ('[;,/] *' || q.qa_re || ' *[;,/]') THEN 4 ELSE 0 END,
    CASE WHEN s.meaning_vi ILIKE '%' || q.qa || '%' THEN 3 ELSE 0 END,
    CASE WHEN ('; ' || public.f_unaccent(lower(s.meaning_vi)) || ';') ~ ('[;,/] *' || q.qn_re || ' *[;,/]') THEN 2 ELSE 0 END,
    1
  )) DESC, s.entry_id
  OFFSET p_offset LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.courses_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN DELETE FROM course_module.courses WHERE id = OLD.id; RETURN OLD; END $function$
;

CREATE OR REPLACE FUNCTION public.courses_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO course_module.courses (title, title_ja, description, description_ja, thumbnail_url, is_published, created_by, jlpt_level_id)
  VALUES (NEW.title, NEW.title_ja, NEW.description, NEW.description_ja, NEW.thumbnail_url,
          COALESCE(NEW.is_published,false), NEW.created_by,
          (SELECT id FROM language_module.jlpt_levels WHERE name = NEW.level))
  RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.courses_compat_upd()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE course_module.courses SET
    title=NEW.title, title_ja=NEW.title_ja, description=NEW.description, description_ja=NEW.description_ja,
    thumbnail_url=NEW.thumbnail_url, is_published=NEW.is_published,
    jlpt_level_id=(SELECT id FROM language_module.jlpt_levels WHERE name = NEW.level),
    updated_at=now()
  WHERE id = OLD.id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
AS $function$
  SELECT public.unaccent('public.unaccent', $1)
$function$
;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.users
    SET
        email             = NEW.email,
        is_email_verified = (NEW.email_confirmed_at IS NOT NULL),
        -- Sync avatar if user links Google after initial signup
        avatar_url        = COALESCE(
                                public.users.avatar_url,
                                NEW.raw_user_meta_data->>'avatar_url'
                            ),
        updated_at        = NOW()
    WHERE id = NEW.id;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    -- Create app-level user profile
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role_id,
        avatar_url,
        is_email_verified
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',  -- Google OAuth: full name
            NEW.raw_user_meta_data->>'name',        -- fallback field name
            split_part(NEW.email, '@', 1)           -- fallback: use email prefix
        ),
        1,                                          -- default role: student (1)
        NEW.raw_user_meta_data->>'avatar_url',      -- Google OAuth: profile picture
        NEW.email_confirmed_at IS NOT NULL          -- TRUE if already verified (Google)
    )
    ON CONFLICT (id) DO NOTHING;                    -- safe for re-linking same account

    -- Auto-create student profile (empty, filled during onboarding)
    INSERT INTO public.student_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Auto-create dashboard cache row
    INSERT INTO public.student_dashboards (student_id)
    VALUES (NEW.id)
    ON CONFLICT (student_id) DO NOTHING;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO users_module.users (id, full_name, email, role_id, created_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name','User'), NEW.email,
          CASE NEW.raw_user_meta_data->>'role' WHEN 'admin' THEN 3 WHEN 'teacher' THEN 2 ELSE 1 END,
          NEW.created_at)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users_module.student_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO ai_module.student_dashboards (student_id) VALUES (NEW.id) ON CONFLICT (student_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.kanji_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM language_module.kanji WHERE id = OLD.id;
  RETURN OLD;
END $function$
;

CREATE OR REPLACE FUNCTION public.kanji_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO language_module.kanji
    (character, onyomi, kunyomi, meaning_vi, stroke_count, han_viet, lesson_id, jlpt_level_id, created_by, is_public)
  VALUES (NEW.character,
          array_to_string(NEW.reading_on, ', '),
          array_to_string(NEW.reading_kun, ', '),
          NEW.meaning_vi, NEW.stroke_count, NEW.han_viet, NEW.lesson_id,
          (SELECT id FROM language_module.jlpt_levels WHERE name = NEW.level),
          COALESCE(NEW.created_by, NULL), COALESCE(NEW.is_public, true))
  ON CONFLICT ON CONSTRAINT uq_kanji_char DO UPDATE SET
    onyomi=EXCLUDED.onyomi, kunyomi=EXCLUDED.kunyomi, meaning_vi=EXCLUDED.meaning_vi,
    stroke_count=EXCLUDED.stroke_count, han_viet=EXCLUDED.han_viet,
    lesson_id=EXCLUDED.lesson_id, jlpt_level_id=EXCLUDED.jlpt_level_id,
    is_public=EXCLUDED.is_public
  RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.kanji_compat_upd()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE language_module.kanji SET
    character=NEW.character,
    onyomi=array_to_string(NEW.reading_on, ', '),
    kunyomi=array_to_string(NEW.reading_kun, ', '),
    meaning_vi=NEW.meaning_vi, stroke_count=NEW.stroke_count, han_viet=NEW.han_viet,
    lesson_id=NEW.lesson_id,
    jlpt_level_id=(SELECT id FROM language_module.jlpt_levels WHERE name = NEW.level),
    is_public=COALESCE(NEW.is_public, true)
  WHERE id = OLD.id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.lessons_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN DELETE FROM course_module.lessons WHERE id=OLD.id; RETURN OLD; END $function$
;

CREATE OR REPLACE FUNCTION public.lessons_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO course_module.lessons
    (course_id, unit_id, title, title_ja, content_body, content_type, sort_order, duration_minutes, question_count, is_published)
  VALUES (NEW.course_id, COALESCE(NEW.unit_id, NEW.module_id), NEW.title, NEW.title_ja, NEW.content,
          COALESCE(NEW.lesson_type,'reading'), COALESCE(NEW.order_index,0),
          COALESCE(NEW.duration_minutes,0), COALESCE(NEW.question_count,0), COALESCE(NEW.is_published,false))
  RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.lessons_compat_upd()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE course_module.lessons SET
    course_id=NEW.course_id, unit_id=COALESCE(NEW.unit_id, NEW.module_id), title=NEW.title, title_ja=NEW.title_ja,
    content_body=NEW.content, content_type=COALESCE(NEW.lesson_type,content_type),
    sort_order=COALESCE(NEW.order_index,sort_order), duration_minutes=NEW.duration_minutes,
    question_count=NEW.question_count, is_published=NEW.is_published, updated_at=now()
  WHERE id=OLD.id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.teacher_uses(p_period text)
 RETURNS TABLE(teacher_id uuid, uses bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT teacher_id, COUNT(*)::bigint AS uses
  FROM billing_module.content_usage_events
  WHERE period_key = p_period AND teacher_id IS NOT NULL
  GROUP BY teacher_id;
$function$
;

CREATE OR REPLACE FUNCTION public.vip_revenue(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(SUM(amount), 0)::numeric
  FROM billing_module.payment_orders
  WHERE status = 'paid' AND paid_at >= p_start AND paid_at < p_end;
$function$
;

CREATE OR REPLACE FUNCTION public.vocabulary_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM language_module.vocabulary WHERE id = OLD.id;
  RETURN OLD;
END $function$
;

CREATE OR REPLACE FUNCTION public.vocabulary_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO language_module.vocabulary
    (word, reading, romaji, meaning_vi, meaning_en, part_of_speech, example_sentence, image_url, lesson_id, topic, jlpt_level_id, created_by, is_public, han_viet)
  VALUES (COALESCE(NULLIF(NEW.kanji, ''), NEW.reading), NEW.reading, NEW.romaji, NEW.meaning_vi, NEW.meaning_ja, NEW.type,
          NEW.example_sentence, NEW.image_url, NEW.lesson_id, NEW.topic,
          (SELECT id FROM language_module.jlpt_levels WHERE name = NEW.level),
          COALESCE(NEW.created_by, NULL), COALESCE(NEW.is_public, true), NEW.han_viet)
  RETURNING id INTO new_id;
  NEW.id := new_id;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.vocabulary_compat_upd()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE language_module.vocabulary SET
    word=COALESCE(NULLIF(NEW.kanji, ''), NEW.reading), reading=NEW.reading, romaji=NEW.romaji, meaning_vi=NEW.meaning_vi,
    meaning_en=NEW.meaning_ja, part_of_speech=NEW.type, example_sentence=NEW.example_sentence, image_url=NEW.image_url,
    lesson_id=NEW.lesson_id, topic=NEW.topic,
    jlpt_level_id=(SELECT id FROM language_module.jlpt_levels WHERE name = NEW.level),
    is_public=COALESCE(NEW.is_public, true), han_viet=NEW.han_viet
  WHERE id = OLD.id;
  RETURN NEW;
END $function$
;

-- --------------------------------------------------------------------------
-- VIEWS  (View tương thích trong public (mirror bảng ở *_module cho PostgREST))
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.ai_generated_questions AS  SELECT id,
    question_id,
    requested_by,
    generation_prompt,
    generation_params,
    raw_ai_response,
    ai_model,
    created_at
   FROM ai_module.ai_generated_questions;

CREATE OR REPLACE VIEW public.ai_learning_paths AS  SELECT id,
    student_id,
    generated_at,
    is_active,
    path_data,
    ai_model_version,
    rationale_vi,
    strength_skills,
    weakness_skills
   FROM ai_module.ai_learning_paths;

CREATE OR REPLACE VIEW public.course_enrollments AS  SELECT id,
    course_id,
    student_id,
    enrolled_at,
    completed_at,
    progress_pct
   FROM course_module.course_enrollments;

CREATE OR REPLACE VIEW public.courses AS  SELECT c.id,
    c.title,
    c.title_ja,
    c.description,
    c.description_ja,
    jl.name AS level,
    c.thumbnail_url,
    c.is_published,
    c.created_by,
    c.created_at,
    c.updated_at
   FROM course_module.courses c
     LEFT JOIN language_module.jlpt_levels jl ON jl.id = c.jlpt_level_id;

CREATE OR REPLACE VIEW public.dict_entries AS  SELECT id,
    kanji,
    kana,
    romaji,
    jlpt_level,
    is_common,
    source,
    source_id,
    created_at
   FROM dictionary_module.dict_entries;

CREATE OR REPLACE VIEW public.dict_examples AS  SELECT id,
    sense_id,
    sentence_jp,
    sentence_vi,
    created_at,
    furigana
   FROM dictionary_module.dict_examples;

CREATE OR REPLACE VIEW public.dict_kanji AS  SELECT id,
    "character",
    sino_vi,
    meaning_vi,
    reading_on,
    reading_kun,
    created_at
   FROM dictionary_module.dict_kanji;

CREATE OR REPLACE VIEW public.dict_related_words AS  SELECT id,
    entry_id,
    related_id,
    relation_type,
    created_at
   FROM dictionary_module.dict_related_words;

CREATE OR REPLACE VIEW public.dict_senses AS  SELECT id,
    entry_id,
    pos,
    meaning_vi,
    order_index,
    created_at
   FROM dictionary_module.dict_senses;

CREATE OR REPLACE VIEW public.flashcard_folder_sets AS  SELECT folder_id,
    set_id,
    added_at
   FROM flashcard_module.flashcard_folder_sets;

CREATE OR REPLACE VIEW public.flashcard_folders AS  SELECT id,
    owner_id,
    name,
    created_at,
    updated_at
   FROM flashcard_module.flashcard_folders;

CREATE OR REPLACE VIEW public.flashcard_progress AS  SELECT student_id,
    card_id,
    status,
    last_reviewed_at
   FROM flashcard_module.flashcard_progress;

CREATE OR REPLACE VIEW public.flashcard_sets AS  SELECT id,
    owner_id,
    title,
    description,
    created_at,
    updated_at
   FROM flashcard_module.flashcard_sets;

CREATE OR REPLACE VIEW public.flashcards AS  SELECT id,
    set_id,
    term,
    definition,
    order_index,
    created_at
   FROM flashcard_module.flashcards;

CREATE OR REPLACE VIEW public.grammar_patterns AS  SELECT id,
    pattern,
    structure,
    meaning_vi,
    meaning_en,
    jlpt_level_id,
    usage_notes,
    example_sentences,
    related_patterns,
    created_by,
    created_at,
    updated_at,
    is_public
   FROM language_module.grammar_patterns;

CREATE OR REPLACE VIEW public.grammar_set_items AS  SELECT set_id,
    pattern_id,
    sort_order
   FROM language_module.grammar_set_items;

CREATE OR REPLACE VIEW public.grammar_sets AS  SELECT id,
    name,
    description,
    created_by,
    jlpt_level_id,
    is_public,
    created_at,
    view_count
   FROM language_module.grammar_sets;

CREATE OR REPLACE VIEW public.jlpt_levels AS  SELECT id,
    name,
    description
   FROM language_module.jlpt_levels;

CREATE OR REPLACE VIEW public.kanji AS  SELECT k.id,
    k."character",
    string_to_array(k.onyomi::text, ', '::text) AS reading_on,
    string_to_array(k.kunyomi::text, ', '::text) AS reading_kun,
    k.meaning_vi,
    k.stroke_count,
    k.han_viet,
    k.lesson_id,
    jl.name AS level,
    k.created_at,
    k.created_by,
    k.is_public
   FROM language_module.kanji k
     LEFT JOIN language_module.jlpt_levels jl ON jl.id = k.jlpt_level_id;

CREATE OR REPLACE VIEW public.kanji_set_items AS  SELECT set_id,
    kanji_id,
    sort_order
   FROM language_module.kanji_set_items;

CREATE OR REPLACE VIEW public.kanji_sets AS  SELECT id,
    name,
    description,
    created_by,
    jlpt_level_id,
    topic_id,
    is_public,
    created_at,
    view_count
   FROM language_module.kanji_sets;

CREATE OR REPLACE VIEW public.kanji_writing_sheets AS  SELECT id,
    student_id,
    kanji_set_id,
    jlpt_level_id,
    kanji_ids,
    file_url,
    generated_at
   FROM ai_module.kanji_writing_sheets;

CREATE OR REPLACE VIEW public.lesson_grammar AS  SELECT lesson_id,
    pattern_id
   FROM course_module.lesson_grammar;

CREATE OR REPLACE VIEW public.lesson_kanji AS  SELECT lesson_id,
    kanji_id
   FROM course_module.lesson_kanji;

CREATE OR REPLACE VIEW public.lesson_progress AS  SELECT id,
    student_id,
    lesson_id,
    status,
    progress_pct,
    last_position,
    completed_at,
    time_spent_sec
   FROM course_module.lesson_progress;

CREATE OR REPLACE VIEW public.lesson_vocabulary AS  SELECT lesson_id,
    vocabulary_id
   FROM course_module.lesson_vocabulary;

CREATE OR REPLACE VIEW public.lessons AS  SELECT id,
    course_id,
    unit_id,
    unit_id AS module_id,
    title,
    title_ja,
    content_body AS content,
    content_type AS lesson_type,
    sort_order AS order_index,
    duration_minutes,
    question_count,
    grammar_notes,
    content_url,
    transcript,
    is_published,
    created_by,
    created_at,
    updated_at
   FROM course_module.lessons l;

CREATE OR REPLACE VIEW public.listening_passages AS  SELECT id,
    title,
    audio_url,
    transcript,
    description,
    level,
    topic,
    source,
    duration_sec,
    created_by,
    created_at,
    updated_at,
    transcript_segments,
    transcript_language,
    image_url
   FROM exam_module.listening_passages;

CREATE OR REPLACE VIEW public.notifications AS  SELECT id,
    recipient_id,
    sender_id,
    type,
    title,
    body,
    metadata,
    is_read,
    read_at,
    created_at
   FROM ai_module.notifications;

CREATE OR REPLACE VIEW public.pronunciation_assessments AS  SELECT id,
    student_id,
    lesson_id,
    listening_material_id,
    question_id,
    target_text,
    target_reading,
    audio_url,
    ai_overall_score,
    ai_fluency_score,
    ai_feedback_vi,
    ai_model_version,
    assessed_at
   FROM practice_module.pronunciation_assessments;

CREATE OR REPLACE VIEW public.question_bank AS  SELECT id,
    question_text,
    options,
    correct_answer,
    explanation,
    level,
    skill,
    topic,
    difficulty,
    status,
    is_ai_generated,
    created_by,
    created_at,
    question_type,
    passage_id,
    listening_passage_id
   FROM exam_module.question_bank;

CREATE OR REPLACE VIEW public.quiz_attempts AS  SELECT id,
    quiz_id,
    user_id,
    score,
    total_questions,
    answers,
    completed_at,
    mode,
    violation_count,
    proctor_events,
    snapshots,
    assignment_id,
    attempt_number,
    status,
    manual_score,
    feedback,
    graded_by,
    graded_at
   FROM exam_module.quiz_attempts;

CREATE OR REPLACE VIEW public.quiz_questions AS  SELECT id,
    quiz_id,
    question,
    options,
    correct_answer,
    explanation,
    order_index,
    created_at,
    question_type,
    bank_question_id,
    correct_answer_data
   FROM exam_module.quiz_questions;

CREATE OR REPLACE VIEW public.quizzes AS  SELECT id,
    title,
    title_ja,
    description,
    course_id,
    lesson_id,
    type,
    time_limit,
    is_published,
    created_at,
    mode,
    teacher_id,
    is_exam
   FROM exam_module.quizzes;

CREATE OR REPLACE VIEW public.reading_passages AS  SELECT id,
    title,
    content,
    level,
    topic,
    source,
    created_by,
    created_at,
    image_url
   FROM exam_module.reading_passages;

CREATE OR REPLACE VIEW public.roles AS  SELECT id,
    name,
    description
   FROM users_module.roles;

CREATE OR REPLACE VIEW public.skills AS  SELECT id,
    name,
    name_vi
   FROM course_module.skills;

CREATE OR REPLACE VIEW public.student_dashboards AS  SELECT student_id,
    total_study_days,
    total_study_minutes,
    total_vocab_learned,
    total_kanji_learned,
    total_grammar_learned,
    total_exams_taken,
    avg_exam_score,
    current_streak,
    longest_streak,
    skill_scores,
    last_updated_at
   FROM ai_module.student_dashboards;

CREATE OR REPLACE VIEW public.student_profiles AS  SELECT user_id,
    jlpt_target_level,
    current_level,
    native_language,
    study_goal,
    daily_study_minutes,
    streak_days,
    last_study_date,
    onboarding_done,
    created_at
   FROM users_module.student_profiles;

CREATE OR REPLACE VIEW public.teacher_profiles AS  SELECT user_id,
    bio,
    qualifications,
    approval_status,
    approved_by,
    approved_at,
    created_at
   FROM users_module.teacher_profiles;

CREATE OR REPLACE VIEW public.teacher_question_bank AS  SELECT id,
    teacher_id,
    question_text,
    options,
    correct_answer,
    explanation,
    level,
    skill,
    topic,
    difficulty,
    status,
    is_ai_generated,
    question_type,
    passage_id,
    source_bank_id,
    created_at
   FROM exam_module.teacher_question_bank;

CREATE OR REPLACE VIEW public.teacher_reading_passages AS  SELECT id,
    teacher_id,
    title,
    content,
    image_url,
    level,
    topic,
    source,
    created_at
   FROM exam_module.teacher_reading_passages;

CREATE OR REPLACE VIEW public.topics AS  SELECT id,
    name_vi,
    name_en,
    name_ja,
    icon_url,
    parent_id
   FROM language_module.topics;

CREATE OR REPLACE VIEW public.user_audit_logs AS  SELECT id,
    admin_id,
    target_id,
    action,
    old_value,
    new_value,
    reason,
    created_at
   FROM users_module.user_audit_logs;

CREATE OR REPLACE VIEW public.users AS  SELECT id,
    full_name,
    email,
    phone,
    avatar_url,
    date_of_birth,
    created_at,
    updated_at,
    is_email_verified
   FROM users_module.users;

CREATE OR REPLACE VIEW public.vocabulary AS  SELECT v.id,
    NULLIF(v.word::text, v.reading::text)::character varying(100) AS kanji,
    v.reading,
    v.romaji,
    v.meaning_vi,
    v.meaning_en AS meaning_ja,
    v.part_of_speech AS type,
    v.topic,
    v.example_sentence,
    v.lesson_id,
    jl.name AS level,
    v.created_at,
    v.created_by,
    v.is_public,
    v.image_url,
    v.han_viet
   FROM language_module.vocabulary v
     LEFT JOIN language_module.jlpt_levels jl ON jl.id = v.jlpt_level_id;

CREATE OR REPLACE VIEW public.vocabulary_set_items AS  SELECT set_id,
    vocabulary_id,
    sort_order
   FROM language_module.vocabulary_set_items;

CREATE OR REPLACE VIEW public.vocabulary_sets AS  SELECT id,
    name,
    description,
    created_by,
    jlpt_level_id,
    is_public,
    created_at,
    view_count
   FROM language_module.vocabulary_sets;

CREATE OR REPLACE VIEW public.vocabulary_topics AS  SELECT vocabulary_id,
    topic_id
   FROM language_module.vocabulary_topics;

CREATE OR REPLACE VIEW public.vw_student_course_access AS  SELECT ce.student_id,
    ce.course_id,
    c.title AS course_title,
    c.jlpt_level_id,
    ce.enrolled_at,
    ce.progress_pct,
    ce.completed_at,
    u.full_name AS student_name
   FROM course_module.course_enrollments ce
     JOIN course_module.courses c ON c.id = ce.course_id AND c.deleted_at IS NULL
     JOIN users_module.users u ON u.id = ce.student_id;

CREATE OR REPLACE VIEW public.vw_system_analytics AS  SELECT r.name AS role_name,
    count(u.id) AS total_users,
    sum(
        CASE
            WHEN u.is_active = true THEN 1
            ELSE 0
        END) AS active_users,
    sum(
        CASE
            WHEN u.is_email_verified = true THEN 1
            ELSE 0
        END) AS verified_users
   FROM users_module.users u
     JOIN users_module.roles r ON r.id = u.role_id
  GROUP BY r.name;

CREATE OR REPLACE VIEW public.writing_submissions AS  SELECT id,
    student_id,
    question_id,
    attempt_id,
    lesson_id,
    reading_material_id,
    submission_text,
    ai_score,
    ai_grammar_score,
    ai_vocabulary_score,
    ai_coherence_score,
    ai_feedback_vi,
    ai_corrected_text,
    ai_model_version,
    teacher_score,
    teacher_feedback,
    teacher_corrected_text,
    reviewed_by,
    reviewed_at,
    submitted_at
   FROM practice_module.writing_submissions;

-- --------------------------------------------------------------------------
-- TRIGGERS  (Trigger)
-- --------------------------------------------------------------------------

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_auth_user_updated AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_auth_user_updated();

CREATE TRIGGER trg_payments_enroll AFTER INSERT OR UPDATE OF payment_status ON billing_module.payments FOR EACH ROW EXECUTE FUNCTION course_module.trg_payment_completed_enroll();

CREATE TRIGGER trg_course_enrollments_count AFTER INSERT OR DELETE ON course_module.course_enrollments FOR EACH ROW EXECUTE FUNCTION course_module.trg_recalc_enrollment_count();

CREATE TRIGGER trg_course_reviews_rating AFTER INSERT OR DELETE OR UPDATE ON course_module.course_reviews FOR EACH ROW EXECUTE FUNCTION course_module.trg_recalc_course_rating();

CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON course_module.courses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON course_module.lessons FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_grammar_patterns_updated BEFORE UPDATE ON language_module.grammar_patterns FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER courses_del INSTEAD OF DELETE ON public.courses FOR EACH ROW EXECUTE FUNCTION courses_compat_del();

CREATE TRIGGER courses_ins INSTEAD OF INSERT ON public.courses FOR EACH ROW EXECUTE FUNCTION courses_compat_ins();

CREATE TRIGGER courses_upd INSTEAD OF UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION courses_compat_upd();

CREATE TRIGGER kanji_del INSTEAD OF DELETE ON public.kanji FOR EACH ROW EXECUTE FUNCTION kanji_compat_del();

CREATE TRIGGER kanji_ins INSTEAD OF INSERT ON public.kanji FOR EACH ROW EXECUTE FUNCTION kanji_compat_ins();

CREATE TRIGGER kanji_upd INSTEAD OF UPDATE ON public.kanji FOR EACH ROW EXECUTE FUNCTION kanji_compat_upd();

CREATE TRIGGER vocabulary_del INSTEAD OF DELETE ON public.vocabulary FOR EACH ROW EXECUTE FUNCTION vocabulary_compat_del();

CREATE TRIGGER vocabulary_ins INSTEAD OF INSERT ON public.vocabulary FOR EACH ROW EXECUTE FUNCTION vocabulary_compat_ins();

CREATE TRIGGER vocabulary_upd INSTEAD OF UPDATE ON public.vocabulary FOR EACH ROW EXECUTE FUNCTION vocabulary_compat_upd();

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users_module.users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- --------------------------------------------------------------------------
-- INDEXES  (Chỉ mục)
-- --------------------------------------------------------------------------

CREATE INDEX chat_messages_session_id_idx ON ai_module.chat_messages USING btree (session_id, created_at);

CREATE INDEX chat_sessions_user_id_idx ON ai_module.chat_sessions USING btree (user_id, updated_at DESC);

CREATE INDEX idx_lp_steps_path ON ai_module.learning_path_steps USING btree (path_id, order_index);

CREATE INDEX ix_alp_active ON ai_module.ai_learning_paths USING btree (student_id, is_active);

CREATE INDEX ix_kws_student ON ai_module.kanji_writing_sheets USING btree (student_id, generated_at DESC);

CREATE INDEX ix_notif_recip ON ai_module.notifications USING btree (recipient_id, is_read, created_at DESC);

CREATE UNIQUE INDEX uniq_learning_path_active ON ai_module.learning_paths USING btree (user_id) WHERE (status = 'active'::text);

CREATE INDEX feature_usage_counters_user_feature_idx ON billing_module.feature_usage_counters USING btree (user_id, feature_code);

CREATE INDEX idx_course_payment_orders_status ON billing_module.course_payment_orders USING btree (status);

CREATE INDEX idx_course_payment_orders_student ON billing_module.course_payment_orders USING btree (student_id);

CREATE INDEX idx_teacher_payouts_teacher ON billing_module.teacher_payouts USING btree (teacher_id, period_key);

CREATE INDEX idx_usage_teacher_period ON billing_module.content_usage_events USING btree (teacher_id, period_key);

CREATE INDEX payment_orders_payment_code_idx ON billing_module.payment_orders USING btree (payment_code);

CREATE INDEX payment_orders_status_idx ON billing_module.payment_orders USING btree (status);

CREATE INDEX payment_orders_user_id_idx ON billing_module.payment_orders USING btree (user_id);

CREATE INDEX payment_transactions_matched_order_idx ON billing_module.payment_transactions USING btree (matched_order_id);

CREATE UNIQUE INDEX uniq_usage_day ON billing_module.content_usage_events USING btree (student_id, content_type, content_id, day_key);

CREATE UNIQUE INDEX user_subscriptions_user_id_active_uq ON billing_module.user_subscriptions USING btree (user_id) WHERE (status = ANY (ARRAY['active'::text, 'grace_period'::text]));

CREATE INDEX idx_course_reviews_course ON course_module.course_reviews USING btree (course_id);

CREATE INDEX idx_course_reviews_student ON course_module.course_reviews USING btree (student_id);

CREATE INDEX idx_courses_creator_free ON course_module.courses USING btree (creator_type, is_free);

CREATE INDEX idx_courses_difficulty ON course_module.courses USING btree (difficulty_level);

CREATE INDEX idx_lessons_reading_article ON course_module.lessons USING btree (reading_article_id) WHERE (reading_article_id IS NOT NULL);

CREATE INDEX ix_ce_student ON course_module.course_enrollments USING btree (student_id, course_id);

CREATE INDEX ix_lessons_course ON course_module.lessons USING btree (course_id, sort_order);

CREATE INDEX ix_lessons_skill ON course_module.lessons USING btree (skill_id);

CREATE INDEX ix_lp_student ON course_module.lesson_progress USING btree (student_id, status);

CREATE INDEX units_course_idx ON course_module.units USING btree (course_id, sort_order);

CREATE INDEX idx_dict_entries_jlpt ON dictionary_module.dict_entries USING btree (jlpt_level);

CREATE INDEX idx_dict_entries_kana ON dictionary_module.dict_entries USING gin (kana gin_trgm_ops);

CREATE INDEX idx_dict_entries_kanji ON dictionary_module.dict_entries USING gin (kanji gin_trgm_ops);

CREATE INDEX idx_dict_entries_romaji ON dictionary_module.dict_entries USING gin (romaji gin_trgm_ops);

CREATE INDEX idx_dict_examples_sense ON dictionary_module.dict_examples USING btree (sense_id);

CREATE INDEX idx_dict_kanji_character ON dictionary_module.dict_kanji USING btree ("character");

CREATE INDEX idx_dict_related_entry ON dictionary_module.dict_related_words USING btree (entry_id);

CREATE INDEX idx_dict_senses_entry ON dictionary_module.dict_senses USING btree (entry_id);

CREATE INDEX idx_dict_senses_meaning ON dictionary_module.dict_senses USING gin (f_unaccent(meaning_vi) gin_trgm_ops);

CREATE INDEX idx_qb_difficulty ON exam_module.question_bank USING btree (difficulty);

CREATE INDEX idx_qb_level ON exam_module.question_bank USING btree (level);

CREATE INDEX idx_qb_skill ON exam_module.question_bank USING btree (skill);

CREATE INDEX idx_qb_status ON exam_module.question_bank USING btree (status);

CREATE INDEX idx_question_bank_passage ON exam_module.question_bank USING btree (passage_id);

CREATE INDEX idx_question_bank_type ON exam_module.question_bank USING btree (question_type);

CREATE INDEX idx_quiz_questions_bank ON exam_module.quiz_questions USING btree (bank_question_id);

CREATE INDEX idx_reading_passages_level ON exam_module.reading_passages USING btree (level);

CREATE INDEX idx_teacher_question_bank_teacher ON exam_module.teacher_question_bank USING btree (teacher_id);

CREATE INDEX idx_teacher_reading_passages_teacher ON exam_module.teacher_reading_passages USING btree (teacher_id);

CREATE INDEX idx_flashcard_folder_sets_set ON flashcard_module.flashcard_folder_sets USING btree (set_id);

CREATE INDEX idx_flashcard_progress_stu ON flashcard_module.flashcard_progress USING btree (student_id);

CREATE INDEX idx_flashcards_set ON flashcard_module.flashcards USING btree (set_id, order_index);

CREATE INDEX idx_jlpt_bank_groups_lt ON jlpt_module.jlpt_bank_groups USING btree (level, mondai_type, created_at DESC);

CREATE INDEX idx_jlpt_bank_questions_grp ON jlpt_module.jlpt_bank_questions USING btree (group_id);

CREATE INDEX idx_jlpt_bank_questions_lt ON jlpt_module.jlpt_bank_questions USING btree (level, mondai_type, created_at DESC);

CREATE INDEX idx_mock_attempts_board ON jlpt_module.mock_attempts USING btree (exam_id, total_score DESC, duration_seconds) WHERE ((status = 'submitted'::text) AND (attempt_number = 1));

CREATE INDEX idx_mock_attempts_user ON jlpt_module.mock_attempts USING btree (user_id, exam_id, started_at);

CREATE INDEX idx_mock_exams_pub ON jlpt_module.mock_exams USING btree (is_published, level);

CREATE INDEX idx_mock_groups_bank_gid ON jlpt_module.mock_question_groups USING btree (bank_group_id) WHERE (bank_group_id IS NOT NULL);

CREATE INDEX idx_mock_groups_section ON jlpt_module.mock_question_groups USING btree (section_id, "position");

CREATE INDEX idx_mock_questions_bank_qid ON jlpt_module.mock_questions USING btree (bank_question_id) WHERE (bank_question_id IS NOT NULL);

CREATE INDEX idx_mock_questions_group ON jlpt_module.mock_questions USING btree (group_id, "position");

CREATE INDEX idx_mock_sections_exam ON jlpt_module.mock_exam_sections USING btree (exam_id, "position");

CREATE UNIQUE INDEX uniq_mock_attempt_inprogress ON jlpt_module.mock_attempts USING btree (exam_id, user_id) WHERE (status = 'in_progress'::text);

CREATE INDEX idx_grammar_points_level ON language_module.grammar_points USING btree (level);

CREATE INDEX idx_study_list_items_item ON language_module.study_list_items USING btree (item_id);

CREATE INDEX idx_study_list_items_post ON language_module.study_list_items USING btree (post_id);

CREATE INDEX idx_study_list_posts_created_by ON language_module.study_list_posts USING btree (created_by);

CREATE INDEX idx_study_list_posts_is_locked ON language_module.study_list_posts USING btree (is_locked);

CREATE INDEX idx_study_list_posts_type_created ON language_module.study_list_posts USING btree (list_type, created_at DESC);

CREATE INDEX idx_study_list_posts_type_level ON language_module.study_list_posts USING btree (list_type, level);

CREATE INDEX idx_study_list_posts_type_topic ON language_module.study_list_posts USING btree (list_type, topic);

CREATE INDEX idx_study_list_posts_type_views ON language_module.study_list_posts USING btree (list_type, view_count DESC);

CREATE INDEX idx_teacher_kanji_teacher_id ON language_module.teacher_kanji USING btree (teacher_id);

CREATE INDEX idx_teacher_vocabulary_teacher_id ON language_module.teacher_vocabulary USING btree (teacher_id);

CREATE INDEX ix_gp_jlpt ON language_module.grammar_patterns USING btree (jlpt_level_id);

CREATE INDEX ix_kanji_jlpt ON language_module.kanji USING btree (jlpt_level_id);

CREATE INDEX ix_vocab_jlpt ON language_module.vocabulary USING btree (jlpt_level_id);

CREATE INDEX ix_vocab_word ON language_module.vocabulary USING btree (word);

CREATE INDEX idx_listening_dialogue_lines_dialogue ON practice_module.listening_dialogue_lines USING btree (dialogue_id);

CREATE INDEX idx_listening_user_audios_owner ON practice_module.listening_user_audios USING btree (student_id, created_at DESC);

CREATE INDEX idx_listening_user_audios_public ON practice_module.listening_user_audios USING btree (is_public, level);

CREATE INDEX idx_listening_user_audios_student ON practice_module.listening_user_audios USING btree (student_id);

CREATE INDEX idx_news_articles_published ON practice_module.articles USING btree (is_published, level, created_at DESC);

CREATE INDEX idx_news_reads_user_date ON practice_module.article_reads USING btree (user_id, read_date);

CREATE INDEX idx_reading_sets_status ON practice_module.reading_sets USING btree (status, jlpt_level);

CREATE INDEX idx_rs_drafts_set ON practice_module.rs_drafts USING btree (reading_set_id, created_at DESC);

CREATE INDEX idx_rs_options_q ON practice_module.rs_options USING btree (question_id, sort_order);

CREATE INDEX idx_rs_passages_set ON practice_module.rs_passages USING btree (reading_set_id, sort_order);

CREATE INDEX idx_rs_questions_pass ON practice_module.rs_questions USING btree (passage_id, sort_order);

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);

CREATE INDEX idx_teacher_app_status ON users_module.teacher_applications USING btree (status, updated_at DESC);

CREATE INDEX ix_ual_admin ON users_module.user_audit_logs USING btree (admin_id, created_at DESC);

CREATE INDEX ix_ual_target ON users_module.user_audit_logs USING btree (target_id, created_at DESC);

CREATE INDEX ix_users_active ON users_module.users USING btree (is_active) WHERE (is_active = true);

CREATE INDEX ix_users_role ON users_module.users USING btree (role_id);

CREATE UNIQUE INDEX uniq_teacher_app_pending ON users_module.teacher_applications USING btree (user_id) WHERE (status = 'pending'::text);

-- --------------------------------------------------------------------------
-- ROW LEVEL SECURITY  (Bật Row Level Security)
-- --------------------------------------------------------------------------

ALTER TABLE ai_module.ai_generated_questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.ai_learning_paths ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.chat_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.chat_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.kanji_writing_sheets ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.learning_path_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.learning_paths ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_module.student_dashboards ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.content_usage_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.course_payment_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.feature_entitlements ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.feature_usage_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.payment_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.payment_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.revenue_pool_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.subscription_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.teacher_payouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_module.user_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.course_enrollments ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.course_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.courses ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.lesson_grammar ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.lesson_grammar_points ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.lesson_kanji ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.lesson_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.lesson_vocabulary ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.lessons ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.skills ENABLE ROW LEVEL SECURITY;

ALTER TABLE course_module.units ENABLE ROW LEVEL SECURITY;

ALTER TABLE dictionary_module.dict_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE dictionary_module.dict_examples ENABLE ROW LEVEL SECURITY;

ALTER TABLE dictionary_module.dict_kanji ENABLE ROW LEVEL SECURITY;

ALTER TABLE dictionary_module.dict_related_words ENABLE ROW LEVEL SECURITY;

ALTER TABLE dictionary_module.dict_senses ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.listening_passages ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.question_bank ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.quiz_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.quiz_lockouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.quiz_questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.quizzes ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.reading_passages ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.teacher_question_bank ENABLE ROW LEVEL SECURITY;

ALTER TABLE exam_module.teacher_reading_passages ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcard_module.flashcard_folder_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcard_module.flashcard_folders ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcard_module.flashcard_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcard_module.flashcard_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcard_module.flashcard_tests ENABLE ROW LEVEL SECURITY;

ALTER TABLE flashcard_module.flashcards ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.jlpt_bank_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.jlpt_bank_questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.mock_attempt_answers ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.mock_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.mock_exam_sections ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.mock_exams ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.mock_question_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE jlpt_module.mock_questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.grammar_patterns ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.grammar_points ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.grammar_set_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.grammar_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.jlpt_levels ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.kanji ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.kanji_set_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.kanji_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.study_list_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.study_list_posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.teacher_kanji ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.teacher_vocabulary ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.topics ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.vocabulary ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.vocabulary_set_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.vocabulary_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE language_module.vocabulary_topics ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.article_reads ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.articles ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.listening_dialogue_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.listening_dialogues ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.listening_user_audios ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.pronunciation_assessments ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.reading_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.rs_drafts ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.rs_options ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.rs_passages ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.rs_questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE practice_module.writing_submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;

ALTER TABLE users_module.roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE users_module.student_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE users_module.teacher_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE users_module.teacher_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE users_module.user_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE users_module.users ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- RLS POLICIES  (Policy phân quyền theo dòng)
-- --------------------------------------------------------------------------

CREATE POLICY users_own_messages ON ai_module.chat_messages AS PERMISSIVE FOR ALL TO public USING ((session_id IN ( SELECT chat_sessions.id
   FROM ai_module.chat_sessions
  WHERE (chat_sessions.user_id = auth.uid()))));

CREATE POLICY users_own_sessions ON ai_module.chat_sessions AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY lps_read_own ON ai_module.learning_path_steps AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM ai_module.learning_paths p
  WHERE ((p.id = learning_path_steps.path_id) AND (p.user_id = auth.uid())))));

CREATE POLICY lp_read_own ON ai_module.learning_paths AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "course_payment_orders: read own" ON billing_module.course_payment_orders AS PERMISSIVE FOR SELECT TO authenticated USING ((student_id = auth.uid()));

CREATE POLICY "payments: read own" ON billing_module.payments AS PERMISSIVE FOR SELECT TO authenticated USING ((student_id = auth.uid()));

CREATE POLICY "course_reviews: delete own" ON course_module.course_reviews AS PERMISSIVE FOR DELETE TO authenticated USING ((student_id = auth.uid()));

CREATE POLICY "course_reviews: insert own enrolled" ON course_module.course_reviews AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM course_module.course_enrollments e
  WHERE ((e.course_id = course_reviews.course_id) AND (e.student_id = auth.uid()))))));

CREATE POLICY "course_reviews: read all" ON course_module.course_reviews AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "course_reviews: update own" ON course_module.course_reviews AS PERMISSIVE FOR UPDATE TO authenticated USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));

CREATE POLICY "dict_entries: read all" ON dictionary_module.dict_entries AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "dict_examples: read all" ON dictionary_module.dict_examples AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "dict_kanji: read all" ON dictionary_module.dict_kanji AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "dict_related_words: read all" ON dictionary_module.dict_related_words AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "dict_senses: read all" ON dictionary_module.dict_senses AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "listening_passages: admin full access" ON exam_module.listening_passages AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY admin_full_access ON exam_module.question_bank AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "insert own attempts" ON exam_module.quiz_attempts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "read own attempts" ON exam_module.quiz_attempts AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "read quiz questions" ON exam_module.quiz_questions AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "read published quizzes" ON exam_module.quizzes AS PERMISSIVE FOR SELECT TO authenticated USING ((is_published = true));

CREATE POLICY admin_full_access ON exam_module.reading_passages AS PERMISSIVE FOR ALL TO public USING (true);

CREATE POLICY "flashcard_folder_sets: own via folder" ON flashcard_module.flashcard_folder_sets AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM flashcard_module.flashcard_folders f
  WHERE ((f.id = flashcard_folder_sets.folder_id) AND (f.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM flashcard_module.flashcard_folders f
  WHERE ((f.id = flashcard_folder_sets.folder_id) AND (f.owner_id = auth.uid())))));

CREATE POLICY "flashcard_folders: own" ON flashcard_module.flashcard_folders AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "flashcard_progress: own" ON flashcard_module.flashcard_progress AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = student_id)) WITH CHECK ((auth.uid() = student_id));

CREATE POLICY "flashcard_sets: own" ON flashcard_module.flashcard_sets AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "flashcard_tests: own" ON flashcard_module.flashcard_tests AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "flashcards: own via set" ON flashcard_module.flashcards AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM flashcard_module.flashcard_sets s
  WHERE ((s.id = flashcards.set_id) AND (s.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM flashcard_module.flashcard_sets s
  WHERE ((s.id = flashcards.set_id) AND (s.owner_id = auth.uid())))));

CREATE POLICY mock_attempt_answers_read_own ON jlpt_module.mock_attempt_answers AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM jlpt_module.mock_attempts a
  WHERE ((a.id = mock_attempt_answers.attempt_id) AND (a.user_id = auth.uid())))));

CREATE POLICY mock_attempts_read_own ON jlpt_module.mock_attempts AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY mock_sections_read_published ON jlpt_module.mock_exam_sections AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM jlpt_module.mock_exams e
  WHERE ((e.id = mock_exam_sections.exam_id) AND (e.is_published = true)))));

CREATE POLICY mock_exams_read_published ON jlpt_module.mock_exams AS PERMISSIVE FOR SELECT TO public USING ((is_published = true));

CREATE POLICY "grammar_points: read all" ON language_module.grammar_points AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "study_list_items: read all" ON language_module.study_list_items AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "study_list_items: write own post" ON language_module.study_list_items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM language_module.study_list_posts p
  WHERE ((p.id = study_list_items.post_id) AND (p.created_by = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM language_module.study_list_posts p
  WHERE ((p.id = study_list_items.post_id) AND (p.created_by = auth.uid())))));

CREATE POLICY "study_list_posts: delete own" ON language_module.study_list_posts AS PERMISSIVE FOR DELETE TO authenticated USING ((created_by = auth.uid()));

CREATE POLICY "study_list_posts: insert own" ON language_module.study_list_posts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));

CREATE POLICY "study_list_posts: read all" ON language_module.study_list_posts AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "study_list_posts: update own" ON language_module.study_list_posts AS PERMISSIVE FOR UPDATE TO authenticated USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));

CREATE POLICY teacher_kanji_own ON language_module.teacher_kanji AS PERMISSIVE FOR ALL TO public USING ((teacher_id = auth.uid()));

CREATE POLICY teacher_vocab_own ON language_module.teacher_vocabulary AS PERMISSIVE FOR ALL TO public USING ((teacher_id = auth.uid()));

CREATE POLICY "articles: read published" ON practice_module.articles AS PERMISSIVE FOR SELECT TO authenticated USING ((is_published = true));

CREATE POLICY students_read_published ON practice_module.reading_sets AS PERMISSIVE FOR SELECT TO public USING ((status = 'published'::text));

CREATE POLICY students_read_published_options ON practice_module.rs_options AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (practice_module.rs_questions q
     JOIN practice_module.reading_sets rs ON ((rs.id = q.reading_set_id)))
  WHERE ((q.id = rs_options.question_id) AND (rs.status = 'published'::text)))));

CREATE POLICY students_read_published_passages ON practice_module.rs_passages AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM practice_module.reading_sets rs
  WHERE ((rs.id = rs_passages.reading_set_id) AND (rs.status = 'published'::text)))));

CREATE POLICY students_read_published_questions ON practice_module.rs_questions AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM practice_module.reading_sets rs
  WHERE ((rs.id = rs_questions.reading_set_id) AND (rs.status = 'published'::text)))));

CREATE POLICY ta_read_own ON users_module.teacher_applications AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

-- --------------------------------------------------------------------------
-- POSTGREST / ROLE CONFIG  (Cấu hình role authenticator cho PostgREST)
-- --------------------------------------------------------------------------

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, course_module, language_module, users_module, ai_module, practice_module, billing_module, dictionary_module, flashcard_module, exam_module, jlpt_module';

ALTER ROLE authenticator SET search_path = 'public, exam_module, users_module, ai_module, language_module, course_module, flashcard_module, dictionary_module, practice_module, billing_module, jlpt_module';
