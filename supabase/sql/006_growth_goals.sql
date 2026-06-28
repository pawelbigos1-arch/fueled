-- Rozwój: Cele + Projekty + Nowe rzeczy; usunięcie zasad

DROP TABLE IF EXISTS public.personal_rules;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_idx ON public.projects (user_id, sort_order);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_own" ON public.projects;
CREATE POLICY "projects_own"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.dated_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dated_goals_user_date_idx
  ON public.dated_goals (user_id, date DESC, sort_order);

ALTER TABLE public.dated_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dated_goals_own" ON public.dated_goals;
CREATE POLICY "dated_goals_own"
  ON public.dated_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.new_things (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'done')),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  planned_date date,
  done_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS new_things_user_status_idx
  ON public.new_things (user_id, status, sort_order);

ALTER TABLE public.new_things ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "new_things_own" ON public.new_things;
CREATE POLICY "new_things_own"
  ON public.new_things FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
