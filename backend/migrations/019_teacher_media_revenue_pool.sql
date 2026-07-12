-- 019_teacher_media_revenue_pool.sql
-- Teacher CRUD for listening/reading + content-usage tracking + revenue-share pool.
-- Applied via Supabase MCP (much of the base schema lives only in Supabase).

-- ── Phase 1: ownership columns on teacher-authorable media ────────────────────
ALTER TABLE public.listening_dialogues
  ADD COLUMN IF NOT EXISTS created_by   uuid,
  ADD COLUMN IF NOT EXISTS creator_type text DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

ALTER TABLE materials_module.news_articles
  ADD COLUMN IF NOT EXISTS creator_type text DEFAULT 'admin';

-- ── Phase 2: per-use event log (revenue attribution signal) ───────────────────
CREATE TABLE IF NOT EXISTS public.content_usage_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('listening','reading','study_list')),
  content_id   uuid NOT NULL,
  teacher_id   uuid NOT NULL,
  used_at      timestamptz NOT NULL DEFAULT now(),
  period_key   text NOT NULL,   -- 'YYYY-MM'
  day_key      date NOT NULL DEFAULT current_date
);
-- One use per student per content per day (anti-spam)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_usage_day
  ON public.content_usage_events(student_id, content_type, content_id, day_key);
-- Monthly aggregation per teacher
CREATE INDEX IF NOT EXISTS idx_usage_teacher_period
  ON public.content_usage_events(teacher_id, period_key);

-- ── Phase 3: settings + revenue pool ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings(key, value)
VALUES ('revenue_pool', '{"pool_pct":0.30}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.revenue_pool_periods (
  period_key         text PRIMARY KEY,          -- 'YYYY-MM'
  total_vip_revenue  numeric NOT NULL DEFAULT 0,
  pool_pct           numeric NOT NULL,
  pool_amount        numeric NOT NULL DEFAULT 0,
  total_uses         int NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'finalized',
  finalized_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_payouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key  text NOT NULL,
  teacher_id  uuid NOT NULL,
  uses        int NOT NULL DEFAULT 0,
  share_pct   numeric NOT NULL DEFAULT 0,
  amount      numeric NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  paid_at     timestamptz,
  UNIQUE(period_key, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_payouts_teacher
  ON public.teacher_payouts(teacher_id, period_key);
