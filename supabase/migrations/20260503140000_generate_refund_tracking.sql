CREATE TABLE IF NOT EXISTS public.generate_refund_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  refunded boolean NOT NULL DEFAULT false,
  refund_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generate_refund_attempts_user_created
  ON public.generate_refund_attempts(user_id, created_at DESC);

ALTER TABLE public.generate_refund_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own generate refund attempts" ON public.generate_refund_attempts;
CREATE POLICY "Users view own generate refund attempts"
  ON public.generate_refund_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all generate refund attempts" ON public.generate_refund_attempts;
CREATE POLICY "Admins view all generate refund attempts"
  ON public.generate_refund_attempts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_generate_refund_attempts_updated_at
BEFORE UPDATE ON public.generate_refund_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.try_claim_generate_refund(_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO generate_refund_attempts (reservation_id, user_id, refunded)
  VALUES (_reservation_id, _uid, false)
  ON CONFLICT (reservation_id) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'claimed', (_inserted > 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_generate_refund(
  _reservation_id uuid,
  _refunded boolean,
  _refund_error text DEFAULT NULL
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

  UPDATE generate_refund_attempts
  SET refunded = _refunded,
      refund_error = _refund_error
  WHERE reservation_id = _reservation_id
    AND user_id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- extend completion status set for reservation lifecycle traceability
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
  SET status = CASE WHEN _status IN ('success', 'failed', 'failed_timeout', 'failed_refund') THEN _status ELSE 'failed' END,
      error_code = _error_code
  WHERE id = _reservation_id
    AND user_id = _uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.try_claim_generate_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_claim_generate_refund(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_generate_refund(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_generate_refund(uuid, boolean, text) TO authenticated, service_role;
