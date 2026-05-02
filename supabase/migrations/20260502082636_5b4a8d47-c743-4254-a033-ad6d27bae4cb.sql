-- 1) Admin energy spend (FIFO across energy_grants)
CREATE OR REPLACE FUNCTION public.admin_spend_energy(
  _user_id uuid,
  _amount integer,
  _reason text,
  _description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance integer;
  _need integer := _amount;
  _take integer;
  _grant record;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.admin_spend_energy(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
-- only service_role / SECURITY DEFINER callers via edge function

-- 2) Coupon energy reward fields
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS reward_energy integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_energy_expire_days integer;

-- Allow new target_type 'reward' (energy-only coupon, no purchase needed)
-- target_type column has no CHECK constraint (free text), so nothing to alter.

-- 3) Public RPC for users to redeem an energy-reward coupon (no payment flow)
CREATE OR REPLACE FUNCTION public.redeem_energy_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _c record;
  _used_count integer;
  _result jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '로그인이 필요합니다.');
  END IF;

  SELECT * INTO _c FROM coupons WHERE coupon_code = LOWER(TRIM(_code)) FOR UPDATE;
  IF _c IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '사용할 수 없는 코드입니다.');
  END IF;
  IF NOT _c.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', '비활성화된 코드입니다.');
  END IF;
  IF COALESCE(_c.reward_energy, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '에너지 지급용 코드가 아닙니다.');
  END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN
    RETURN jsonb_build_object('success', false, 'error', '아직 사용할 수 없는 코드입니다.');
  END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', '만료된 코드입니다.');
  END IF;
  IF _c.max_total_uses IS NOT NULL AND _c.total_uses >= _c.max_total_uses THEN
    RETURN jsonb_build_object('success', false, 'error', '사용 가능한 횟수가 모두 소진되었습니다.');
  END IF;

  SELECT COUNT(*) INTO _used_count FROM coupon_usages
    WHERE coupon_id = _c.id AND user_id = _user_id;
  IF _used_count >= _c.max_use_per_user THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 사용한 코드입니다.');
  END IF;

  -- Grant energy
  SELECT public.earn_energy(
    _user_id,
    _c.reward_energy,
    'coupon_' || _c.coupon_code,
    COALESCE(_c.coupon_name, '쿠폰 보상'),
    'reward',
    _c.reward_energy_expire_days
  ) INTO _result;

  -- Record usage (no money involved)
  INSERT INTO coupon_usages (coupon_id, user_id, billing_order_id, original_amount, discount_amount, final_amount, target_type)
  VALUES (_c.id, _user_id, NULL, 0, 0, 0, 'reward');

  UPDATE coupons SET total_uses = total_uses + 1 WHERE id = _c.id;

  RETURN jsonb_build_object('success', true, 'energy', _c.reward_energy, 'detail', _result);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_energy_coupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_energy_coupon(text) TO authenticated;
