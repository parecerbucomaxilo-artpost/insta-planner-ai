GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;

DROP POLICY IF EXISTS "Preview can read posts while auth is disabled" ON public.posts;
CREATE POLICY "Preview can read posts while auth is disabled"
ON public.posts
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Preview can create posts while auth is disabled" ON public.posts;
CREATE POLICY "Preview can create posts while auth is disabled"
ON public.posts
FOR INSERT
TO anon
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;