ALTER TABLE public.perfil_usuario ADD COLUMN buffer_access_token TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;