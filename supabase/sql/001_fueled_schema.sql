-- Fueled — pełny schemat bazy (Supabase Postgres)
-- Uruchom w SQL Editor lub przez skrypt apply-schema.

-- ── user_profiles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── goals (jeden rekord na użytkownika) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  kcal integer NOT NULL DEFAULT 2200,
  protein integer NOT NULL DEFAULT 160,
  carbs integer NOT NULL DEFAULT 220,
  fat integer NOT NULL DEFAULT 70,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_own" ON public.goals;
CREATE POLICY "goals_own"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── meals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL DEFAULT 'Posiłek',
  kcal integer NOT NULL DEFAULT 0,
  protein integer NOT NULL DEFAULT 0,
  carbs integer NOT NULL DEFAULT 0,
  fat integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meals_user_date_idx ON public.meals (user_id, date);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meals_own" ON public.meals;
CREATE POLICY "meals_own"
  ON public.meals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── activities (kroki / trening cardio) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL DEFAULT '',
  kcal_burned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_user_date_idx ON public.activities (user_id, date);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_own" ON public.activities;
CREATE POLICY "activities_own"
  ON public.activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── body_metrics ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.body_metrics (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  weight_kg numeric(6, 2),
  fat_pct numeric(5, 2),
  muscle_kg numeric(6, 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_metrics_own" ON public.body_metrics;
CREATE POLICY "body_metrics_own"
  ON public.body_metrics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── meal_plans ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meal_plans (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  meals jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_plans_own" ON public.meal_plans;
CREATE POLICY "meal_plans_own"
  ON public.meal_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── workout_log (siłownia) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  exercise text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  sets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_log_user_date_idx ON public.workout_log (user_id, date);

ALTER TABLE public.workout_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_log_own" ON public.workout_log;
CREATE POLICY "workout_log_own"
  ON public.workout_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── admin: licznik użytkowników (tylko pawelbigos1@gmail.com) ────────────────
CREATE OR REPLACE FUNCTION public.admin_user_profiles_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS NULL OR lower(trim(caller_email)) <> lower('pawelbigos1@gmail.com') THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT count(*)::bigint FROM public.user_profiles);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_profiles_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_profiles_count() TO authenticated;
