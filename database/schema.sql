-- ═══════════════════════════════════════════════════════════════════════════════
-- Sorakara (Kizuna Nihongo) — Full Database Schema
-- Chạy toàn bộ file này trong Supabase SQL Editor trên một project mới.
-- Idempotent: tất cả lệnh dùng IF NOT EXISTS / OR REPLACE — chạy lại an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. USER PROFILE TABLES ───────────────────────────────────────────────────

-- Mirror of auth.users with extra profile fields.
-- Populated by the trigger below; never insert manually.
CREATE TABLE IF NOT EXISTS public.users (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         text,
  email             text,
  phone             text,
  avatar_url        text,
  date_of_birth     date,
  is_email_verified boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_profiles (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  jlpt_target_level   text CHECK (jlpt_target_level IN ('N5','N4','N3','N2','N1')),
  current_level       text CHECK (current_level       IN ('N5','N4','N3','N2','N1')),
  study_goal          text,
  daily_study_minutes integer DEFAULT 30,
  streak_days         integer DEFAULT 0,
  last_study_date     date,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_dashboards (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id            uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak        integer DEFAULT 0,
  longest_streak        integer DEFAULT 0,
  total_vocab_learned   integer DEFAULT 0,
  total_kanji_learned   integer DEFAULT 0,
  total_grammar_learned integer DEFAULT 0,
  total_study_minutes   integer DEFAULT 0,
  total_exams_taken     integer DEFAULT 0,
  avg_exam_score        numeric(5,2) DEFAULT 0,
  skill_scores          jsonb DEFAULT '{"listening":0,"speaking":0,"reading":0,"writing":0}'::jsonb,
  updated_at            timestamptz DEFAULT now()
);


-- ─── 2. TRIGGER: auto-create profile rows on signup ──────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, created_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.student_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.student_dashboards (student_id)
  VALUES (NEW.id)
  ON CONFLICT (student_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ─── 3. CONTENT TABLES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courses (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text NOT NULL,
  title_ja        text,
  description     text,
  description_ja  text,
  level           text CHECK (level IN ('N5','N4','N3','N2','N1','Business')),
  thumbnail_url   text,
  is_published    boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id    uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  title_ja     text,
  content      text,
  order_index  integer DEFAULT 0,
  is_published boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vocabulary (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kanji            text,
  reading          text NOT NULL,
  meaning_vi       text NOT NULL,
  meaning_ja       text,
  level            text CHECK (level IN ('N5','N4','N3','N2','N1')),
  lesson_id        uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  type             text,
  example_sentence text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanji (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  character    text NOT NULL UNIQUE,
  reading_on   text[],
  reading_kun  text[],
  meaning_vi   text NOT NULL,
  stroke_count integer,
  level        text CHECK (level IN ('N5','N4','N3','N2','N1')),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  title_ja     text,
  description  text,
  course_id    uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id    uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  type         text DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice','fill_blank','matching')),
  time_limit   integer,
  is_published boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id        uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question       text NOT NULL,
  options        jsonb,
  correct_answer text NOT NULL,
  explanation    text,
  order_index    integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id         uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  score           integer DEFAULT 0,
  total_questions integer DEFAULT 0,
  answers         jsonb,
  completed_at    timestamptz DEFAULT now()
);


-- ─── 4. ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanji              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts      ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own row
CREATE POLICY "users: read own"   ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users: update own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Student profile: own row only
CREATE POLICY "profiles: read own"   ON public.student_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles: update own" ON public.student_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Dashboard: own row only
CREATE POLICY "dashboards: read own" ON public.student_dashboards FOR SELECT TO authenticated USING (auth.uid() = student_id);

-- Published content readable by all authenticated users
CREATE POLICY "courses: read published"   ON public.courses        FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "lessons: read published"   ON public.lessons        FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "vocabulary: read all"      ON public.vocabulary     FOR SELECT TO authenticated USING (true);
CREATE POLICY "kanji: read all"           ON public.kanji          FOR SELECT TO authenticated USING (true);
CREATE POLICY "quizzes: read published"   ON public.quizzes        FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "questions: read all"       ON public.quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "attempts: read own"        ON public.quiz_attempts  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "attempts: insert own"      ON public.quiz_attempts  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- ─── 5. GRANT admin role ──────────────────────────────────────────────────────
-- Run this manually for your admin account after first login:
--
--   UPDATE auth.users
--   SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
--   WHERE email = 'your-admin@example.com';


-- ─── 6. DICTIONARY TABLES (schema riêng dictionary_module) ────────────────────
-- Kho dữ liệu từ điển Nhật-Việt độc lập (không gắn lesson_id), nạp từ JMdict +
-- KanjiDictVN/KANJIDIC + Tatoeba qua script ở backend/scripts/dictionary-import/.
-- Các bảng nằm trong schema riêng dictionary_module; helper f_unaccent + extension
-- giữ ở public (dùng chung). LƯU Ý: phải thêm 'dictionary_module' vào Exposed schemas
-- (Supabase → Settings → API) để supabase-js .schema('dictionary_module') hoạt động.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS dictionary_module;
GRANT USAGE ON SCHEMA dictionary_module TO anon, authenticated, service_role;

-- Hàm wrapper IMMUTABLE để có thể tạo index trên unaccent(meaning_vi) — giữ ở public
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- Bảng kanji riêng cho từ điển (đầy đủ, có âm Hán Việt) — độc lập với public.kanji
CREATE TABLE IF NOT EXISTS dictionary_module.dict_kanji (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  character    text NOT NULL UNIQUE,
  sino_vi      text,
  meaning_vi   text,
  reading_on   text[],
  reading_kun  text[],
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dictionary_module.dict_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kanji       text,
  kana        text NOT NULL, -- có thể là hiragana hoặc katakana
  romaji      text,
  jlpt_level  text CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
  is_common   boolean DEFAULT false,
  source      text,
  source_id   text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE TABLE IF NOT EXISTS dictionary_module.dict_senses (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id    uuid NOT NULL REFERENCES dictionary_module.dict_entries(id) ON DELETE CASCADE,
  pos         text,
  meaning_vi  text NOT NULL,
  order_index integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (entry_id, order_index)
);

CREATE TABLE IF NOT EXISTS dictionary_module.dict_examples (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sense_id    uuid NOT NULL REFERENCES dictionary_module.dict_senses(id) ON DELETE CASCADE,
  sentence_jp text NOT NULL,
  sentence_vi text,
  furigana    text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (sense_id, sentence_jp)
);

CREATE TABLE IF NOT EXISTS dictionary_module.dict_related_words (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id      uuid NOT NULL REFERENCES dictionary_module.dict_entries(id) ON DELETE CASCADE,
  related_id    uuid NOT NULL REFERENCES dictionary_module.dict_entries(id) ON DELETE CASCADE,
  relation_type text DEFAULT 'related' CHECK (relation_type IN ('related','synonym','antonym')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (entry_id, related_id, relation_type),
  CHECK (entry_id <> related_id)
);

-- Indexes cho search theo kanji/kana/romaji/nghĩa tiếng Việt
CREATE INDEX IF NOT EXISTS idx_dict_kanji_character  ON dictionary_module.dict_kanji (character);
CREATE INDEX IF NOT EXISTS idx_dict_entries_kana     ON dictionary_module.dict_entries USING gin (kana gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_entries_kanji    ON dictionary_module.dict_entries USING gin (kanji gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_entries_romaji   ON dictionary_module.dict_entries USING gin (romaji gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_entries_jlpt     ON dictionary_module.dict_entries (jlpt_level);
CREATE INDEX IF NOT EXISTS idx_dict_senses_entry     ON dictionary_module.dict_senses (entry_id);
CREATE INDEX IF NOT EXISTS idx_dict_senses_meaning   ON dictionary_module.dict_senses USING gin (public.f_unaccent(meaning_vi) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_examples_sense   ON dictionary_module.dict_examples (sense_id);
CREATE INDEX IF NOT EXISTS idx_dict_related_entry    ON dictionary_module.dict_related_words (entry_id);

-- RPC: tìm entry theo nghĩa tiếng Việt — khớp NGUYÊN TỪ (ranh giới từ) + ưu tiên đúng dấu + xếp hạng
CREATE OR REPLACE FUNCTION dictionary_module.search_dict_by_meaning(p_query text, p_limit int, p_offset int)
RETURNS TABLE(entry_id uuid) AS $$
  WITH q AS (
    SELECT
      lower(btrim(p_query))                    AS qa,  -- query đúng dấu (lowercase)
      public.f_unaccent(lower(btrim(p_query))) AS qn,  -- query bỏ dấu
      regexp_replace(lower(btrim(p_query)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')                    AS qa_re,
      regexp_replace(public.f_unaccent(lower(btrim(p_query))), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') AS qn_re
  )
  -- Lọc: nghĩa (đã bỏ dấu) chứa query như một TỪ TRỌN VẸN; dùng f_unaccent(meaning_vi) để khớp index gin trgm
  SELECT s.entry_id
  FROM dictionary_module.dict_senses s CROSS JOIN q
  WHERE public.f_unaccent(s.meaning_vi) ~* ('(^|[^a-z])' || q.qn_re || '([^a-z]|$)')
  GROUP BY s.entry_id
  -- Xếp hạng: trùng khít/mục nghĩa trọn > chứa; ĐÚNG DẤU > không dấu
  ORDER BY MAX(GREATEST(
    CASE WHEN lower(s.meaning_vi) = q.qa THEN 6
         WHEN public.f_unaccent(lower(s.meaning_vi)) = q.qn THEN 5 ELSE 0 END,
    CASE WHEN ('; ' || lower(s.meaning_vi) || ';') ~ ('[;,/] *' || q.qa_re || ' *[;,/]') THEN 4 ELSE 0 END,
    CASE WHEN s.meaning_vi ILIKE '%' || q.qa || '%' THEN 3 ELSE 0 END,
    CASE WHEN ('; ' || public.f_unaccent(lower(s.meaning_vi)) || ';') ~ ('[;,/] *' || q.qn_re || ' *[;,/]') THEN 2 ELSE 0 END,
    1
  )) DESC, s.entry_id
  OFFSET p_offset LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- Cấp quyền cho service_role/anon/authenticated trên toàn bộ bảng + hàm trong schema mới
GRANT ALL ON ALL TABLES    IN SCHEMA dictionary_module TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dictionary_module TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dictionary_module.search_dict_by_meaning(text, int, int) TO anon, authenticated, service_role;

-- RLS: cho phép mọi user đã đăng nhập đọc dữ liệu từ điển; ghi/import qua supabaseAdmin
ALTER TABLE dictionary_module.dict_kanji         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_module.dict_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_module.dict_senses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_module.dict_examples      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_module.dict_related_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dict_kanji: read all"         ON dictionary_module.dict_kanji         FOR SELECT TO authenticated USING (true);
CREATE POLICY "dict_entries: read all"       ON dictionary_module.dict_entries       FOR SELECT TO authenticated USING (true);
CREATE POLICY "dict_senses: read all"        ON dictionary_module.dict_senses        FOR SELECT TO authenticated USING (true);
CREATE POLICY "dict_examples: read all"      ON dictionary_module.dict_examples      FOR SELECT TO authenticated USING (true);
CREATE POLICY "dict_related_words: read all" ON dictionary_module.dict_related_words FOR SELECT TO authenticated USING (true);


-- ─── 7. MATERIALS TABLES (schema riêng materials_module) ──────────────────────
-- Tính năng "Luyện đọc báo" cho student, độc lập với lessons/reading_passages.
-- Bài đọc lưu sẵn furigana (ruby HTML) + bản dịch tiếng Việt theo từng câu trong
-- cột segments (jsonb): [{ jp, furigana, vi }]. AI chỉ chạy 1 lần lúc admin tạo bài;
-- student đọc lấy thẳng từ DB, không gọi AI. LƯU Ý: phải thêm 'materials_module' vào
-- Exposed schemas (Supabase → Settings → API) để supabase-js .schema('materials_module') hoạt động.

CREATE SCHEMA IF NOT EXISTS materials_module;
GRANT USAGE ON SCHEMA materials_module TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS materials_module.news_articles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text NOT NULL,                 -- tiêu đề tiếng Nhật
  title_vi      text,                          -- tiêu đề tiếng Việt (tùy chọn)
  summary_vi    text,                          -- mô tả ngắn cho card danh sách
  level         text CHECK (level IN ('N5','N4','N3','N2','N1')),
  thumbnail_url text,                          -- ảnh card (Supabase Storage)
  source        text,                          -- nguồn (vd "NHK", "Asahi")
  source_url    text,
  content       text,                          -- toàn văn JA thuần (fallback + ngữ cảnh AI)
  segments      jsonb DEFAULT '[]'::jsonb,     -- [{ jp, furigana, vi }] theo câu
  is_published  boolean DEFAULT false,         -- chỉ bài published mới hiện cho student
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_articles_published
  ON materials_module.news_articles (is_published, level, created_at DESC);

-- Grant chỉ trên bảng của tính năng này (không đụng các bảng khác trong schema)
GRANT ALL ON materials_module.news_articles TO anon, authenticated, service_role;

-- RLS: student chỉ đọc bài đã publish; ghi qua supabaseAdmin
ALTER TABLE materials_module.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_articles: read published" ON materials_module.news_articles FOR SELECT TO authenticated USING (is_published = true);
