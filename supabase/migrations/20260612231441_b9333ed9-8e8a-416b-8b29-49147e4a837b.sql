DROP POLICY IF EXISTS posts_select_own ON public.posts;
DROP POLICY IF EXISTS posts_insert_own ON public.posts;
DROP POLICY IF EXISTS posts_update_own ON public.posts;
DROP POLICY IF EXISTS posts_delete_own ON public.posts;
DROP POLICY IF EXISTS perfil_select_own ON public.perfil_usuario;
DROP POLICY IF EXISTS perfil_insert_own ON public.perfil_usuario;
DROP POLICY IF EXISTS perfil_update_own ON public.perfil_usuario;
DROP POLICY IF EXISTS perfil_delete_own ON public.perfil_usuario;

CREATE POLICY "auth_all_posts" ON public.posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_perfil" ON public.perfil_usuario FOR ALL TO authenticated USING (true) WITH CHECK (true);