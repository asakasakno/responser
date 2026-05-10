
CREATE TABLE IF NOT EXISTS public.user_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('email','google','kakao')),
  provider_user_id text,
  provider_email text,
  email_verified boolean NOT NULL DEFAULT false,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_identity_links_active_user_provider
  ON public.user_identity_links (user_id, provider) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_identity_links_active_provider_pid
  ON public.user_identity_links (provider, provider_user_id)
  WHERE is_active AND provider_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_identity_links_user ON public.user_identity_links(user_id);

ALTER TABLE public.user_identity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own identity links"
  ON public.user_identity_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all identity links"
  ON public.user_identity_links FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies: only service_role (Edge Functions) may modify.

-- Backfill from profiles
INSERT INTO public.user_identity_links (user_id, provider, provider_user_id, provider_email, email_verified, is_active)
SELECT
  p.user_id,
  'email',
  NULL,
  p.email,
  true,
  true
FROM public.profiles p
WHERE p.email IS NOT NULL
  AND p.email NOT LIKE '%@kakao.responser.local'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_identity_links (user_id, provider, provider_user_id, provider_email, email_verified, is_active)
SELECT
  p.user_id,
  'kakao',
  p.provider_user_id,
  CASE WHEN p.email LIKE '%@kakao.responser.local' THEN NULL ELSE p.email END,
  CASE WHEN p.email LIKE '%@kakao.responser.local' THEN false ELSE true END,
  true
FROM public.profiles p
WHERE p.provider = 'kakao' AND p.provider_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
