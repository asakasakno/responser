-- ============================================
-- [2] audit_logs: 클라이언트 직접 INSERT 차단 + log_audit RPC
-- ============================================

-- 1. 기존 사용자 INSERT 정책 제거 (위조 가능했음)
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;

-- 2. 서버 전용 로깅 함수 (SECURITY DEFINER, user_id는 auth.uid() 강제)
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _details jsonb DEFAULT '{}'::jsonb,
  _severity text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- severity 화이트리스트
  IF _severity NOT IN ('info', 'warning', 'error', 'critical') THEN
    _severity := 'info';
  END IF;

  -- action 길이 제한
  IF length(_action) > 100 THEN
    RAISE EXCEPTION 'Action too long';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, details, severity)
  VALUES (_uid, _action, COALESCE(_details, '{}'::jsonb), _severity);
END;
$$;

-- anon 차단, authenticated만 호출 가능
REVOKE EXECUTE ON FUNCTION public.log_audit(text, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, jsonb, text) TO authenticated;

-- ============================================
-- [3] user_roles: 본인 역할 SELECT 허용 (다른 사용자 조회 불가)
-- ============================================

-- 본인의 역할만 조회 가능 (권한 enumeration 방지)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE는 기존 admin-only 정책 유지 (이미 안전)
