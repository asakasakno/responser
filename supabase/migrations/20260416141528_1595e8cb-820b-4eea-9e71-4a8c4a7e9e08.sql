
DROP POLICY "Service role can insert logs" ON public.audit_logs;

CREATE POLICY "Users can insert own audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
