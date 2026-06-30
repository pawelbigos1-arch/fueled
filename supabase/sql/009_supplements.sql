-- Fueled — suplementy: słowniki, harmonogram, odbiory, plan dnia treningowego

CREATE TABLE IF NOT EXISTS public.supplement_timings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplement_timings_user_idx
  ON public.supplement_timings (user_id, sort_order);

ALTER TABLE public.supplement_timings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplement_timings_own" ON public.supplement_timings;
CREATE POLICY "supplement_timings_own"
  ON public.supplement_timings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplements_user_idx
  ON public.supplements (user_id, sort_order);

ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplements_own" ON public.supplements;
CREATE POLICY "supplements_own"
  ON public.supplements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.supplement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id uuid NOT NULL REFERENCES public.supplements (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  condition text NOT NULL CHECK (condition IN ('always', 'training', 'rest')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplement_id, condition)
);

CREATE INDEX IF NOT EXISTS supplement_rules_supplement_idx
  ON public.supplement_rules (supplement_id);

ALTER TABLE public.supplement_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplement_rules_own" ON public.supplement_rules;
CREATE POLICY "supplement_rules_own"
  ON public.supplement_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.supplement_rule_doses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.supplement_rules (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  timing_id uuid NOT NULL REFERENCES public.supplement_timings (id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, timing_id)
);

CREATE INDEX IF NOT EXISTS supplement_rule_doses_rule_idx
  ON public.supplement_rule_doses (rule_id, sort_order);

ALTER TABLE public.supplement_rule_doses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplement_rule_doses_own" ON public.supplement_rule_doses;
CREATE POLICY "supplement_rule_doses_own"
  ON public.supplement_rule_doses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.supplement_intakes (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  supplement_id uuid NOT NULL REFERENCES public.supplements (id) ON DELETE CASCADE,
  timing_id uuid NOT NULL REFERENCES public.supplement_timings (id) ON DELETE CASCADE,
  dose_index integer NOT NULL DEFAULT 0 CHECK (dose_index >= 0 AND dose_index <= 31),
  taken boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date, supplement_id, timing_id, dose_index)
);

CREATE INDEX IF NOT EXISTS supplement_intakes_user_date_idx
  ON public.supplement_intakes (user_id, date);

ALTER TABLE public.supplement_intakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplement_intakes_own" ON public.supplement_intakes;
CREATE POLICY "supplement_intakes_own"
  ON public.supplement_intakes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.training_day_plans (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  is_training boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS training_day_plans_user_date_idx
  ON public.training_day_plans (user_id, date);

ALTER TABLE public.training_day_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_day_plans_own" ON public.training_day_plans;
CREATE POLICY "training_day_plans_own"
  ON public.training_day_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
