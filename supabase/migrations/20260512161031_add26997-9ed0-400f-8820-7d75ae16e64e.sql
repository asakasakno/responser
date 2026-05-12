ALTER TABLE public.generation_logs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS image_batch_id uuid,
  ADD COLUMN IF NOT EXISTS image_index integer;

CREATE INDEX IF NOT EXISTS idx_generation_logs_image_batch_id
  ON public.generation_logs (image_batch_id)
  WHERE image_batch_id IS NOT NULL;