CREATE OR REPLACE FUNCTION public.cleanup_old_energy_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _deleted integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH d AS (
    DELETE FROM public.energy_transactions
    WHERE user_id = _user_id
      AND created_at < (now() - interval '90 days')
    RETURNING 1
  )
  SELECT COUNT(*) INTO _deleted FROM d;

  RETURN _deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_energy_transactions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_energy_transactions() TO authenticated;