-- Link posiłku w dzienniku (meals) z pozycją planu (meal_plans.meals[].id)

ALTER TABLE public.meals ADD COLUMN IF NOT EXISTS source_plan_meal_id text;
ALTER TABLE public.meals ADD COLUMN IF NOT EXISTS source_plan_date date;

CREATE UNIQUE INDEX IF NOT EXISTS meals_plan_source_uidx
  ON public.meals (user_id, source_plan_date, source_plan_meal_id)
  WHERE source_plan_meal_id IS NOT NULL;
