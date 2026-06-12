ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS url_imagem_cache text,
  ADD COLUMN IF NOT EXISTS url_imagem_cache_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS imagens_carrossel_cache jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS imagens_carrossel_cache_expires_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;

CREATE INDEX IF NOT EXISTS idx_posts_media_cache_expiry
  ON public.posts (url_imagem_cache_expires_at, imagens_carrossel_cache_expires_at);