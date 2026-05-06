
REVOKE ALL ON FUNCTION public.detect_duplicate_payments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_missing_credits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_refund_failures() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_abnormal_usage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_admin_anomaly_scan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_partial_recover_energy(uuid, integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_resolve_anomaly(uuid, text) FROM PUBLIC, anon, authenticated;
