REVOKE EXECUTE ON FUNCTION public.reserve_generate_request(integer, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_generate_request(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.try_claim_generate_refund(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_generate_refund(uuid, boolean, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.reserve_generate_request(integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_generate_request(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.try_claim_generate_refund(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_generate_refund(uuid, boolean, text) TO authenticated, service_role;