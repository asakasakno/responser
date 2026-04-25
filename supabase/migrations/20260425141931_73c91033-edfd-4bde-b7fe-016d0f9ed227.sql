-- Function to sync profiles.max_energy with subscriptions.plan
CREATE OR REPLACE FUNCTION public.sync_max_energy_from_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_max integer;
BEGIN
  _new_max := CASE NEW.plan::text
    WHEN 'pro' THEN 2000
    WHEN 'basic' THEN 500
    ELSE 100
  END;

  UPDATE public.profiles
    SET max_energy = _new_max,
        updated_at = now()
  WHERE user_id = NEW.user_id
    AND max_energy IS DISTINCT FROM _new_max;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_max_energy_insert ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_sync_max_energy_update ON public.subscriptions;

CREATE TRIGGER trg_sync_max_energy_insert
AFTER INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_max_energy_from_plan();

CREATE TRIGGER trg_sync_max_energy_update
AFTER UPDATE OF plan ON public.subscriptions
FOR EACH ROW
WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
EXECUTE FUNCTION public.sync_max_energy_from_plan();

-- Backfill: align existing profiles with current active plan
UPDATE public.profiles p
SET max_energy = CASE s.plan::text
    WHEN 'pro' THEN 2000
    WHEN 'basic' THEN 500
    ELSE 100
  END,
  updated_at = now()
FROM public.subscriptions s
WHERE s.user_id = p.user_id
  AND s.status = 'active'
  AND p.max_energy IS DISTINCT FROM CASE s.plan::text
    WHEN 'pro' THEN 2000
    WHEN 'basic' THEN 500
    ELSE 100
  END;