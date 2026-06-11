ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS linkedin_urn TEXT;
GRANT ALL ON public.perfil_usuario TO service_role;
GRANT ALL ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO anon;
