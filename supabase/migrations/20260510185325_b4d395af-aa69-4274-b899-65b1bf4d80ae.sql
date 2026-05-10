
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_beta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_until timestamptz,
  ADD COLUMN IF NOT EXISTS beta_source text;

CREATE TABLE IF NOT EXISTS public.beta_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text,
  industry text,
  platforms text[] NOT NULL DEFAULT '{}',
  needed_features text[] NOT NULL DEFAULT '{}',
  pain_point text,
  consent boolean NOT NULL DEFAULT false,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'google_form',
  matched_user_id uuid,
  applied_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_applications_email ON public.beta_applications (lower(email));
CREATE INDEX IF NOT EXISTS idx_beta_applications_status ON public.beta_applications (status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_beta_applications_active_email
  ON public.beta_applications (lower(email))
  WHERE status IN ('pending', 'applied');

ALTER TABLE public.beta_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view beta applications"
  ON public.beta_applications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_beta_applications_updated_at
  BEFORE UPDATE ON public.beta_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
