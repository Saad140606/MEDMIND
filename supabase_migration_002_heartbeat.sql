CREATE TABLE IF NOT EXISTS public.heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT NOT NULL
);

ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;
