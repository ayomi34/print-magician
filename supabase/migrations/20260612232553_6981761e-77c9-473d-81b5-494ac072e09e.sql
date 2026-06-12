CREATE OR REPLACE FUNCTION public.track_order(p_id text)
RETURNS TABLE(id text, status text, total numeric, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.status, o.total, o.created_at
  FROM public.orders o
  WHERE o.id = p_id
     OR regexp_replace(o.customer_phone, '\D', '', 'g') = regexp_replace(p_id, '\D', '', 'g')
  ORDER BY o.created_at DESC
  LIMIT 1;
$function$;