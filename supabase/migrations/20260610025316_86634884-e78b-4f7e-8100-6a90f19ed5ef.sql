ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS webhook_url TEXT;
COMMENT ON COLUMN public.perfil_usuario.webhook_url IS 'URL do webhook para automação externa (Make.com, n8n, Zapier)';