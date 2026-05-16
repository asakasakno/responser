-- IP-based rate limit helper (works alongside user_id rate limits).
-- Stores only a SHA-256 hash of (ip + UA) in audit_logs.details->>'ip_hash';
-- never stores raw IP/UA.

CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  _action text,
  _ip_hash text,
  _max_per_window int DEFAULT 5,
  _window_seconds int DEFAULT 600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int;
BEGIN
  IF _ip_hash IS NULL OR length(_ip_hash) < 8 THEN
    -- No hash → cannot enforce, allow but flag
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_ip_hash');
  END IF;

  IF length(_action) > 100 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_action');
  END IF;

  SELECT count(*) INTO _count
    FROM public.audit_logs
   WHERE action = _action
     AND details->>'ip_hash' = _ip_hash
     AND created_at > now() - make_interval(secs => _window_seconds);

  IF _count >= _max_per_window THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'count', _count,
      'limit', _max_per_window,
      'window_seconds', _window_seconds
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'count', _count,
    'limit', _max_per_window
  );
END;
$$;

-- Service role + admins only (called from Edge Functions with service role).
REVOKE EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, int, int) TO service_role;

-- Helper RPC for inserting an IP-tagged audit entry from Edge Functions
-- (we already have audit_logs writes; this is a typed convenience).
CREATE OR REPLACE FUNCTION public.log_rate_limit_attempt(
  _action text,
  _ip_hash text,
  _user_id uuid DEFAULT NULL,
  _severity text DEFAULT 'info',
  _extra jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _severity NOT IN ('info','warning','error','critical') THEN
    _severity := 'info';
  END IF;
  IF length(_action) > 100 THEN
    RAISE EXCEPTION 'Action too long';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, severity, details)
  VALUES (
    _user_id,
    _action,
    _severity,
    jsonb_build_object('ip_hash', _ip_hash) || COALESCE(_extra, '{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_rate_limit_attempt(text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_rate_limit_attempt(text, text, uuid, text, jsonb) TO service_role;

-- Index to make IP-hash lookups fast
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_ip_hash
  ON public.audit_logs (action, ((details->>'ip_hash')), created_at DESC)
  WHERE details ? 'ip_hash';

-- Trigger on contact_inquiries: enforce per-IP rate limit when ip_hash is
-- provided via the row's payload? The table doesn't carry ip_hash directly,
-- but we can add audit_logs entry on insert via a trigger that records the
-- inquiry and enforces a soft per-user limit. (Hard IP limit is best done
-- in an Edge Function — we wire that next.)
-- Soft per-IP rate limit on contact_inquiries based on email column hash:
CREATE OR REPLACE FUNCTION public.contact_inquiry_rate_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key_hash text;
  _count int;
BEGIN
  -- Use email hash as a proxy when IP isn't available client-side.
  _key_hash := encode(digest(coalesce(NEW.email, ''), 'sha256'), 'hex');

  SELECT count(*) INTO _count
    FROM public.contact_inquiries
   WHERE email = NEW.email
     AND created_at > now() - interval '10 minutes';

  IF _count >= 5 THEN
    RAISE EXCEPTION 'rate_limited: too many inquiries from this email in 10 minutes'
      USING ERRCODE = '22023';
  END IF;

  -- Soft audit (no raw message stored)
  INSERT INTO public.audit_logs(user_id, action, severity, details)
  VALUES (
    NEW.user_id,
    'contact_inquiry_submitted',
    'info',
    jsonb_build_object(
      'email_hash', left(_key_hash, 16),
      'subject_length', length(coalesce(NEW.subject, '')),
      'message_length', length(coalesce(NEW.message, ''))
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_inquiry_rate_check ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiry_rate_check
  BEFORE INSERT ON public.contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.contact_inquiry_rate_check();
