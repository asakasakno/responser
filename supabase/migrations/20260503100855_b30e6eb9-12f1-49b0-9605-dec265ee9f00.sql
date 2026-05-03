CREATE OR REPLACE FUNCTION public.spend_energy(_amount integer, _reason text, _description text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _balance integer;
  _need integer := _amount;
  _take integer;
  _grant record;
  _recent_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
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

  -- Merge with a recent transaction (same reason/description, within 60s) if it exists
  SELECT id INTO _recent_id
  FROM energy_transactions
  WHERE user_id = _user_id
    AND type = 'spend'
    AND reason = _reason
    AND COALESCE(description, '') = COALESCE(_description, '')
    AND created_at > now() - interval '60 seconds'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _recent_id IS NOT NULL THEN
    UPDATE energy_transactions
      SET amount = amount + _amount,
          created_at = now()
    WHERE id = _recent_id;
  ELSE
    INSERT INTO energy_transactions (user_id, type, amount, reason, description)
    VALUES (_user_id, 'spend', _amount, _reason, _description);
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', get_energy_balance(_user_id), 'spent', _amount);
END;
$function$;