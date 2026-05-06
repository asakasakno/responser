-- DB-level idempotency for purchase payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS payment_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_order_id_key'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_payment_key_key'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payment_key_key UNIQUE (payment_key);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_energy_purchase(
  _user_id uuid,
  _amount integer,
  _product_name text,
  _payment_method text,
  _order_id text,
  _payment_key text,
  _energy integer,
  _energy_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _payment_id uuid;
  _energy_result jsonb;
BEGIN
  INSERT INTO public.payments (user_id, amount, product_name, status, payment_method, order_id, payment_key)
  VALUES (_user_id, _amount, _product_name, 'success', _payment_method, _order_id, _payment_key)
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO _payment_id;

  IF _payment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_processed', true);
  END IF;

  SELECT to_jsonb(t) INTO _energy_result
  FROM public.earn_energy(
    _user_id,
    _energy,
    'purchase',
    _energy_description,
    'purchase',
    NULL
  ) AS t;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'payment_id', _payment_id,
    'energy', _energy_result
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'already_processed', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_energy_purchase(uuid, integer, text, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_energy_purchase(uuid, integer, text, text, text, text, integer, text) TO service_role;
