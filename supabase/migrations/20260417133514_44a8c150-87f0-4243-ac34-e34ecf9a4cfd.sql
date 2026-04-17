
-- 1. energy_grants: 모든 에너지 지급/구매를 만료일과 함께 추적
CREATE TABLE public.energy_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  remaining integer NOT NULL CHECK (remaining >= 0),
  source text NOT NULL, -- 'subscription' | 'purchase' | 'reward' | 'referral' | 'signup' | 'admin'
  reason text NOT NULL,
  description text,
  expire_at timestamptz, -- NULL = 무기한 (구독/구매분)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_energy_grants_user_active ON public.energy_grants(user_id, expire_at) WHERE remaining > 0;

ALTER TABLE public.energy_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own grants" ON public.energy_grants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all grants" ON public.energy_grants
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. energy_packs: 추가 구매 상품 정의
CREATE TABLE public.energy_packs (
  id text PRIMARY KEY,
  energy integer NOT NULL,
  price integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.energy_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active packs" ON public.energy_packs FOR SELECT USING (active = true);

INSERT INTO public.energy_packs (id, energy, price, sort_order) VALUES
  ('pack_10', 10, 2900, 1),
  ('pack_50', 50, 9900, 2),
  ('pack_100', 100, 17900, 3),
  ('pack_300', 300, 39900, 4);

-- 3. reward_claims: 보상 중복 지급 방지
CREATE TABLE public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_key text NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_key)
);
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own claims" ON public.reward_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all claims" ON public.reward_claims FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. subscriptions에 billing_cycle 추가
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly'));

-- 5. referrals 보강: 결제 시 추가 보상 지급 추적
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS payment_reward_given boolean NOT NULL DEFAULT false;

