-- 쿠폰 시스템
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_name text NOT NULL,
  coupon_code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_discount_amount integer,
  min_purchase_amount integer DEFAULT 0,
  target_type text NOT NULL DEFAULT 'all' CHECK (target_type IN ('subscription','energy','all')),
  target_plan text,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  max_total_uses integer,
  max_use_per_user integer NOT NULL DEFAULT 1,
  total_uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupons_code ON public.coupons (coupon_code);

CREATE TABLE public.coupon_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  billing_order_id text,
  original_amount integer NOT NULL,
  discount_amount integer NOT NULL,
  final_amount integer NOT NULL,
  target_type text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_usages_user ON public.coupon_usages (user_id, coupon_id);
CREATE INDEX idx_coupon_usages_order ON public.coupon_usages (billing_order_id);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

-- 쿠폰: 관리자만 모든 작업, 사용자는 코드 조회 불가(서버 RPC로만 검증)
CREATE POLICY "Admins manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 사용 내역: 본인 또는 관리자
CREATE POLICY "Users view own coupon usages" ON public.coupon_usages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all coupon usages" ON public.coupon_usages
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- updated_at 트리거
CREATE TRIGGER trg_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 쿠폰 검증 + 할인 계산 (서버 단독)
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _amount integer,
  _target_type text,
  _target_plan text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _c record;
  _used_count integer;
  _discount integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', '로그인이 필요합니다.');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', '잘못된 금액입니다.');
  END IF;

  SELECT * INTO _c FROM coupons WHERE coupon_code = LOWER(TRIM(_code));
  IF _c IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', '사용할 수 없는 프로모션 코드입니다.');
  END IF;
  IF NOT _c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', '비활성화된 코드입니다.');
  END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', '아직 사용할 수 없는 코드입니다.');
  END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', '만료된 코드입니다.');
  END IF;
  IF _c.target_type <> 'all' AND _c.target_type <> _target_type THEN
    RETURN jsonb_build_object('valid', false, 'error', '이 결제에는 사용할 수 없는 코드입니다.');
  END IF;
  IF _c.target_plan IS NOT NULL AND _target_plan IS NOT NULL AND _c.target_plan <> _target_plan THEN
    RETURN jsonb_build_object('valid', false, 'error', '해당 플랜에는 사용할 수 없는 코드입니다.');
  END IF;
  IF COALESCE(_c.min_purchase_amount, 0) > _amount THEN
    RETURN jsonb_build_object('valid', false, 'error', '최소 결제 금액에 미달합니다.');
  END IF;
  IF _c.max_total_uses IS NOT NULL AND _c.total_uses >= _c.max_total_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', '사용 가능한 횟수가 모두 소진되었습니다.');
  END IF;

  SELECT COUNT(*) INTO _used_count FROM coupon_usages
    WHERE coupon_id = _c.id AND user_id = _user_id;
  IF _used_count >= _c.max_use_per_user THEN
    RETURN jsonb_build_object('valid', false, 'error', '이미 사용한 쿠폰입니다.');
  END IF;

  IF _c.discount_type = 'fixed' THEN
    _discount := _c.discount_value;
  ELSE
    _discount := (_amount * _c.discount_value) / 100;
  END IF;
  IF _c.max_discount_amount IS NOT NULL THEN
    _discount := LEAST(_discount, _c.max_discount_amount);
  END IF;
  _discount := LEAST(_discount, _amount);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', _c.id,
    'coupon_code', _c.coupon_code,
    'coupon_name', _c.coupon_name,
    'discount_type', _c.discount_type,
    'discount_value', _c.discount_value,
    'discount_amount', _discount,
    'original_amount', _amount,
    'final_amount', _amount - _discount
  );
END;
$$;

-- 쿠폰 사용 기록 (서버 결제 함수에서만 호출)
CREATE OR REPLACE FUNCTION public.consume_coupon(
  _user_id uuid,
  _coupon_id uuid,
  _original_amount integer,
  _discount_amount integer,
  _final_amount integer,
  _target_type text,
  _billing_order_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c record; _used integer;
BEGIN
  SELECT * INTO _c FROM coupons WHERE id = _coupon_id FOR UPDATE;
  IF _c IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon not found');
  END IF;
  IF NOT _c.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon inactive');
  END IF;

  SELECT COUNT(*) INTO _used FROM coupon_usages WHERE coupon_id = _c.id AND user_id = _user_id;
  IF _used >= _c.max_use_per_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Per-user limit reached');
  END IF;
  IF _c.max_total_uses IS NOT NULL AND _c.total_uses >= _c.max_total_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Total limit reached');
  END IF;

  INSERT INTO coupon_usages (coupon_id, user_id, billing_order_id, original_amount, discount_amount, final_amount, target_type)
  VALUES (_c.id, _user_id, _billing_order_id, _original_amount, _discount_amount, _final_amount, _target_type);

  UPDATE coupons SET total_uses = total_uses + 1 WHERE id = _c.id;

  RETURN jsonb_build_object('success', true);
END;
$$;