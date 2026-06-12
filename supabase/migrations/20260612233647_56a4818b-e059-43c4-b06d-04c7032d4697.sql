GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO anon;
GRANT ALL ON public.posts TO service_role;
GRANT ALL ON public.perfil_usuario TO service_role;