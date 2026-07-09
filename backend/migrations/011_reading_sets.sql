-- Migration 011: Reading Sets (JLPT Reading Practice)
-- New reading-set-centric schema replacing the rogue passage/question approach.

-- ── reading_sets ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reading_sets (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title                 text NOT NULL,
  code                  text UNIQUE,
  jlpt_level            text CHECK (jlpt_level IN ('N5','N4','N3','N2','N1')),
  difficulty            text DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  topic                 text,
  short_description     text,
  instructions          text,
  estimated_time_minutes int,
  source_type           text DEFAULT 'manual' CHECK (source_type IN ('manual','ai_generated','imported')),
  status                text DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')),
  tags                  text[] DEFAULT '{}',
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  published_at          timestamptz
);

-- ── rs_passages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rs_passages (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reading_set_id uuid NOT NULL REFERENCES public.reading_sets(id) ON DELETE CASCADE,
  title          text,
  content        text NOT NULL DEFAULT '',
  note           text,
  sort_order     int NOT NULL DEFAULT 0,
  needs_review   boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── rs_questions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rs_questions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reading_set_id uuid NOT NULL REFERENCES public.reading_sets(id) ON DELETE CASCADE,
  passage_id     uuid NOT NULL REFERENCES public.rs_passages(id) ON DELETE CASCADE,
  question_type  text NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice','multiple_choice','fill_blank','short_answer','true_false')),
  question_text  text NOT NULL DEFAULT '',
  explanation    text,
  skill_tags     text[] DEFAULT '{}',
  sort_order     int NOT NULL DEFAULT 0,
  needs_review   boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── rs_options ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rs_options (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id  uuid NOT NULL REFERENCES public.rs_questions(id) ON DELETE CASCADE,
  option_text  text NOT NULL DEFAULT '',
  is_correct   boolean DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0
);

-- ── rs_drafts (autosave snapshots) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rs_drafts (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reading_set_id uuid REFERENCES public.reading_sets(id) ON DELETE CASCADE,
  snapshot       jsonb NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rs_passages_set   ON public.rs_passages(reading_set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rs_questions_pass ON public.rs_questions(passage_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rs_options_q      ON public.rs_options(question_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rs_drafts_set     ON public.rs_drafts(reading_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sets_status ON public.reading_sets(status, jlpt_level);

-- ── RLS (Row Level Security) ──────────────────────────────────────────────────
ALTER TABLE public.reading_sets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_passages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rs_drafts      ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (backend uses service key)
-- Students read published sets via public policy
CREATE POLICY "students_read_published" ON public.reading_sets
  FOR SELECT USING (status = 'published');

CREATE POLICY "students_read_published_passages" ON public.rs_passages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.reading_sets rs WHERE rs.id = reading_set_id AND rs.status = 'published')
  );

CREATE POLICY "students_read_published_questions" ON public.rs_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.reading_sets rs WHERE rs.id = reading_set_id AND rs.status = 'published')
  );

CREATE POLICY "students_read_published_options" ON public.rs_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rs_questions q
      JOIN public.reading_sets rs ON rs.id = q.reading_set_id
      WHERE q.id = question_id AND rs.status = 'published'
    )
  );
