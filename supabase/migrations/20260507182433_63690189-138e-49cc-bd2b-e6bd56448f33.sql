
-- Lock down orders table: drop public SELECT, add admin-only
DROP POLICY IF EXISTS "Public can read orders" ON public.orders;

CREATE POLICY "Admins can read orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Public tracking RPC — returns minimal non-PII fields by order id
CREATE OR REPLACE FUNCTION public.track_order(p_id text)
RETURNS TABLE (
  id text,
  status text,
  total numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.total, o.created_at
  FROM public.orders o
  WHERE o.id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.track_order(text) TO anon, authenticated;

-- Storage: restrict DELETE on print-files to admins only
DROP POLICY IF EXISTS "Anyone can delete print files" ON storage.objects;

CREATE POLICY "Admins delete print files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'print-files'
  AND public.has_role(auth.uid(), 'admin')
);
