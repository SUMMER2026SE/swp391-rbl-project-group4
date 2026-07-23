-- 017_learning_paths.sql
-- AI-personalized learning path (Cá nhân hoá lộ trình học)
-- One active path per user; steps reference real content (polymorphic resource_id,
-- validated in the application layer since public.courses is a VIEW).

CREATE TABLE IF NOT EXISTS public.learning_paths (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_level     text NOT NULL CHECK (current_level IN ('N5','N4','N3','N2','N1')),
  target_level      text NOT NULL CHECK (target_level  IN ('N5','N4','N3','N2','N1')),
  study_goal        text,
  daily_minutes     smallint,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  ai_model          text,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- At most one active path per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_learning_path_active
  ON public.learning_paths(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.learning_path_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id        uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  order_index    int  NOT NULL DEFAULT 0,
  title          text NOT NULL,
  description    text,
  skill_focus    text CHECK (skill_focus IN ('vocabulary','kanji','grammar','reading','listening','mixed')),
  rationale      text,
  resource_type  text NOT NULL CHECK (resource_type IN ('course','study_list','mock_exam')),
  resource_id    uuid NOT NULL,
  resource_level text CHECK (resource_level IN ('N5','N4','N3','N2','N1')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_steps_path
  ON public.learning_path_steps(path_id, order_index);

-- RLS: service role (backend) bypasses; students may read only their own rows
ALTER TABLE public.learning_paths      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lp_read_own  ON public.learning_paths;
DROP POLICY IF EXISTS lps_read_own ON public.learning_path_steps;

CREATE POLICY lp_read_own ON public.learning_paths
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY lps_read_own ON public.learning_path_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.learning_paths p
            WHERE p.id = path_id AND p.user_id = auth.uid())
  );

-- Quota seed: free = 2/month, premium = unlimited
INSERT INTO public.feature_entitlements (tier, feature_code, limit_value, period_type)
VALUES ('free',    'learning_path_generate_monthly',  2, 'monthly'),
       ('premium', 'learning_path_generate_monthly', -1, 'monthly')
ON CONFLICT DO NOTHING;
