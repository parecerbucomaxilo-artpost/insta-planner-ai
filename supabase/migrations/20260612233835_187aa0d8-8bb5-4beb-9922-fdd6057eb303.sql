REVOKE ALL ON public.posts FROM anon;
REVOKE ALL ON public.perfil_usuario FROM anon;

DROP POLICY IF EXISTS "anon_all_posts" ON public.posts;
DROP POLICY IF EXISTS "auth_all_posts" ON public.posts;
DROP POLICY IF EXISTS "anon_all_perfil" ON public.perfil_usuario;
DROP POLICY IF EXISTS "auth_all_perfil" ON public.perfil_usuario;

CREATE POLICY "Authenticated users can read posts"
ON public.posts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create own posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can update own posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can delete own posts"
ON public.posts
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can read own profile"
ON public.perfil_usuario
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own profile"
ON public.perfil_usuario
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.perfil_usuario
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own profile"
ON public.perfil_usuario
FOR DELETE
TO authenticated
USING (user_id = auth.uid());