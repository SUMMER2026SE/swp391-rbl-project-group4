-- Enable RLS on user tables
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_dashboards ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users: read own') THEN
    CREATE POLICY "users: read own" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users: update own') THEN
    CREATE POLICY "users: update own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_profiles' AND policyname='profiles: read own') THEN
    CREATE POLICY "profiles: read own" ON public.student_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_profiles' AND policyname='profiles: update own') THEN
    CREATE POLICY "profiles: update own" ON public.student_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_dashboards' AND policyname='dashboards: read own') THEN
    CREATE POLICY "dashboards: read own" ON public.student_dashboards FOR SELECT TO authenticated USING (auth.uid() = student_id);
  END IF;
END $$;

-- Trigger function: auto-create profile rows on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $func$
BEGIN
  INSERT INTO public.users (id, full_name, email, created_at)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.student_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.student_dashboards (student_id)
  VALUES (NEW.id)
  ON CONFLICT (student_id) DO NOTHING;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill existing auth users into the new tables
INSERT INTO public.users (id, full_name, email, created_at)
SELECT id, raw_user_meta_data->>'full_name', email, created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.student_profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.student_dashboards (student_id)
SELECT id FROM auth.users
ON CONFLICT (student_id) DO NOTHING;

-- ─── Dictionary feature: từ điển Nhật-Việt độc lập ────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE TABLE IF NOT EXISTS public.dict_kanji (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  character    text NOT NULL UNIQUE,
  han_viet     text,
  meaning_vi   text,
  reading_on   text[],
  reading_kun  text[],
  stroke_count integer,
  jlpt_level   text CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dict_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kanji       text,
  kana        text NOT NULL,
  romaji      text,
  jlpt_level  text CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
  word_type   text,
  is_common   boolean DEFAULT false,
  source      text,
  source_id   text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE TABLE IF NOT EXISTS public.dict_senses (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id    uuid NOT NULL REFERENCES public.dict_entries(id) ON DELETE CASCADE,
  pos         text,
  meaning_vi  text NOT NULL,
  order_index integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dict_senses_entry_id_order_index_key'
  ) THEN
    ALTER TABLE public.dict_senses ADD CONSTRAINT dict_senses_entry_id_order_index_key UNIQUE (entry_id, order_index);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.dict_examples (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sense_id    uuid NOT NULL REFERENCES public.dict_senses(id) ON DELETE CASCADE,
  sentence_jp text NOT NULL,
  sentence_vi text,
  created_at  timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dict_examples_sense_id_sentence_jp_key'
  ) THEN
    ALTER TABLE public.dict_examples ADD CONSTRAINT dict_examples_sense_id_sentence_jp_key UNIQUE (sense_id, sentence_jp);
  END IF;
END $$;

-- Furigana (ruby HTML) sinh sẵn offline cho câu ví dụ; NULL = câu không có kanji
ALTER TABLE public.dict_examples ADD COLUMN IF NOT EXISTS furigana text;

CREATE TABLE IF NOT EXISTS public.dict_related_words (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id      uuid NOT NULL REFERENCES public.dict_entries(id) ON DELETE CASCADE,
  related_id    uuid NOT NULL REFERENCES public.dict_entries(id) ON DELETE CASCADE,
  relation_type text DEFAULT 'related' CHECK (relation_type IN ('related','synonym','antonym')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (entry_id, related_id, relation_type),
  CHECK (entry_id <> related_id)
);

CREATE INDEX IF NOT EXISTS idx_dict_kanji_character  ON public.dict_kanji (character);
CREATE INDEX IF NOT EXISTS idx_dict_entries_kana     ON public.dict_entries USING gin (kana gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_entries_kanji    ON public.dict_entries USING gin (kanji gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_entries_romaji   ON public.dict_entries USING gin (romaji gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_entries_jlpt     ON public.dict_entries (jlpt_level);
CREATE INDEX IF NOT EXISTS idx_dict_senses_entry     ON public.dict_senses (entry_id);
CREATE INDEX IF NOT EXISTS idx_dict_senses_meaning   ON public.dict_senses USING gin (f_unaccent(meaning_vi) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dict_examples_sense   ON public.dict_examples (sense_id);
CREATE INDEX IF NOT EXISTS idx_dict_related_entry    ON public.dict_related_words (entry_id);

-- Tìm entry theo nghĩa tiếng Việt: khớp NGUYÊN TỪ (ranh giới từ) + ưu tiên đúng dấu + xếp hạng
CREATE OR REPLACE FUNCTION public.search_dict_by_meaning(p_query text, p_limit int, p_offset int)
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
  FROM public.dict_senses s CROSS JOIN q
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

ALTER TABLE public.dict_kanji         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dict_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dict_senses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dict_examples      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dict_related_words ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dict_kanji' AND policyname='dict_kanji: read all') THEN
    CREATE POLICY "dict_kanji: read all" ON public.dict_kanji FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dict_entries' AND policyname='dict_entries: read all') THEN
    CREATE POLICY "dict_entries: read all" ON public.dict_entries FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dict_senses' AND policyname='dict_senses: read all') THEN
    CREATE POLICY "dict_senses: read all" ON public.dict_senses FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dict_examples' AND policyname='dict_examples: read all') THEN
    CREATE POLICY "dict_examples: read all" ON public.dict_examples FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dict_related_words' AND policyname='dict_related_words: read all') THEN
    CREATE POLICY "dict_related_words: read all" ON public.dict_related_words FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ─── Dictionary: tách 5 bảng từ điển sang schema riêng dictionary_module ───────
-- Chuyển bảng bằng SET SCHEMA: GIỮ NGUYÊN dữ liệu, index, RLS, khóa ngoại (không tạo lại).
-- Idempotent: chỉ chuyển khi bảng còn nằm ở public; chạy lại nhiều lần an toàn.

CREATE SCHEMA IF NOT EXISTS dictionary_module;
GRANT USAGE ON SCHEMA dictionary_module TO anon, authenticated, service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dict_kanji') THEN
    ALTER TABLE public.dict_kanji SET SCHEMA dictionary_module;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dict_entries') THEN
    ALTER TABLE public.dict_entries SET SCHEMA dictionary_module;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dict_senses') THEN
    ALTER TABLE public.dict_senses SET SCHEMA dictionary_module;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dict_examples') THEN
    ALTER TABLE public.dict_examples SET SCHEMA dictionary_module;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dict_related_words') THEN
    ALTER TABLE public.dict_related_words SET SCHEMA dictionary_module;
  END IF;
END $$;

GRANT ALL ON ALL TABLES    IN SCHEMA dictionary_module TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dictionary_module TO anon, authenticated, service_role;

-- Hàm search: bỏ bản cũ ở public, tạo lại trong dictionary_module (đổi tham chiếu sang
-- dictionary_module.dict_senses; f_unaccent vẫn ở public). Logic giữ y nguyên.
DROP FUNCTION IF EXISTS public.search_dict_by_meaning(text, int, int);
CREATE OR REPLACE FUNCTION dictionary_module.search_dict_by_meaning(p_query text, p_limit int, p_offset int)
RETURNS TABLE(entry_id uuid) AS $$
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
$$ LANGUAGE sql STABLE;
GRANT EXECUTE ON FUNCTION dictionary_module.search_dict_by_meaning(text, int, int) TO anon, authenticated, service_role;

-- ── Dictionary: đổi tên han_viet -> sino_vi, bỏ 2 cột không dùng trong dict_kanji ──
-- (rename giữ nguyên dữ liệu Hán Việt; stroke_count/jlpt_level vốn không nơi nào đọc)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='dictionary_module' AND table_name='dict_kanji' AND column_name='han_viet') THEN
    ALTER TABLE dictionary_module.dict_kanji RENAME COLUMN han_viet TO sino_vi;
  END IF;
END $$;
ALTER TABLE dictionary_module.dict_kanji DROP COLUMN IF EXISTS stroke_count;
ALTER TABLE dictionary_module.dict_kanji DROP COLUMN IF EXISTS jlpt_level;

-- ── Dictionary: bỏ cột word_type không dùng trong dict_entries ──
ALTER TABLE dictionary_module.dict_entries DROP COLUMN IF EXISTS word_type;


-- ─── Materials: tính năng "Luyện đọc báo" cho student (schema riêng) ───────────
-- Bài đọc lưu sẵn furigana (ruby HTML) + bản dịch tiếng Việt theo từng câu trong
-- cột segments (jsonb): [{ jp, furigana, vi }]. AI chỉ chạy 1 lần lúc admin tạo bài;
-- student đọc lấy thẳng từ DB, không gọi AI. Idempotent — chạy lại an toàn.
-- LƯU Ý: phải thêm 'materials_module' vào Exposed schemas trong Supabase (Settings → API)
--        thì supabase-js mới truy cập được qua .schema('materials_module').

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

-- Bỏ cột topic nếu DB cũ đã tạo (tính năng không dùng chủ đề nữa)
ALTER TABLE materials_module.news_articles DROP COLUMN IF EXISTS topic;

-- Grant chỉ trên bảng của tính năng này (không đụng các bảng khác trong schema)
GRANT ALL ON materials_module.news_articles TO anon, authenticated, service_role;

ALTER TABLE materials_module.news_articles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='materials_module' AND tablename='news_articles' AND policyname='news_articles: read published') THEN
    CREATE POLICY "news_articles: read published" ON materials_module.news_articles FOR SELECT TO authenticated USING (is_published = true);
  END IF;
END $$;

-- ─── FLASHCARD MODULE: thiết kế lại (study set / thư mục / thẻ / tiến độ) ──
-- Xóa toàn bộ thiết kế cũ (decks/SM-2 reviews/learning_records) — thay bằng mô hình thuộc/chưa thuộc
DROP TABLE IF EXISTS flashcard_module.flashcard_reviews           CASCADE;
DROP TABLE IF EXISTS flashcard_module.vocabulary_learning_records CASCADE;
DROP TABLE IF EXISTS flashcard_module.flashcards                  CASCADE;
DROP TABLE IF EXISTS flashcard_module.flashcard_decks             CASCADE;

CREATE SCHEMA IF NOT EXISTS flashcard_module;

-- Thư mục (chứa nhiều học phần)
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_folders (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Học phần (study set)
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_sets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Nối nhiều-nhiều folder ↔ set (1 học phần có thể nằm nhiều thư mục)
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_folder_sets (
  folder_id uuid NOT NULL REFERENCES flashcard_module.flashcard_folders(id) ON DELETE CASCADE,
  set_id    uuid NOT NULL REFERENCES flashcard_module.flashcard_sets(id)    ON DELETE CASCADE,
  added_at  timestamptz DEFAULT now(),
  PRIMARY KEY (folder_id, set_id)
);

-- Thẻ (từ vựng + định nghĩa)
CREATE TABLE IF NOT EXISTS flashcard_module.flashcards (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id      uuid NOT NULL REFERENCES flashcard_module.flashcard_sets(id) ON DELETE CASCADE,
  term        text NOT NULL,                   -- từ vựng (mặt 1)
  definition  text NOT NULL,                   -- định nghĩa (mặt 2)
  order_index integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Tiến độ học per (student, card): không có row = trạng thái 'new' (chưa học)
CREATE TABLE IF NOT EXISTS flashcard_module.flashcard_progress (
  student_id       uuid NOT NULL REFERENCES auth.users(id)                  ON DELETE CASCADE,
  card_id          uuid NOT NULL REFERENCES flashcard_module.flashcards(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'learning' CHECK (status IN ('learning','mastered')),
  last_reviewed_at timestamptz DEFAULT now(),
  PRIMARY KEY (student_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcards_set            ON flashcard_module.flashcards (set_id, order_index);
CREATE INDEX IF NOT EXISTS idx_flashcard_folder_sets_set ON flashcard_module.flashcard_folder_sets (set_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_stu    ON flashcard_module.flashcard_progress (student_id);

-- Cần USAGE trên schema thì các role mới truy cập được bảng bên trong (nếu thiếu -> lỗi 42501)
GRANT USAGE ON SCHEMA flashcard_module               TO anon, authenticated, service_role;
GRANT ALL ON flashcard_module.flashcard_folders     TO anon, authenticated, service_role;
GRANT ALL ON flashcard_module.flashcard_sets        TO anon, authenticated, service_role;
GRANT ALL ON flashcard_module.flashcard_folder_sets TO anon, authenticated, service_role;
GRANT ALL ON flashcard_module.flashcards            TO anon, authenticated, service_role;
GRANT ALL ON flashcard_module.flashcard_progress    TO anon, authenticated, service_role;

-- ⚠️ Expose schema cho PostgREST (nếu thiếu -> lỗi PGRST106 "Invalid schema" khi gọi qua supabase-js).
-- Trên Supabase nên thêm 'flashcard_module' ở Dashboard → Settings → API → Exposed schemas.
-- Tương đương SQL (giữ nguyên các schema đang expose, bổ sung flashcard_module):
ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, graphql_public, dictionary_module, materials_module, flashcard_module';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

ALTER TABLE flashcard_module.flashcard_folders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_module.flashcard_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_module.flashcard_folder_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_module.flashcards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_module.flashcard_progress    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='flashcard_module' AND tablename='flashcard_folders' AND policyname='flashcard_folders: own') THEN
    CREATE POLICY "flashcard_folders: own" ON flashcard_module.flashcard_folders
      FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='flashcard_module' AND tablename='flashcard_sets' AND policyname='flashcard_sets: own') THEN
    CREATE POLICY "flashcard_sets: own" ON flashcard_module.flashcard_sets
      FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='flashcard_module' AND tablename='flashcard_progress' AND policyname='flashcard_progress: own') THEN
    CREATE POLICY "flashcard_progress: own" ON flashcard_module.flashcard_progress
      FOR ALL TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='flashcard_module' AND tablename='flashcards' AND policyname='flashcards: own via set') THEN
    CREATE POLICY "flashcards: own via set" ON flashcard_module.flashcards
      FOR ALL TO authenticated
      USING     (EXISTS (SELECT 1 FROM flashcard_module.flashcard_sets s WHERE s.id = set_id AND s.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM flashcard_module.flashcard_sets s WHERE s.id = set_id AND s.owner_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='flashcard_module' AND tablename='flashcard_folder_sets' AND policyname='flashcard_folder_sets: own via folder') THEN
    CREATE POLICY "flashcard_folder_sets: own via folder" ON flashcard_module.flashcard_folder_sets
      FOR ALL TO authenticated
      USING     (EXISTS (SELECT 1 FROM flashcard_module.flashcard_folders f WHERE f.id = folder_id AND f.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM flashcard_module.flashcard_folders f WHERE f.id = folder_id AND f.owner_id = auth.uid()));
  END IF;
END $$;
