-- Fueled — moduł Rozwój: refleksje, nawyki, zasady

-- ── daily_reflections ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_reflections (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  transcript text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS daily_reflections_user_date_idx
  ON public.daily_reflections (user_id, date DESC);

ALTER TABLE public.daily_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_reflections_own" ON public.daily_reflections;
CREATE POLICY "daily_reflections_own"
  ON public.daily_reflections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── weekly_reflection_summaries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_reflection_summaries (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  summary text NOT NULL DEFAULT '',
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

ALTER TABLE public.weekly_reflection_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reflection_summaries_own" ON public.weekly_reflection_summaries;
CREATE POLICY "weekly_reflection_summaries_own"
  ON public.weekly_reflection_summaries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── habits ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  frequency_type text NOT NULL DEFAULT 'daily'
    CHECK (frequency_type IN ('daily', 'weekly', 'monthly')),
  target_count integer NOT NULL DEFAULT 1 CHECK (target_count >= 1),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS habits_user_idx ON public.habits (user_id, sort_order);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habits_own" ON public.habits;
CREATE POLICY "habits_own"
  ON public.habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── habit_completions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS habit_completions_user_date_idx
  ON public.habit_completions (user_id, date);

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habit_completions_own" ON public.habit_completions;
CREATE POLICY "habit_completions_own"
  ON public.habit_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── personal_rules ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_rules_user_idx
  ON public.personal_rules (user_id, sort_order);

ALTER TABLE public.personal_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_rules_own" ON public.personal_rules;
CREATE POLICY "personal_rules_own"
  ON public.personal_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
