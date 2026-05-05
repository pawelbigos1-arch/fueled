-- Uruchom w Supabase → SQL Editor (po utworzeniu user_profiles + RLS „own profile”).
-- Bez tego licznik 👥 z klienta widzi tylko własny wiersz przez RLS (zwykle count = 1).

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
