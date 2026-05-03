CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_old_energy_transactions_global()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _deleted integer;
BEGIN
  WITH d AS (
    DELETE FROM public.energy_transactions
    WHERE created_at < (now() - interval '90 days')
    RETURNING 1
  )
  SELECT COUNT(*) INTO _deleted FROM d;
  RETURN _deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_energy_transactions_global() FROM PUBLIC, anon, authenticated;

-- Remove old per-user client cleanup function (no longer needed)
DROP FUNCTION IF EXISTS public.cleanup_old_energy_transactions();

-- Schedule daily at 03:10 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-energy-transactions-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-energy-transactions-daily',
  '10 3 * * *',
  $$ SELECT public.cleanup_old_energy_transactions_global(); $$
);