-- 6. 만료된 grant 정리 함수 (사용 시 lazy 호출)
CREATE OR REPLACE FUNCTION public.expire_energy_grants(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE energy_grants
    SET remaining = 0
  WHERE user_id = _user_id
    AND remaining > 0
    AND expire_at IS NOT NULL
    AND expire_at < now();
END;
$$;

-- 7. 사용자 활성 에너지 합계
CREATE OR REPLACE FUNCTION public.get_energy_balance(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _total integer;
BEGIN
  SELECT COALESCE(SUM(remaining), 0) INTO _total
  FROM energy_grants
  WHERE user_id = _user_id
    AND remaining > 0
    AND (expire_at IS NULL OR expire_at > now());
  RETURN _total;
END;
$$;

-- 8. spend_energy 재작성: grant FIFO (만료 임박 우선)로 차감
CREATE OR REPLACE FUNCTION public.spend_energy(_amount integer, _reason text, _description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _balance integer;
  _need integer := _amount;
  _take integer;
  _grant record;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 만료 처리
  PERFORM expire_energy_grants(_user_id);

  SELECT get_energy_balance(_user_id) INTO _balance;
  IF _balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient energy', 'balance', _balance);
  END IF;

  -- 만료가 빠른 순 → 만료 없는 것 순으로 차감 (FIFO + 만료임박 우선)
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

  -- 캐시용 profiles.energy_balance 동기화
  UPDATE profiles SET energy_balance = get_energy_balance(_user_id) WHERE user_id = _user_id;

  INSERT INTO energy_transactions (user_id, type, amount, reason, description)
  VALUES (_user_id, 'spend', _amount, _reason, _description);

  RETURN jsonb_build_object('success', true, 'balance', get_energy_balance(_user_id), 'spent', _amount);
END;
$$;

-- 9. earn_energy 재작성: max_energy 초과 허용 + 만료일 옵션
CREATE OR REPLACE FUNCTION public.earn_energy(
  _user_id uuid,
  _amount integer,
  _reason text,
  _description text DEFAULT NULL,
  _source text DEFAULT 'reward',
  _expire_days integer DEFAULT NULL  -- NULL이면 무기한 (구독/구매); 보상은 7일
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max integer;
  _current integer;
  _expire timestamptz;
  _capped_amount integer := _amount;
BEGIN
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT max_energy INTO _max FROM profiles WHERE user_id = _user_id;
  IF _max IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  PERFORM expire_energy_grants(_user_id);
  SELECT get_energy_balance(_user_id) INTO _current;

  -- 구독/구매 분(_expire_days NULL)은 max_energy 캡 적용, 보상/추천은 초과 허용
  IF _expire_days IS NULL THEN
    _capped_amount := LEAST(_amount, GREATEST(0, _max - _current));
    IF _capped_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Energy at max capacity', 'balance', _current);
    END IF;
  ELSE
    _expire := now() + (_expire_days || ' days')::interval;
  END IF;

  INSERT INTO energy_grants (user_id, amount, remaining, source, reason, description, expire_at)
  VALUES (_user_id, _capped_amount, _capped_amount, _source, _reason, _description, _expire);

  UPDATE profiles SET energy_balance = get_energy_balance(_user_id) WHERE user_id = _user_id;

  INSERT INTO energy_transactions (user_id, type, amount, reason, description)
  VALUES (_user_id, 'earn', _capped_amount, _reason, _description);

  RETURN jsonb_build_object('success', true, 'balance', get_energy_balance(_user_id), 'earned', _capped_amount, 'expire_at', _expire);
END;
$$;

-- 10. 보상 청구 (중복 방지)
CREATE OR REPLACE FUNCTION public.claim_reward(_reward_key text, _amount integer, _description text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _exists boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 중복 체크
  SELECT EXISTS(SELECT 1 FROM reward_claims WHERE user_id = _user_id AND reward_key = _reward_key) INTO _exists;
  IF _exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  INSERT INTO reward_claims (user_id, reward_key, amount) VALUES (_user_id, _reward_key, _amount);
  RETURN earn_energy(_user_id, _amount, 'reward_' || _reward_key, _description, 'reward', 7);
END;
$$;

-- 11. handle_new_user: 가입 시 referral_code 처리 + 추천 즉시 양쪽 보상
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referral_code text;
  _ref_input text;
  _referrer_id uuid;
BEGIN
  _referral_code := LOWER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text) FROM 1 FOR 8));

  INSERT INTO public.profiles (user_id, email, energy_balance, max_energy, referral_code)
  VALUES (NEW.id, NEW.email, 0, 100, _referral_code);

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');

  -- 가입 보너스 20 (무기한)
  PERFORM earn_energy(NEW.id, 20, 'signup', '회원가입 보상', 'signup', NULL);

  -- 추천 코드 처리
  _ref_input := NEW.raw_user_meta_data->>'referral_code';
  IF _ref_input IS NOT NULL AND LENGTH(_ref_input) > 0 THEN
    SELECT user_id INTO _referrer_id FROM profiles WHERE referral_code = LOWER(_ref_input) AND user_id <> NEW.id;
    IF _referrer_id IS NOT NULL THEN
      INSERT INTO referrals (referrer_id, referred_user_id, status, reward_given, completed_at)
      VALUES (_referrer_id, NEW.id, 'completed', true, now());
      PERFORM earn_energy(_referrer_id, 100, 'referral_referrer', '주변 사장님 추천 보상', 'referral', NULL);
      PERFORM earn_energy(NEW.id, 50, 'referral_friend', '추천 가입 보상', 'referral', NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 트리거 보장
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. 결제 완료 시 추천 보너스 지급 (양쪽 +50, 1회만)
CREATE OR REPLACE FUNCTION public.grant_referral_payment_bonus(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ref record;
BEGIN
  SELECT id, referrer_id, referred_user_id INTO _ref
  FROM referrals
  WHERE referred_user_id = _user_id AND payment_reward_given = false
  LIMIT 1;

  IF _ref.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending referral bonus');
  END IF;

  PERFORM earn_energy(_ref.referrer_id, 50, 'referral_payment_referrer', '추천 친구 결제 보상', 'referral', NULL);
  PERFORM earn_energy(_ref.referred_user_id, 50, 'referral_payment_friend', '추천 가입 결제 보상', 'referral', NULL);

  UPDATE referrals SET payment_reward_given = true WHERE id = _ref.id;
  RETURN jsonb_build_object('success', true);
END;
$$;
