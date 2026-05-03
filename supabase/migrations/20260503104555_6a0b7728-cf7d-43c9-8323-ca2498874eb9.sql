
-- ============================================================
-- 1) AI response cache table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  response text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expire_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expire ON public.ai_response_cache(expire_at);
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_user_key ON public.ai_response_cache(user_id, cache_key);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own cache" ON public.ai_response_cache;
CREATE POLICY "Users view own cache" ON public.ai_response_cache
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all cache" ON public.ai_response_cache;
CREATE POLICY "Admins view all cache" ON public.ai_response_cache
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2) Per-plan rate limiting RPC (minute + day window)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_plan_rate_limit(_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan text;
  _per_min integer;
  _per_day integer;
  _min_count integer;
  _day_count integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Unauthorized');
  END IF;

  SELECT plan::text INTO _plan
  FROM subscriptions
  WHERE user_id = _uid AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;
  _plan := COALESCE(_plan, 'free');

  -- Defaults per plan
  IF _plan = 'pro' THEN
    _per_min := 30; _per_day := 1000;
  ELSIF _plan = 'basic' THEN
    _per_min := 10; _per_day := 200;
  ELSE
    _per_min := 3; _per_day := 20;
  END IF;

  SELECT COUNT(*) INTO _min_count
  FROM audit_logs
  WHERE user_id = _uid AND action = _action AND created_at > now() - interval '1 minute';

  IF _min_count >= _per_min THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'limit', _per_min, 'plan', _plan);
  END IF;

  SELECT COUNT(*) INTO _day_count
  FROM audit_logs
  WHERE user_id = _uid AND action = _action AND created_at > now() - interval '1 day';

  IF _day_count >= _per_day THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'day', 'limit', _per_day, 'plan', _plan);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'plan', _plan, 'minute_used', _min_count, 'day_used', _day_count);
END;
$$;

REVOKE ALL ON FUNCTION public.check_plan_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_plan_rate_limit(text) TO authenticated, service_role;

-- ============================================================
-- 3) Refund energy RPC (caller-bound; for AI failure rollback)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_energy(_amount integer, _reason text, _description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
  _target uuid;
BEGIN
  -- Allow service_role to pass NULL caller; require auth otherwise
  IF NOT _is_service AND _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  _target := _uid;
  IF _target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No target user');
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR _amount > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  INSERT INTO energy_grants (user_id, amount, remaining, source, reason, description, expire_at)
  VALUES (_target, _amount, _amount, 'refund', _reason, _description, NULL);

  UPDATE profiles SET energy_balance = get_energy_balance(_target) WHERE user_id = _target;

  INSERT INTO energy_transactions (user_id, type, amount, reason, description)
  VALUES (_target, 'earn', _amount, 'refund_' || _reason, COALESCE(_description, '실패 환불'));

  RETURN jsonb_build_object('success', true, 'balance', get_energy_balance(_target));
END;
$$;

REVOKE ALL ON FUNCTION public.refund_energy(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_energy(integer, text, text) TO authenticated, service_role;

-- ============================================================
-- 4) Cleanup jobs (audit_logs > 30 days, ai_response_cache expired)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  WITH d AS (
    DELETE FROM audit_logs
    WHERE created_at < now() - interval '30 days'
      AND severity NOT IN ('critical')
    RETURNING 1
  )
  SELECT COUNT(*) INTO _n FROM d;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_ai_response_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  WITH d AS (
    DELETE FROM ai_response_cache WHERE expire_at < now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO _n FROM d;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_ai_response_cache() FROM PUBLIC, anon, authenticated;

-- Schedule cron jobs (pg_cron already enabled previously)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-audit-logs-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-ai-cache-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '20 3 * * *',
  $$ SELECT public.cleanup_old_audit_logs(); $$
);

SELECT cron.schedule(
  'cleanup-ai-cache-daily',
  '30 3 * * *',
  $$ SELECT public.cleanup_ai_response_cache(); $$
);
