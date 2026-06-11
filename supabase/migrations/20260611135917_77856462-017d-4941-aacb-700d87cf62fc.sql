ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS make_webhook_url TEXT;
GRANT SELECT, INSERT, UPDATE ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;