
-- 1. payments 확장
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount integer,
  ADD COLUMN IF NOT EXISTS refund_status text,
  ADD COLUMN IF NOT EXISTS refund_note text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS source_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON public.payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_refund_status
  ON public.payments(refund_status) WHERE refund_status IS NOT NULL;

-- 2. energy_grants source_ref (결제 추적용)
ALTER TABLE public.energy_grants
  ADD COLUMN IF NOT EXISTS source_ref text;
CREATE INDEX IF NOT EXISTS idx_energy_grants_source_ref
  ON public.energy_grants(source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_energy_grants_user_created
  ON public.energy_grants(user_id, created_at DESC);

-- 3. admin_anomalies
CREATE TABLE IF NOT EXISTS public.admin_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'warning',
  dedupe_key text UNIQUE,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomalies_kind_resolved
  ON public.admin_anomalies(kind, resolved_at);
CREATE INDEX IF NOT EXISTS idx_anomalies_created
  ON public.admin_anomalies(created_at DESC);

ALTER TABLE public.admin_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view anomalies" ON public.admin_anomalies;
CREATE POLICY "Admins view anomalies" ON public.admin_anomalies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. 중복 결제 탐지 (같은 user + amount + product_name 60초 내 ≥2)
CREATE OR REPLACE FUNCTION public.detect_duplicate_payments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inserted integer := 0;
  _r record;
  _key text;
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
    GET DIAGNOSTICS _inserted = ROW_COUNT;
  END LOOP;
  RETURN _inserted;
END $$;

-- 5. 크레딧 미지급 탐지 (success payment 후 ±5분 내 같은 user에게 grant 없음)
CREATE OR REPLACE FUNCTION public.detect_missing_credits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inserted integer := 0;
  _p record;
  _grant_count integer;
  _key text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR _p IN
    SELECT id, user_id, amount, product_name, created_at, source_ref
    FROM public.payments
    WHERE status = 'success'
      AND created_at > now() - interval '7 days'
      AND created_at < now() - interval '5 minutes'
  LOOP
    -- source_ref 있으면 그것으로, 없으면 시간창으로 판정
    IF _p.source_ref IS NOT NULL THEN
      SELECT count(*) INTO _grant_count FROM public.energy_grants
      WHERE source_ref = _p.source_ref;
    ELSE
      SELECT count(*) INTO _grant_count FROM public.energy_grants
      WHERE user_id = _p.user_id
        AND source IN ('subscription','purchase','admin')
        AND created_at BETWEEN _p.created_at - interval '5 minutes'
                           AND _p.created_at + interval '5 minutes';
    END IF;

    IF _grant_count = 0 THEN
      _key := 'miss_credit:' || _p.id::text;
      INSERT INTO public.admin_anomalies(kind, user_id, payload, severity, dedupe_key)
      VALUES ('missing_credit', _p.user_id,
              jsonb_build_object('payment_id', _p.id, 'amount', _p.amount,
                                 'product_name', _p.product_name,
                                 'paid_at', _p.created_at,
                                 'source_ref', _p.source_ref),
              'critical', _key)
      ON CONFLICT (dedupe_key) DO NOTHING;
      _inserted := _inserted + 1;
    END IF;
  END LOOP;
  RETURN _inserted;
END $$;

-- 6. 환불 실패 탐지
CREATE OR REPLACE FUNCTION public.detect_refund_failures()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _inserted integer := 0; _p record; _key text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR _p IN
    SELECT id, user_id, amount, refund_amount, failure_reason, refund_status, created_at
    FROM public.payments
    WHERE refund_status = 'failed' AND created_at > now() - interval '90 days'
  LOOP
    _key := 'refund_fail:' || _p.id::text;
    INSERT INTO public.admin_anomalies(kind, user_id, payload, severity, dedupe_key)
    VALUES ('refund_failed', _p.user_id,
            jsonb_build_object('payment_id', _p.id, 'amount', _p.amount,
                               'refund_amount', _p.refund_amount,
                               'failure_reason', _p.failure_reason),
            'warning', _key)
    ON CONFLICT (dedupe_key) DO NOTHING;
    _inserted := _inserted + 1;
  END LOOP;
  RETURN _inserted;
END $$;

-- 7. 이상 사용량 탐지 (지난 1시간 spend가 평소 시간당 평균의 5배 초과)
CREATE OR REPLACE FUNCTION public.detect_abnormal_usage()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _inserted integer := 0; _r record; _key text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR _r IN
    WITH last_hour AS (
      SELECT user_id, sum(amount) AS hr_spend
      FROM public.energy_transactions
      WHERE type = 'spend' AND created_at > now() - interval '1 hour'
      GROUP BY user_id
    ),
    baseline AS (
      SELECT user_id,
             COALESCE(sum(amount), 0)::numeric / GREATEST(extract(epoch from interval '14 days')/3600, 1) AS hr_avg
      FROM public.energy_transactions
      WHERE type = 'spend'
        AND created_at BETWEEN now() - interval '14 days' AND now() - interval '1 hour'
      GROUP BY user_id
    )
    SELECT lh.user_id, lh.hr_spend, COALESCE(b.hr_avg, 0) AS hr_avg
    FROM last_hour lh
    LEFT JOIN baseline b ON b.user_id = lh.user_id
    WHERE lh.hr_spend >= 50
      AND (b.hr_avg IS NULL OR lh.hr_spend > b.hr_avg * 5)
  LOOP
    _key := 'abuse:' || _r.user_id || ':' || to_char(now(), 'YYYY-MM-DD-HH24');
    INSERT INTO public.admin_anomalies(kind, user_id, payload, severity, dedupe_key)
    VALUES ('abnormal_usage', _r.user_id,
            jsonb_build_object('hour_spend', _r.hr_spend, 'hour_avg', round(_r.hr_avg, 2)),
            'warning', _key)
    ON CONFLICT (dedupe_key) DO NOTHING;
    _inserted := _inserted + 1;
  END LOOP;
  RETURN _inserted;
END $$;

-- 8. 통합 스캔
CREATE OR REPLACE FUNCTION public.run_admin_anomaly_scan()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _dup int; _miss int; _ref int; _abu int;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  _dup := public.detect_duplicate_payments();
  _miss := public.detect_missing_credits();
  _ref := public.detect_refund_failures();
  _abu := public.detect_abnormal_usage();
  RETURN jsonb_build_object('duplicate_payment', _dup, 'missing_credit', _miss,
                            'refund_failed', _ref, 'abnormal_usage', _abu,
                            'scanned_at', now());
END $$;

-- 9. 환불 시 부분 회수 (마이너스 금지, 부족분 anomaly 기록)
CREATE OR REPLACE FUNCTION public.admin_partial_recover_energy(
  _user_id uuid, _requested integer, _payment_id uuid, _reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _balance integer;
  _to_take integer;
  _shortfall integer;
  _result jsonb;
  _key text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;
  IF _requested IS NULL OR _requested <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  PERFORM public.expire_energy_grants(_user_id);
  SELECT public.get_energy_balance(_user_id) INTO _balance;
  _to_take := LEAST(_balance, _requested);
  _shortfall := _requested - _to_take;

  IF _to_take > 0 THEN
    SELECT public.admin_spend_energy(_user_id, _to_take, 'refund_recovery',
      COALESCE(_reason, '환불 회수') || COALESCE(' (payment '|| _payment_id::text ||')', '')) INTO _result;
  ELSE
    _result := jsonb_build_object('success', true, 'balance', _balance, 'spent', 0);
  END IF;

  IF _shortfall > 0 THEN
    _key := 'partial_recovery:' || COALESCE(_payment_id::text, _user_id::text) || ':' || extract(epoch from now())::bigint;
    INSERT INTO public.admin_anomalies(kind, user_id, payload, severity, dedupe_key)
    VALUES ('partial_recovery_needed', _user_id,
            jsonb_build_object('payment_id', _payment_id, 'requested', _requested,
                               'recovered', _to_take, 'shortfall', _shortfall,
                               'reason', _reason),
            'warning', _key)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'requested', _requested,
                            'recovered', _to_take, 'shortfall', _shortfall,
                            'balance', public.get_energy_balance(_user_id),
                            'detail', _result);
END $$;

-- 10. anomaly resolve
CREATE OR REPLACE FUNCTION public.admin_resolve_anomaly(
  _anomaly_id uuid, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;
  IF _note IS NULL OR length(_note) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason required (>=5 chars)');
  END IF;
  UPDATE public.admin_anomalies
    SET resolved_at = now(), resolved_by = auth.uid(), resolution_note = _note
    WHERE id = _anomaly_id AND resolved_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved or not found');
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;
