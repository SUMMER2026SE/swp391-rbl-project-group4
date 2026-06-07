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
