ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS postar_instagram boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS postar_linkedin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS postar_x boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legenda_instagram text,
  ADD COLUMN IF NOT EXISTS legenda_linkedin text,
  ADD COLUMN IF NOT EXISTS legenda_x text;