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

  PERFORM pg_advisory_xact_lock(hashtext(_uid::text || ':generate'));

  -- stale pending timeout 처리 (5분 초과)
  UPDATE generate_request_reservations
  SET status = 'failed_timeout',
      error_code = COALESCE(error_code, 'timeout')
  WHERE user_id = _uid
    AND status = 'pending'
    AND created_at <= now() - interval '5 minutes';

  -- 1초/1분: 최신 pending(5분 이내) + 완료(success/failed/failed_timeout) 포함
  SELECT COUNT(*) INTO _sec_count
  FROM generate_request_reservations
  WHERE user_id = _uid
    AND created_at > now() - interval '1 second'
    AND (
      status <> 'pending'
      OR created_at > now() - interval '5 minutes'
    );
  IF _sec_count >= _max_per_second THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'burst', 'limit', _max_per_second);
  END IF;

  SELECT COUNT(*) INTO _min_count
  FROM generate_request_reservations
  WHERE user_id = _uid
    AND created_at > now() - interval '1 minute'
    AND (
      status <> 'pending'
      OR created_at > now() - interval '5 minutes'
    );
  IF _min_count >= _per_min THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'limit', _per_min);
  END IF;

  -- 1일: stale pending(5분 초과) 제외, 완료 요청은 유지
  SELECT COUNT(*) INTO _day_count
  FROM generate_request_reservations
  WHERE user_id = _uid
    AND created_at > now() - interval '1 day'
    AND (
      status <> 'pending'
      OR created_at > now() - interval '5 minutes'
    );
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
  SET status = CASE WHEN _status IN ('success', 'failed', 'failed_timeout') THEN _status ELSE 'failed' END,
      error_code = _error_code
  WHERE id = _reservation_id
    AND user_id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_generate_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  WITH u AS (
    UPDATE generate_request_reservations
    SET status = 'failed_timeout',
        error_code = COALESCE(error_code, 'timeout')
    WHERE status = 'pending'
      AND created_at <= now() - interval '5 minutes'
    RETURNING 1
  )
  SELECT COUNT(*) INTO _n FROM u;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_generate_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_generate_reservations() TO service_role;
