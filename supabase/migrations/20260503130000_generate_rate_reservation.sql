CREATE TABLE IF NOT EXISTS public.generate_request_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | success | failed
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generate_reservation_user_created
  ON public.generate_request_reservations(user_id, created_at DESC);

ALTER TABLE public.generate_request_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own generate reservations" ON public.generate_request_reservations;
CREATE POLICY "Users view own generate reservations"
  ON public.generate_request_reservations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all generate reservations" ON public.generate_request_reservations;
CREATE POLICY "Admins view all generate reservations"
  ON public.generate_request_reservations
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_generate_request_reservations_updated_at
BEFORE UPDATE ON public.generate_request_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.reserve_generate_request(
  _max_per_second integer,
  _per_min integer,
  _per_day integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sec_count integer;
  _min_count integer;
  _day_count integer;
  _reservation_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Unauthorized');
  END IF;

  -- Per-user atomic gate for concurrent requests
  PERFORM pg_advisory_xact_lock(hashtext(_uid::text || ':generate'));

  SELECT COUNT(*) INTO _sec_count
  FROM generate_request_reservations
  WHERE user_id = _uid
    AND created_at > now() - interval '1 second';
  IF _sec_count >= _max_per_second THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'burst', 'limit', _max_per_second);
  END IF;

  SELECT COUNT(*) INTO _min_count
  FROM generate_request_reservations
  WHERE user_id = _uid
    AND created_at > now() - interval '1 minute';
  IF _min_count >= _per_min THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'limit', _per_min);
  END IF;

  SELECT COUNT(*) INTO _day_count
  FROM generate_request_reservations
  WHERE user_id = _uid
    AND created_at > now() - interval '1 day';
  IF _day_count >= _per_day THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'day', 'limit', _per_day);
  END IF;

  INSERT INTO generate_request_reservations (user_id, status)
  VALUES (_uid, 'pending')
  RETURNING id INTO _reservation_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reservation_id', _reservation_id,
    'minute_used', _min_count + 1,
    'day_used', _day_count + 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_generate_request(
  _reservation_id uuid,
  _status text,
  _error_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE generate_request_reservations
  SET status = CASE WHEN _status IN ('success', 'failed') THEN _status ELSE 'failed' END,
      error_code = _error_code
  WHERE id = _reservation_id
    AND user_id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_generate_request(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_generate_request(integer, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_generate_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_generate_request(uuid, text, text) TO authenticated, service_role;
