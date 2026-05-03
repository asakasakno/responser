-- 1) Defense-in-depth: admin_spend_energy must verify caller is admin OR service_role
CREATE OR REPLACE FUNCTION public.admin_spend_energy(_user_id uuid, _amount integer, _reason text, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _balance integer;
  _need integer := _amount;
  _take integer;
  _grant record;
  _caller uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
BEGIN
  IF NOT _is_service AND (_caller IS NULL OR NOT public.has_role(_caller, 'admin'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid params');
  END IF;

  PERFORM expire_energy_grants(_user_id);
  SELECT get_energy_balance(_user_id) INTO _balance;
  IF _balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient energy', 'balance', _balance);
  END IF;

  FOR _grant IN
    SELECT id, remaining
    FROM energy_grants
    WHERE user_id = _user_id AND remaining > 0
    ORDER BY (expire_at IS NULL), expire_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN _need <= 0;
    _take := LEAST(_grant.remaining, _need);
    UPDATE energy_grants SET remaining = remaining - _take WHERE id = _grant.id;
    _need := _need - _take;
  END LOOP;

  UPDATE profiles SET energy_balance = get_energy_balance(_user_id) WHERE user_id = _user_id;

  INSERT INTO energy_transactions (user_id, type, amount, reason, description)
  VALUES (_user_id, 'spend', _amount, _reason, _description);

  RETURN jsonb_build_object('success', true, 'balance', get_energy_balance(_user_id), 'spent', _amount);
END;
$function$;

-- 2) Revoke EXECUTE from anon/authenticated/public on internal-only functions.
--    service_role bypasses these grants and can still call them from edge functions.

DO $$
DECLARE
  _fn text;
  _funcs text[] := ARRAY[
    'public.earn_energy(uuid,integer,text,text,text,integer)',
    'public.earn_energy(uuid,integer,text,text)',
    'public.admin_spend_energy(uuid,integer,text,text)',
    'public.consume_coupon(uuid,uuid,integer,integer,integer,text,text)',
    'public.grant_referral_payment_bonus(uuid)',
    'public.expire_energy_grants(uuid)',
    'public.enqueue_email(text,jsonb)',
    'public.read_email_batch(text,integer,integer)',
    'public.delete_email(text,bigint)',
    'public.move_to_dlq(text,text,bigint,jsonb)',
    'public.check_rate_limit(uuid,text,integer)'
  ];
BEGIN
  FOREACH _fn IN ARRAY _funcs LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function % not found, skipping', _fn;
    END;
  END LOOP;
END $$;