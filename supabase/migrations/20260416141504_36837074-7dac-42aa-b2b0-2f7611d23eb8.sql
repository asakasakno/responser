
-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address text,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Rate limit check function (uses usage table timestamps via audit_logs)
CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id uuid, _action text, _max_per_second integer DEFAULT 2)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent_count integer;
BEGIN
  SELECT COUNT(*) INTO _recent_count
  FROM audit_logs
  WHERE user_id = _user_id
    AND action = _action
    AND created_at > now() - interval '1 second';
  
  RETURN _recent_count < _max_per_second;
END;
$$;
