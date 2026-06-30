-- Fueled — dyscyplina tygodniowa: ręczne nadpisania + targety

CREATE TABLE IF NOT EXISTS public.discipline_overrides (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'diet', 'no_sweets', 'stretching', 'strength', 'cardio', 'pool'
  )),
  done boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date, kind)
);

CREATE INDEX IF NOT EXISTS discipline_overrides_user_date_idx
  ON public.discipline_overrides (user_id, date);

ALTER TABLE public.discipline_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discipline_overrides_own" ON public.discipline_overrides;
CREATE POLICY "discipline_overrides_own"
  ON public.discipline_overrides FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.discipline_targets (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  diet_weekly integer NOT NULL DEFAULT 7
    CHECK (diet_weekly >= 0 AND diet_weekly <= 31),
  no_sweets_weekly integer NOT NULL DEFAULT 7
    CHECK (no_sweets_weekly >= 0 AND no_sweets_weekly <= 31),
  stretching_weekly integer NOT NULL DEFAULT 7
    CHECK (stretching_weekly >= 0 AND stretching_weekly <= 31),
  strength_weekly integer NOT NULL DEFAULT 2
    CHECK (strength_weekly >= 0 AND strength_weekly <= 31),
  cardio_weekly integer NOT NULL DEFAULT 2
    CHECK (cardio_weekly >= 0 AND cardio_weekly <= 31),
  pool_weekly integer NOT NULL DEFAULT 1
    CHECK (pool_weekly >= 0 AND pool_weekly <= 31),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discipline_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discipline_targets_own" ON public.discipline_targets;
CREATE POLICY "discipline_targets_own"
  ON public.discipline_targets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
