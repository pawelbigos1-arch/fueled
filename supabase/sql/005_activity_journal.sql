-- Powiązanie aktywności (Dziś) z dziennikiem treningowym

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS workout_log_id uuid;

ALTER TABLE public.workout_log
  ADD COLUMN IF NOT EXISTS activity_id uuid;

ALTER TABLE public.workout_log
  ADD COLUMN IF NOT EXISTS measurement_profile text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_workout_log_id_fkey'
  ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_workout_log_id_fkey
      FOREIGN KEY (workout_log_id) REFERENCES public.workout_log (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_log_activity_id_fkey'
  ) THEN
    ALTER TABLE public.workout_log
      ADD CONSTRAINT workout_log_activity_id_fkey
      FOREIGN KEY (activity_id) REFERENCES public.activities (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delete_activity_and_journal(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workout_log_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT workout_log_id INTO v_workout_log_id
  FROM public.activities
  WHERE id = p_activity_id AND user_id = v_user_id;

  DELETE FROM public.activities
  WHERE id = p_activity_id AND user_id = v_user_id;

  IF v_workout_log_id IS NOT NULL THEN
    DELETE FROM public.workout_log
    WHERE id = v_workout_log_id AND user_id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_activity_and_journal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_activity_and_journal TO authenticated;

CREATE OR REPLACE FUNCTION public.log_run_dual(
  p_date date,
  p_kcal_burned integer,
  p_distance_km numeric,
  p_duration_sec integer,
  p_pace_min_per_km numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workout_id uuid;
  v_activity_id uuid;
  v_name text;
  v_meta jsonb;
  v_sets jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_name := format(
    'Bieganie — %.2f km, %s min/km',
    p_distance_km,
    to_char(p_pace_min_per_km, 'FM9990.0')
  );

  v_meta := jsonb_build_object(
    'distance_km', p_distance_km,
    'duration_sec', p_duration_sec,
    'pace_min_per_km', p_pace_min_per_km,
    'type', 'running'
  );

  v_sets := jsonb_build_array(
    jsonb_build_object(
      'distance_km', p_distance_km,
      'duration_sec', p_duration_sec,
      'pace_min_per_km', p_pace_min_per_km,
      'series', 1
    )
  );

  INSERT INTO public.workout_log (
    user_id, date, exercise, category, sets, measurement_profile
  )
  VALUES (
    v_user_id, p_date, 'Bieganie', 'Cardio', v_sets, 'running'
  )
  RETURNING id INTO v_workout_id;

  INSERT INTO public.activities (
    user_id, date, name, kcal_burned, metadata, workout_log_id
  )
  VALUES (
    v_user_id, p_date, v_name, p_kcal_burned, v_meta, v_workout_id
  )
  RETURNING id INTO v_activity_id;

  UPDATE public.workout_log
  SET activity_id = v_activity_id
  WHERE id = v_workout_id AND user_id = v_user_id;

  RETURN v_activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_run_dual FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_run_dual TO authenticated;

CREATE OR REPLACE FUNCTION public.log_steps_dual(
  p_date date,
  p_steps integer,
  p_weight_kg numeric,
  p_kcal_burned integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workout_id uuid;
  v_activity_id uuid;
  v_name text;
  v_meta jsonb;
  v_sets jsonb;
  v_weight_label text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_weight_label := CASE
    WHEN p_weight_kg = trunc(p_weight_kg) THEN trunc(p_weight_kg)::text
    ELSE to_char(p_weight_kg, 'FM9990.0')
  END;

  v_name := format('Kroki — %s kroków (%s kg)', p_steps, v_weight_label);

  v_meta := jsonb_build_object(
    'steps', p_steps,
    'weight_kg', p_weight_kg,
    'type', 'steps'
  );

  v_sets := jsonb_build_array(
    jsonb_build_object(
      'steps', p_steps,
      'kcal_burned', p_kcal_burned,
      'series', 1
    )
  );

  INSERT INTO public.workout_log (
    user_id, date, exercise, category, sets, measurement_profile
  )
  VALUES (
    v_user_id, p_date, 'Kroki', 'Cardio', v_sets, 'steps'
  )
  RETURNING id INTO v_workout_id;

  INSERT INTO public.activities (
    user_id, date, name, kcal_burned, metadata, workout_log_id
  )
  VALUES (
    v_user_id, p_date, v_name, p_kcal_burned, v_meta, v_workout_id
  )
  RETURNING id INTO v_activity_id;

  UPDATE public.workout_log
  SET activity_id = v_activity_id
  WHERE id = v_workout_id AND user_id = v_user_id;

  RETURN v_activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_steps_dual FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_steps_dual TO authenticated;

CREATE OR REPLACE FUNCTION public.log_manual_activity_dual(
  p_date date,
  p_name text,
  p_kcal_burned integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workout_id uuid;
  v_activity_id uuid;
  v_meta jsonb;
  v_sets jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_meta := jsonb_build_object('type', 'manual');
  v_sets := jsonb_build_array(
    jsonb_build_object('kcal_burned', p_kcal_burned, 'series', 1)
  );

  INSERT INTO public.workout_log (
    user_id, date, exercise, category, sets, measurement_profile
  )
  VALUES (
    v_user_id, p_date, p_name, 'Aktywność', v_sets, 'cardio_manual'
  )
  RETURNING id INTO v_workout_id;

  INSERT INTO public.activities (
    user_id, date, name, kcal_burned, metadata, workout_log_id
  )
  VALUES (
    v_user_id, p_date, p_name, p_kcal_burned, v_meta, v_workout_id
  )
  RETURNING id INTO v_activity_id;

  UPDATE public.workout_log
  SET activity_id = v_activity_id
  WHERE id = v_workout_id AND user_id = v_user_id;

  RETURN v_activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_manual_activity_dual FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_manual_activity_dual TO authenticated;
