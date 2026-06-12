DROP POLICY IF EXISTS "Public select posts" ON public.posts;
DROP POLICY IF EXISTS "Public insert posts" ON public.posts;

REVOKE ALL ON public.posts FROM anon;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
