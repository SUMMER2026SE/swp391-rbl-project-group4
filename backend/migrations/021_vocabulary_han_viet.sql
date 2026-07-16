-- Migration 021: Thêm cột Hán Việt cho từ vựng (đọc Hán Việt của cụm hán tự
-- trong từ, giúp học viên liên hệ hán tự với âm Hán Việt quen thuộc — giống
-- cột han_viet đã có sẵn ở bảng kanji).

ALTER TABLE vocabulary_module.vocabulary
  ADD COLUMN IF NOT EXISTS han_viet varchar(200);

ALTER TABLE public.teacher_vocabulary
  ADD COLUMN IF NOT EXISTS han_viet varchar(200);

-- public.vocabulary là VIEW trên vocabulary_module.vocabulary — cột mới phải
-- thêm vào CUỐI danh sách SELECT, nếu không Postgres báo lỗi đổi tên cột view.
CREATE OR REPLACE VIEW public.vocabulary AS
 SELECT v.id,
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
   FROM vocabulary_module.vocabulary v
     LEFT JOIN vocabulary_module.jlpt_levels jl ON jl.id = v.jlpt_level_id;

CREATE OR REPLACE FUNCTION public.vocabulary_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO vocabulary_module.vocabulary
    (word, reading, romaji, meaning_vi, meaning_en, part_of_speech, example_sentence, image_url, lesson_id, topic, jlpt_level_id, created_by, is_public, han_viet)
  VALUES (COALESCE(NULLIF(NEW.kanji, ''), NEW.reading), NEW.reading, NEW.romaji, NEW.meaning_vi, NEW.meaning_ja, NEW.type,
          NEW.example_sentence, NEW.image_url, NEW.lesson_id, NEW.topic,
          (SELECT id FROM vocabulary_module.jlpt_levels WHERE name = NEW.level),
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
  UPDATE vocabulary_module.vocabulary SET
    word=COALESCE(NULLIF(NEW.kanji, ''), NEW.reading), reading=NEW.reading, romaji=NEW.romaji, meaning_vi=NEW.meaning_vi,
    meaning_en=NEW.meaning_ja, part_of_speech=NEW.type, example_sentence=NEW.example_sentence, image_url=NEW.image_url,
    lesson_id=NEW.lesson_id, topic=NEW.topic,
    jlpt_level_id=(SELECT id FROM vocabulary_module.jlpt_levels WHERE name = NEW.level),
    is_public=COALESCE(NEW.is_public, true), han_viet=NEW.han_viet
  WHERE id = OLD.id;
  RETURN NEW;
END $function$;

NOTIFY pgrst, 'reload schema';
