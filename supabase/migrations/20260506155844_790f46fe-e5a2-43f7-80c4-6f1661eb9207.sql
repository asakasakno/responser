
-- ============================================================
-- 1) Reservations + Refund attempts tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generate_request_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'generate',
  status text NOT NULL DEFAULT 'pending',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_grr_user_status_created
  ON public.generate_request_reservations(user_id, status, created_at DESC);

ALTER TABLE public.generate_request_reservations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generate_request_reservations' AND policyname='Admins view reservations') THEN
    CREATE POLICY "Admins view reservations" ON public.generate_request_reservations
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.generate_refund_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  refunded boolean NOT NULL DEFAULT false,
  refund_error text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gra_user_created
  ON public.generate_refund_attempts(user_id, claimed_at DESC);

ALTER TABLE public.generate_refund_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generate_refund_attempts' AND policyname='Admins view refund attempts') THEN
    CREATE POLICY "Admins view refund attempts" ON public.generate_refund_attempts
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ============================================================
-- 2) reserve_generate_request
--    Stale pending(>5min) is treated as failed_timeout and excluded
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_generate_request(
  _max_per_second integer DEFAULT 2,
  _per_min integer DEFAULT 30,
  _per_day integer DEFAULT 1000
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _sec integer; _min integer; _day integer;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  END IF;

  -- Sweep stale pending older than 5 minutes
  UPDATE public.generate_request_reservations
     SET status = 'failed_timeout',
         error_code = COALESCE(error_code, 'stale_timeout'),
         completed_at = COALESCE(completed_at, now())
   WHERE user_id = _uid
     AND status = 'pending'
     AND created_at < now() - interval '5 minutes';

  -- Per-second
  SELECT COUNT(*) INTO _sec
    FROM public.generate_request_reservations
   WHERE user_id = _uid
     AND created_at > now() - interval '1 second'
     AND (status <> 'pending' OR created_at > now() - interval '5 minutes');
  IF _sec >= GREATEST(_max_per_second, 1) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'second', 'limit', _max_per_second);
  END IF;

  -- Per-minute
  SELECT COUNT(*) INTO _min
    FROM public.generate_request_reservations
   WHERE user_id = _uid
     AND created_at > now() - interval '1 minute'
     AND (status <> 'pending' OR created_at > now() - interval '5 minutes');
  IF _min >= _per_min THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'limit', _per_min);
  END IF;

  -- Per-day (count successful + active pending)
  SELECT COUNT(*) INTO _day
    FROM public.generate_request_reservations
   WHERE user_id = _uid
     AND created_at > now() - interval '1 day'
     AND (status = 'success' OR (status = 'pending' AND created_at > now() - interval '5 minutes'));
  IF _day >= _per_day THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'day', 'limit', _per_day);
  END IF;

  INSERT INTO public.generate_request_reservations(user_id, action, status)
  VALUES (_uid, 'generate', 'pending')
  RETURNING id INTO _new_id;

  RETURN jsonb_build_object('allowed', true, 'reservation_id', _new_id);
END $function$;

REVOKE ALL ON FUNCTION public.reserve_generate_request(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_generate_request(integer, integer, integer) TO authenticated, service_role;

-- ============================================================
-- 3) complete_generate_request
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_generate_request(
  _reservation_id uuid,
  _status text,
  _error_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
BEGIN
  IF NOT _is_service AND _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF _status NOT IN ('success','failed','failed_timeout','failed_refund') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.generate_request_reservations
     SET status = _status,
         error_code = _error_code,
         completed_at = now()
   WHERE id = _reservation_id
     AND (_is_service OR user_id = _uid)
     AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_pending_or_not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END $function$;

REVOKE ALL ON FUNCTION public.complete_generate_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_generate_request(uuid, text, text) TO authenticated, service_role;

-- ============================================================
-- 4) try_claim_generate_refund (idempotent insert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.try_claim_generate_refund(
  _reservation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
  _owner uuid;
BEGIN
  IF NOT _is_service AND _uid IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'unauthorized');
  END IF;

  SELECT user_id INTO _owner
    FROM public.generate_request_reservations
   WHERE id = _reservation_id;
  IF _owner IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'reservation_not_found');
  END IF;
  IF NOT _is_service AND _owner <> _uid THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'forbidden');
  END IF;

  BEGIN
    INSERT INTO public.generate_refund_attempts(reservation_id, user_id)
    VALUES (_reservation_id, _owner);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('claimed', false, 'error', 'already_claimed');
  END;

  RETURN jsonb_build_object('claimed', true);
END $function$;

REVOKE ALL ON FUNCTION public.try_claim_generate_refund(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_claim_generate_refund(uuid) TO authenticated, service_role;

-- ============================================================
-- 5) complete_generate_refund
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_generate_refund(
  _reservation_id uuid,
  _refunded boolean,
  _refund_error text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
BEGIN
  IF NOT _is_service AND _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.generate_refund_attempts
     SET refunded = _refunded,
         refund_error = _refund_error,
         completed_at = now()
   WHERE reservation_id = _reservation_id
     AND (_is_service OR user_id = _uid);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'attempt_not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END $function$;

REVOKE ALL ON FUNCTION public.complete_generate_refund(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_generate_refund(uuid, boolean, text) TO authenticated, service_role;

-- ============================================================
-- 6) Fix detect_duplicate_payments counting bug
-- ============================================================
CREATE OR REPLACE FUNCTION public.detect_duplicate_payments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _inserted integer := 0;
  _r record;
  _key text;
  _row_count integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR _r IN
    SELECT p1.user_id, p1.amount, p1.product_name,
           array_agg(p1.id ORDER BY p1.created_at) AS ids,
           min(p1.created_at) AS first_at, max(p1.created_at) AS last_at,
           count(*) AS cnt
    FROM public.payments p1
    WHERE p1.status = 'success' AND p1.created_at > now() - interval '30 days'
    GROUP BY p1.user_id, p1.amount, p1.product_name,
             date_trunc('minute', p1.created_at)
    HAVING count(*) >= 2
       AND (max(p1.created_at) - min(p1.created_at)) < interval '60 seconds'
  LOOP
    _key := 'dup_pay:' || _r.user_id || ':' || _r.amount || ':' || _r.first_at::text;
    INSERT INTO public.admin_anomalies(kind, user_id, payload, severity, dedupe_key)
    VALUES ('duplicate_payment', _r.user_id,
            jsonb_build_object('payment_ids', _r.ids, 'amount', _r.amount,
                               'product_name', _r.product_name, 'count', _r.cnt,
                               'first_at', _r.first_at, 'last_at', _r.last_at),
            'critical', _key)
    ON CONFLICT (dedupe_key) DO NOTHING;
    GET DIAGNOSTICS _row_count = ROW_COUNT;
    _inserted := _inserted + COALESCE(_row_count, 0);
  END LOOP;
  RETURN _inserted;
END $function$;

-- ============================================================
-- 7) Idempotency partial unique index for payments
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
