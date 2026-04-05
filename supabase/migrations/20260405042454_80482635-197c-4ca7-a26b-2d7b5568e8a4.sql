
-- Drop the unsafe INSERT and UPDATE policies on usage table
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage;

-- Add unique constraint on (user_id, date) to prevent duplicate rows
ALTER TABLE public.usage ADD CONSTRAINT usage_user_date_unique UNIQUE (user_id, date);

-- Create a SECURITY DEFINER function to safely increment usage
CREATE OR REPLACE FUNCTION public.increment_usage()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO usage (user_id, count, date)
  VALUES (auth.uid(), 1, CURRENT_DATE)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = usage.count + 1;
$$;
