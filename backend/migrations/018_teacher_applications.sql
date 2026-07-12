-- 018_teacher_applications.sql
-- Self-service teacher registration with AI review + admin approval/revoke.
-- Apply in the Supabase SQL editor (MCP unavailable this session).

CREATE TABLE IF NOT EXISTS public.teacher_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by            text CHECK (decided_by IN ('ai','admin')),

  -- Applicant-declared info
  phone                 text,
  highest_qualification text,
  specialization        text,
  years_experience      int,
  education             text,
  bio                   text,

  -- Uploaded documents: [{type:'cv'|'degree'|'certificate'|'other', name, path, mime, size}]
  documents             jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- AI review output
  ai_verdict            text,
  ai_summary            text,
  ai_flags              jsonb,
  ai_confidence         int,
  ai_model              text,

  -- Admin decision
  admin_note            text,
  reviewed_by           uuid,
  reviewed_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- At most one open (pending) application per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_teacher_app_pending
  ON public.teacher_applications(user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_teacher_app_status
  ON public.teacher_applications(status, updated_at DESC);

-- RLS: backend (service role) bypasses; applicants may read only their own rows
ALTER TABLE public.teacher_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ta_read_own ON public.teacher_applications;
CREATE POLICY ta_read_own ON public.teacher_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Private bucket for uploaded CV / degree / certificate documents.
-- (Also auto-created idempotently by the backend on first submit.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-documents', 'teacher-documents', false)
ON CONFLICT (id) DO NOTHING;
