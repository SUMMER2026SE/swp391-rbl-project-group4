-- Migration 026: Ngân hàng đề JLPT riêng (schema jlpt_module)
-- Nguồn soạn/lưu trữ câu hỏi JLPT để import (copy snapshot) vào đề thi thử.
-- - jlpt_bank_groups: CHỈ dùng cho các dạng đọc có passage dùng chung
--   (text_grammar, reading_*, integrated/thematic_reading, info_retrieval).
-- - jlpt_bank_questions: câu đơn (từ vựng/ngữ pháp/nghe) có group_id NULL,
--   tự đứng bằng level + mondai_type denormalized.
-- Idempotent: chạy lại an toàn.

CREATE TABLE IF NOT EXISTS jlpt_module.jlpt_bank_groups (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level         text NOT NULL CHECK (level IN ('N5','N4','N3','N2','N1')),
  mondai_type   text NOT NULL CHECK (mondai_type IN (
    'kanji_reading','orthography','word_formation','context','paraphrase','usage',
    'grammar_form','sentence_assembly','text_grammar',
    'reading_short','reading_mid','reading_long','integrated_reading','thematic_reading','info_retrieval',
    'task_comprehension','point_comprehension','summary_comprehension',
    'utterance_expression','quick_response','integrated_listening'
  )),
  title         text,
  passage_text  text,
  image_url     text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jlpt_module.jlpt_bank_questions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id             uuid REFERENCES jlpt_module.jlpt_bank_groups(id) ON DELETE CASCADE,
  level                text NOT NULL CHECK (level IN ('N5','N4','N3','N2','N1')),
  mondai_type          text NOT NULL CHECK (mondai_type IN (
    'kanji_reading','orthography','word_formation','context','paraphrase','usage',
    'grammar_form','sentence_assembly','text_grammar',
    'reading_short','reading_mid','reading_long','integrated_reading','thematic_reading','info_retrieval',
    'task_comprehension','point_comprehension','summary_comprehension',
    'utterance_expression','quick_response','integrated_listening'
  )),
  score_category       text NOT NULL CHECK (score_category IN ('language','reading','listening','language_reading')),
  question_text        text,            -- có thể rỗng (即時応答/概要理解 không in đề chữ)
  image_url            text,
  audio_url            text,
  audio_transcript     text,
  options              jsonb NOT NULL DEFAULT '[]'::jsonb,  -- mảng 3–4 string
  correct_index        int NOT NULL DEFAULT 0,
  explanation          text,
  translation_vi       text,
  option_translations  jsonb,
  source               text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai','import')),
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jlpt_bank_groups_lt      ON jlpt_module.jlpt_bank_groups(level, mondai_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jlpt_bank_questions_lt   ON jlpt_module.jlpt_bank_questions(level, mondai_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jlpt_bank_questions_grp  ON jlpt_module.jlpt_bank_questions(group_id);

-- Bank chứa đáp án/giải thích — bật RLS, KHÔNG mở policy nào:
-- chỉ backend (service role, bypass RLS) được đọc/ghi.
ALTER TABLE jlpt_module.jlpt_bank_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jlpt_module.jlpt_bank_questions ENABLE ROW LEVEL SECURITY;
