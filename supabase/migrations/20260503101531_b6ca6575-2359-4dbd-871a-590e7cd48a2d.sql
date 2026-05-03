-- Lock down internal SECURITY DEFINER helpers that accept _user_id.
-- These should only be callable by service_role or from inside other SECURITY DEFINER functions.

-- earn_energy (both overloads)
REVOKE ALL ON FUNCTION public.earn_energy(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.earn_energy(uuid, integer, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.earn_energy(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.earn_energy(uuid, integer, text, text, text, integer) TO service_role;

-- consume_coupon
REVOKE ALL ON FUNCTION public.consume_coupon(uuid, uuid, integer, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_coupon(uuid, uuid, integer, integer, integer, text, text) TO service_role;

-- grant_referral_payment_bonus
REVOKE ALL ON FUNCTION public.grant_referral_payment_bonus(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_referral_payment_bonus(uuid) TO service_role;

-- expire_energy_grants
REVOKE ALL ON FUNCTION public.expire_energy_grants(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_energy_grants(uuid) TO service_role;

-- admin_spend_energy (already has admin check, but no need to expose to anon/public)
REVOKE ALL ON FUNCTION public.admin_spend_energy(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_spend_energy(uuid, integer, text, text) TO authenticated, service_role;

-- get_energy_balance: restrict so users can only read their own balance.
-- Replace with a wrapper that enforces auth.uid() = _user_id (or admin/service_role).
CREATE OR REPLACE FUNCTION public.get_energy_balance(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _total integer;
  _caller uuid := auth.uid();
  _is_service boolean := (auth.role() = 'service_role');
BEGIN
  IF NOT _is_service
     AND (_caller IS NULL OR (_caller <> _user_id AND NOT public.has_role(_caller, 'admin'::app_role)))
  THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(SUM(remaining), 0) INTO _total
  FROM energy_grants
  WHERE user_id = _user_id
    AND remaining > 0
    AND (expire_at IS NULL OR expire_at > now());
  RETURN _total;
END;
$function$;

-- Keep get_energy_balance callable by authenticated (for own balance) and service_role.
REVOKE ALL ON FUNCTION public.get_energy_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_energy_balance(uuid) TO authenticated, service_role;

-- check_rate_limit is an internal helper; restrict to service_role too.
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer) TO service_role;