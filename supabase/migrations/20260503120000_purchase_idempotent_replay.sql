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
  _existing public.payments%ROWTYPE;
  _energy_result jsonb;
BEGIN
  INSERT INTO public.payments (user_id, amount, product_name, status, payment_method, order_id, payment_key)
  VALUES (_user_id, _amount, _product_name, 'success', _payment_method, _order_id, _payment_key)
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO _payment_id;

  IF _payment_id IS NULL THEN
    SELECT *
    INTO _existing
    FROM public.payments p
    WHERE p.order_id = _order_id OR p.payment_key = _payment_key
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'already_processed', true);
    END IF;

    IF _existing.user_id <> _user_id THEN
      RETURN jsonb_build_object('success', false, 'already_processed', true, 'owner_mismatch', true);
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'idempotent_replay', true,
      'payment', jsonb_build_object(
        'id', _existing.id,
        'amount', _existing.amount,
        'product_name', _existing.product_name,
        'status', _existing.status,
        'payment_method', _existing.payment_method,
        'created_at', _existing.created_at
      )
    );
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
    'idempotent_replay', false,
    'payment_id', _payment_id,
    'energy', _energy_result
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT *
    INTO _existing
    FROM public.payments p
    WHERE p.order_id = _order_id OR p.payment_key = _payment_key
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF FOUND AND _existing.user_id = _user_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'idempotent_replay', true,
        'payment', jsonb_build_object(
          'id', _existing.id,
          'amount', _existing.amount,
          'product_name', _existing.product_name,
          'status', _existing.status,
          'payment_method', _existing.payment_method,
          'created_at', _existing.created_at
        )
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'already_processed', true, 'owner_mismatch', true);
END;
$function$;
