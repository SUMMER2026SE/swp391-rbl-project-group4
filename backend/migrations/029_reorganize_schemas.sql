-- 029: Tổ chức lại toàn bộ schema theo domain (phục vụ thiết kế database chuẩn).
-- Idempotent: chạy lại an toàn.
--
-- Nội dung:
--   1. Rename: content_module → course_module, vocabulary_module → language_module
--   2. Viết lại 15 hàm compat/trigger hard-code tên schema cũ trong thân hàm
--   3. Tạo 2 schema mới: practice_module (luyện đọc/nghe/viết/nói), billing_module (mọi thứ liên quan tiền)
--   4. Di chuyển 24 bảng về đúng schema domain (ALTER TABLE ... SET SCHEMA — giữ nguyên dữ liệu,
--      RLS/index/FK/trigger tự đi theo bảng)
--   5. Viết lại public.vip_revenue() / public.teacher_uses() (bảng nguồn đã sang billing_module)
--   6. Grants + default privileges cho các schema mới/mới expose
--   7. Bật RLS cho course_module.units (advisory bảo mật Supabase)
--   8. Cập nhật pgrst.db_schemas + search_path của role authenticator, reload PostgREST
--
-- ⚠️ Sau khi chạy migration này PHẢI deploy code backend đã đổi .schema() tương ứng ngay
--    (xem cùng commit) — giữa 2 bước app sẽ lỗi với các bảng bị di chuyển.

-- ─── 1. Rename schema ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'content_module')
     AND NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'course_module') THEN
    ALTER SCHEMA content_module RENAME TO course_module;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vocabulary_module')
     AND NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'language_module') THEN
    ALTER SCHEMA vocabulary_module RENAME TO language_module;
  END IF;
END $$;

-- ─── 2. Viết lại các hàm hard-code tên schema cũ ─────────────────────────────
-- (thân hàm lưu dạng text nên KHÔNG tự đổi theo khi rename schema)

-- 2a. Trigger functions của course_module (đã theo schema sang tên mới)

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
$function$;

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
$function$;

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
$function$;

-- 2b. Compat-view functions ở public (INSTEAD OF triggers của các view tương thích)

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
END $function$;

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
END $function$;

CREATE OR REPLACE FUNCTION public.courses_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN DELETE FROM course_module.courses WHERE id = OLD.id; RETURN OLD; END $function$;

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
END $function$;

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
END $function$;

CREATE OR REPLACE FUNCTION public.lessons_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN DELETE FROM course_module.lessons WHERE id=OLD.id; RETURN OLD; END $function$;

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
END $function$;

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
END $function$;

CREATE OR REPLACE FUNCTION public.vocabulary_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM language_module.vocabulary WHERE id = OLD.id;
  RETURN OLD;
END $function$;

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
END $function$;

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
END $function$;

CREATE OR REPLACE FUNCTION public.kanji_compat_del()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM language_module.kanji WHERE id = OLD.id;
  RETURN OLD;
END $function$;

-- ─── 3. Tạo schema mới ───────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS practice_module;
CREATE SCHEMA IF NOT EXISTS billing_module;

