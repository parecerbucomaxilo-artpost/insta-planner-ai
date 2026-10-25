ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_key text;
CREATE UNIQUE INDEX IF NOT EXISTS posts_user_content_key_uniq ON public.posts (user_id, content_key) WHERE content_key IS NOT NULL;