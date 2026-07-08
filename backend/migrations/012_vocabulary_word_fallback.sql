-- ═══════════════════════════════════════════════════════════════════════════════
-- 012_vocabulary_word_fallback.sql — cho phép tạo/nhập từ vựng không có kanji
--
-- Lỗi có sẵn: vocabulary_module.vocabulary.word là NOT NULL nhưng trigger compat
-- của view public.vocabulary gán word = NEW.kanji trực tiếp → mọi INSERT/UPDATE
-- từ không có kanji (vd ありがとう) đều fail 23502. Điều này chặn cả import JSON
-- hiện có lẫn bulk import file mới.
--
-- Sửa đối xứng:
--   - Ghi:  word = COALESCE(NULLIF(kanji,''), reading)  (từ thuần kana → word = reading)
--   - Đọc:  kanji = NULLIF(word, reading)               (word trùng reading → kanji = null)
-- → round-trip giữ nguyên ngữ nghĩa, UI (kanji || reading) hiển thị không đổi.
--
-- CREATE OR REPLACE giữ nguyên trigger/grant/owner hiện có. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.vocabulary_compat_ins()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO vocabulary_module.vocabulary
    (word, reading, romaji, meaning_vi, meaning_en, part_of_speech, example_sentence, lesson_id, topic, jlpt_level_id, created_by, is_public)
  VALUES (COALESCE(NULLIF(NEW.kanji, ''), NEW.reading), NEW.reading, NEW.romaji, NEW.meaning_vi, NEW.meaning_ja, NEW.type,
          NEW.example_sentence, NEW.lesson_id, NEW.topic,
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
    meaning_en=NEW.meaning_ja, part_of_speech=NEW.type, example_sentence=NEW.example_sentence,
    lesson_id=NEW.lesson_id, topic=NEW.topic,
    jlpt_level_id=(SELECT id FROM vocabulary_module.jlpt_levels WHERE name = NEW.level),
    is_public=COALESCE(NEW.is_public, true)
  WHERE id = OLD.id;
  RETURN NEW;
END $function$;

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
    v.is_public
   FROM vocabulary_module.vocabulary v
     LEFT JOIN vocabulary_module.jlpt_levels jl ON jl.id = v.jlpt_level_id;

NOTIFY pgrst, 'reload schema';
