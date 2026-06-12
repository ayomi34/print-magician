
CREATE OR REPLACE FUNCTION public.save_paid_order(
  p_id text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_customer_notes text,
  p_config jsonb,
  p_file_name text,
  p_file_size bigint,
  p_total numeric,
  p_payment_reference text
) RETURNS TABLE(id text, already_saved boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id text;
BEGIN
  SELECT o.id INTO existing_id FROM public.orders o WHERE o.payment_reference = p_payment_reference;
  IF existing_id IS NOT NULL THEN
    RETURN QUERY SELECT existing_id, true;
    RETURN;
  END IF;

  INSERT INTO public.orders (
    id, status, customer_name, customer_phone, customer_email, customer_notes,
    config, file_name, file_size, total, payment_reference, payment_status
  ) VALUES (
    p_id, 'pending', p_customer_name, p_customer_phone, p_customer_email, p_customer_notes,
    p_config, p_file_name, p_file_size, p_total, p_payment_reference, 'paid'
  );

  RETURN QUERY SELECT p_id, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_paid_order(text, text, text, text, text, jsonb, text, bigint, numeric, text) TO anon, authenticated;