-- ─── 4. Di chuyển bảng về đúng schema domain ────────────────────────────────
-- Bọc DO idempotent: bảng đã chuyển rồi thì bỏ qua (pattern của 024).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- public → users_module
      ('public', 'teacher_applications',      'users_module'),
      -- public → language_module (kho từ vựng/kanji/ngữ pháp + bài đăng)
      ('public', 'grammar_points',            'language_module'),
      ('public', 'teacher_vocabulary',        'language_module'),
      ('public', 'teacher_kanji',             'language_module'),
      ('public', 'study_list_posts',          'language_module'),
      ('public', 'study_list_items',          'language_module'),
      -- public → practice_module (luyện đọc/nghe)
      ('public', 'reading_sets',              'practice_module'),
      ('public', 'rs_passages',               'practice_module'),
      ('public', 'rs_questions',              'practice_module'),
      ('public', 'rs_options',                'practice_module'),
      ('public', 'rs_drafts',                 'practice_module'),
      ('public', 'listening_dialogues',       'practice_module'),
      ('public', 'listening_dialogue_lines',  'practice_module'),
      ('public', 'listening_user_audios',     'practice_module'),
      -- reading_module → practice_module
      ('reading_module', 'articles',          'practice_module'),
      ('reading_module', 'article_reads',     'practice_module'),
      -- materials_module → practice_module (luyện viết/nói)
      ('materials_module', 'writing_submissions',       'practice_module'),
      ('materials_module', 'pronunciation_assessments', 'practice_module'),
      -- public → billing_module (premium, thanh toán, hạn mức, doanh thu GV)
      ('public', 'subscription_plans',        'billing_module'),
      ('public', 'user_subscriptions',        'billing_module'),
      ('public', 'payment_orders',            'billing_module'),
      ('public', 'payment_transactions',      'billing_module'),
      ('public', 'feature_entitlements',      'billing_module'),
      ('public', 'feature_usage_counters',    'billing_module'),
      ('public', 'content_usage_events',      'billing_module'),
      ('public', 'revenue_pool_periods',      'billing_module'),
      ('public', 'teacher_payouts',           'billing_module'),
      -- course_module → billing_module (thanh toán khóa học)
      ('course_module', 'payments',             'billing_module'),
      ('course_module', 'course_payment_orders','billing_module'),
      -- public → ai_module (chat AI + lộ trình học)
      ('public', 'chat_sessions',             'ai_module'),
      ('public', 'chat_messages',             'ai_module'),
      ('public', 'learning_paths',            'ai_module'),
      ('public', 'learning_path_steps',       'ai_module')
    ) AS m(src_schema, tbl, dst_schema)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = r.src_schema AND table_name = r.tbl AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I SET SCHEMA %I', r.src_schema, r.tbl, r.dst_schema);
    END IF;
  END LOOP;
END $$;

-- ─── 5. Viết lại 2 hàm RPC trỏ tới bảng đã sang billing_module ──────────────
-- Giữ hàm ở public để backend gọi .rpc('vip_revenue') / .rpc('teacher_uses') không đổi.

CREATE OR REPLACE FUNCTION public.vip_revenue(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(SUM(amount), 0)::numeric
  FROM billing_module.payment_orders
  WHERE status = 'paid' AND paid_at >= p_start AND paid_at < p_end;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_uses(p_period text)
 RETURNS TABLE(teacher_id uuid, uses bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT teacher_id, COUNT(*)::bigint AS uses
  FROM billing_module.content_usage_events
  WHERE period_key = p_period AND teacher_id IS NOT NULL
  GROUP BY teacher_id;
$function$;

-- ─── 6. Quyền truy cập ──────────────────────────────────────────────────────
-- Các schema lần đầu được expose qua PostgREST cần USAGE + quyền bảng cho service_role
-- (backend luôn dùng service_role; anon/authenticated không truy cập DB trực tiếp).

GRANT USAGE ON SCHEMA users_module, language_module, ai_module, practice_module
  TO anon, authenticated, service_role;
-- billing_module chứa dữ liệu tiền — chỉ service_role được vào.
GRANT USAGE ON SCHEMA billing_module TO service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA users_module, language_module, ai_module, practice_module, billing_module TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA users_module, language_module, ai_module, practice_module, billing_module TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA practice_module GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA practice_module GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA billing_module  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA billing_module  GRANT ALL ON SEQUENCES TO service_role;

-- ─── 7. Bật RLS cho course_module.units (advisory bảo mật Supabase) ─────────
-- Backend dùng service_role (bypass RLS) nên không đổi hành vi app.

ALTER TABLE course_module.units ENABLE ROW LEVEL SECURITY;

-- ─── 8. Exposed schemas + search_path của PostgREST ─────────────────────────
-- Thêm users_module, language_module, ai_module, practice_module, billing_module;
-- đổi content_module → course_module. Giữ tạm materials_module/reading_module
-- (sẽ gỡ ở 030 sau khi drop schema rỗng); giữ listening_module (dữ liệu cũ, chưa đụng).

ALTER ROLE authenticator SET pgrst.db_schemas =
  'public, graphql_public, course_module, language_module, users_module, ai_module, practice_module, billing_module, dictionary_module, materials_module, flashcard_module, exam_module, listening_module, reading_module, jlpt_module';

ALTER ROLE authenticator SET search_path =
  'public, exam_module, users_module, ai_module, language_module, course_module, flashcard_module, materials_module, dictionary_module, listening_module, practice_module, billing_module, jlpt_module, reading_module';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
