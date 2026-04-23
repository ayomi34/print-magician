
-- Orders table backed by Lovable Cloud
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_notes TEXT,
  config JSONB NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  total NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Demo policies: anyone (including anon) can place orders, view, and update.
-- This is acceptable because this is a demo with no real auth. Real auth/admin
-- gating will be added later.
CREATE POLICY "Anyone can insert orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read orders"
  ON public.orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update orders"
  ON public.orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete orders"
  ON public.orders FOR DELETE
  TO anon, authenticated
  USING (true);

-- Enable realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Storage bucket for uploaded print files
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-files', 'print-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload print files"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'print-files');

CREATE POLICY "Anyone can read print files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'print-files');

CREATE POLICY "Anyone can delete print files"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'print-files');
