
-- Create generation_logs table for AI response quality tracking + user feedback
CREATE TABLE public.generation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  generation_id uuid,
  type text NOT NULL DEFAULT 'review',
  platform text,
  business_category text,
  sub_category text,
  tone text,
  rating integer,
  original_review text,
  generated_reply text NOT NULL,
  final_reply text,
  copied boolean NOT NULL DEFAULT false,
  edited boolean NOT NULL DEFAULT false,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gen_logs_user ON public.generation_logs(user_id, created_at DESC);
CREATE INDEX idx_gen_logs_platform ON public.generation_logs(platform);
CREATE INDEX idx_gen_logs_business ON public.generation_logs(business_category);
CREATE INDEX idx_gen_logs_tone ON public.generation_logs(tone);
CREATE INDEX idx_gen_logs_feedback ON public.generation_logs(feedback);

ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own generation logs"
  ON public.generation_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own generation logs"
  ON public.generation_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own generation logs"
  ON public.generation_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all generation logs"
  ON public.generation_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_generation_logs_updated_at
  BEFORE UPDATE ON public.generation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
