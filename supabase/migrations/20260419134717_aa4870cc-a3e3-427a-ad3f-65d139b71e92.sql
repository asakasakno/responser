-- Create self-scoped role check (uses auth.uid() — no enumeration risk)
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_role(public.app_role) TO authenticated;

-- Restrict the original has_role(uuid, app_role) so it can no longer be used
-- by clients to enumerate other users' admin status. It remains callable from
-- SECURITY DEFINER functions and RLS policies (which run as table owner).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;