ALTER TABLE public.perfil_usuario 
ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS linkedin_access_token TEXT;

-- Garantir que as permissões estejam corretas (já devem estar, mas por precaução)
GRANT SELECT, UPDATE ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;