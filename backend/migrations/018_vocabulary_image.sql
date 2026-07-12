-- Migration 018: Thêm cột image_url cho từ vựng
-- Cho phép giáo viên gắn ảnh minh họa riêng cho từng từ vựng (ảnh do giáo viên
-- tự tải lên), hiển thị trong chế độ xem từng từ của bài đăng danh sách.
-- public.vocabulary là VIEW compat trỏ tới vocabulary_module.vocabulary (có
-- INSTEAD OF trigger xử lý insert/update) — phải sửa cả 3 chỗ: bảng gốc, view,
-- và 2 trigger function ins/upd.

ALTER TABLE vocabulary_module.vocabulary
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE OR REPLACE VIEW public.vocabulary AS
 SELECT v.id,
    (NULLIF((v.word)::text, (v.reading)::text))::character varying(100) AS kanji,
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
    v.image_url
   FROM (vocabulary_module.vocabulary v
     LEFT JOIN vocabulary_module.jlpt_levels jl ON ((jl.id = v.jlpt_level_id)));

CREATE OR REPLACE FUNCTION public.vocabulary_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO vocabulary_module.vocabulary
    (word, reading, romaji, meaning_vi, meaning_en, part_of_speech, example_sentence, image_url, lesson_id, topic, jlpt_level_id, created_by, is_public)
  VALUES (COALESCE(NULLIF(NEW.kanji, ''), NEW.reading), NEW.reading, NEW.romaji, NEW.meaning_vi, NEW.meaning_ja, NEW.type,
          NEW.example_sentence, NEW.image_url, NEW.lesson_id, NEW.topic,
          (SELECT id FROM vocabulary_module.jlpt_levels WHERE name = NEW.level),
          COALESCE(NEW.created_by, NULL), COALESCE(NEW.is_public, true))
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
    is_public=COALESCE(NEW.is_public, true)
  WHERE id = OLD.id;
  RETURN NEW;
END $function$;

NOTIFY pgrst, 'reload schema';
