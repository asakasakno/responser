
-- 1. Lock search_path on pgmq helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Revoke EXECUTE from anon/public on sensitive SECURITY DEFINER functions,
--    then grant only to authenticated where end-user invocation is needed.

-- Functions intended only for triggers / service role (no API callers)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_max_energy_from_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_referral_payment_bonus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_coupon(uuid, uuid, integer, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_energy_grants(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- earn_energy variants are server-only (called from triggers/edge functions via service role)
REVOKE ALL ON FUNCTION public.earn_energy(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.earn_energy(uuid, integer, text, text, text, integer) FROM PUBLIC, anon, authenticated;

-- Functions callable by signed-in users only
REVOKE ALL ON FUNCTION public.spend_energy(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_energy(integer, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_reward(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_reward(text, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_coupon(text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, integer, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.log_audit(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.increment_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_has_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.get_energy_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_energy_balance(uuid) TO authenticated;

-- has_role is used inside RLS policies; keep callable by authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
