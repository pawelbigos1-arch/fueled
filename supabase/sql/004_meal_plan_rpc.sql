-- Atomowe potwierdzenie posiłku z planu + synchronizacja przy usuwaniu z Dziś

CREATE OR REPLACE FUNCTION public.meal_confirmed_from_json(v jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL THEN false
    WHEN v = 'true'::jsonb OR v = '1'::jsonb THEN true
    WHEN v = 'false'::jsonb OR v = '0'::jsonb THEN false
    WHEN jsonb_typeof(v) = 'string' AND lower(trim(both '"' from v::text)) IN ('true', '1', 'yes') THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.plan_meal_status(meals_json jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN meals_json IS NULL OR jsonb_array_length(meals_json) = 0 THEN 'draft'
    WHEN NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(meals_json) AS elem
      WHERE NOT public.meal_confirmed_from_json(elem->'confirmed')
    ) THEN 'confirmed'
    ELSE 'draft'
  END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_plan_meal(
  p_plan_date date,
  p_meal_id text,
  p_name text,
  p_kcal integer,
  p_protein integer,
  p_carbs integer,
  p_fat integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
  v_meals jsonb;
  v_updated jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.meals
  WHERE user_id = v_user_id
    AND source_plan_date = p_plan_date
    AND source_plan_meal_id = p_meal_id
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.meals (
      user_id,
      date,
      name,
      kcal,
      protein,
      carbs,
      fat,
      source_plan_meal_id,
      source_plan_date
    )
    VALUES (
      v_user_id,
      p_plan_date,
      p_name,
      p_kcal,
      p_protein,
      p_carbs,
      p_fat,
      p_meal_id,
      p_plan_date
    )
    RETURNING id INTO v_new_id;
    v_existing_id := v_new_id;
  END IF;

  SELECT meals INTO v_meals
  FROM public.meal_plans
  WHERE user_id = v_user_id AND date = p_plan_date
  FOR UPDATE;

  IF v_meals IS NULL THEN
    v_meals := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(updated_elem ORDER BY ord), '[]'::jsonb)
  INTO v_updated
  FROM (
    SELECT
      ord,
      CASE
        WHEN elem->>'id' = p_meal_id
        THEN jsonb_set(elem, '{confirmed}', 'true'::jsonb, true)
        ELSE elem
      END AS updated_elem
    FROM jsonb_array_elements(v_meals) WITH ORDINALITY AS t(elem, ord)
  ) sub;

  INSERT INTO public.meal_plans (user_id, date, meals, status, updated_at)
  VALUES (
    v_user_id,
    p_plan_date,
    v_updated,
    public.plan_meal_status(v_updated),
    now()
  )
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    meals = EXCLUDED.meals,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN v_existing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_plan_meal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_plan_meal TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_meal_and_sync_plan(p_meal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source_meal_id text;
  v_source_date date;
  v_meals jsonb;
  v_updated jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT source_plan_meal_id, source_plan_date
  INTO v_source_meal_id, v_source_date
  FROM public.meals
  WHERE id = p_meal_id AND user_id = v_user_id;

  DELETE FROM public.meals
  WHERE id = p_meal_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_source_meal_id IS NULL OR v_source_date IS NULL THEN
    RETURN;
  END IF;

  SELECT meals INTO v_meals
  FROM public.meal_plans
  WHERE user_id = v_user_id AND date = v_source_date
  FOR UPDATE;

  IF v_meals IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(updated_elem ORDER BY ord), '[]'::jsonb)
  INTO v_updated
  FROM (
    SELECT
      ord,
      CASE
        WHEN elem->>'id' = v_source_meal_id
        THEN jsonb_set(elem, '{confirmed}', 'false'::jsonb, true)
        ELSE elem
      END AS updated_elem
    FROM jsonb_array_elements(v_meals) WITH ORDINALITY AS t(elem, ord)
  ) sub;

  UPDATE public.meal_plans
  SET
    meals = v_updated,
    status = public.plan_meal_status(v_updated),
    updated_at = now()
  WHERE user_id = v_user_id AND date = v_source_date;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_meal_and_sync_plan FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_meal_and_sync_plan TO authenticated;
