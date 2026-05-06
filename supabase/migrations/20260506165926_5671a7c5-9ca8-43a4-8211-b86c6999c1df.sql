
-- user_templates table
CREATE TABLE IF NOT EXISTS public.user_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'review',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own templates" ON public.user_templates
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own templates" ON public.user_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own templates" ON public.user_templates
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own templates" ON public.user_templates
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS user_templates_user_idx ON public.user_templates(user_id, created_at DESC);

-- favorites on generations
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- business category on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_category text;

-- Allow users to update favorites on their own generations
DO $$ BEGIN
  CREATE POLICY "Users update own generations"
    ON public.generations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
