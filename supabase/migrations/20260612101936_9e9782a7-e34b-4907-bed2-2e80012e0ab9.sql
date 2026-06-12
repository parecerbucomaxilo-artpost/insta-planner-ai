ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS instagram_webhook_url TEXT;
ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS linkedin_webhook_url TEXT;

-- Opcional: Migrar dado existente de webhook_url para instagram_webhook_url se este estiver vazio
UPDATE public.perfil_usuario SET instagram_webhook_url = webhook_url WHERE instagram_webhook_url IS NULL AND webhook_url IS NOT NULL;
