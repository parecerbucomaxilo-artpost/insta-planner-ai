ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS instagram_conta text;
CREATE INDEX IF NOT EXISTS posts_instagram_conta_idx ON public.posts (instagram_conta);