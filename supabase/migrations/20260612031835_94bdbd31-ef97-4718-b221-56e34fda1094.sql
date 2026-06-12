GRANT SELECT, INSERT ON public.posts TO anon, authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select posts" ON public.posts;
CREATE POLICY "Public select posts" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert posts" ON public.posts;
CREATE POLICY "Public insert posts" ON public.posts FOR INSERT WITH CHECK (true);
