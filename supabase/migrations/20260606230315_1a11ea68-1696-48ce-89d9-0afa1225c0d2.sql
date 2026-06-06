ALTER TABLE public.perfil_usuario
  ADD COLUMN IF NOT EXISTS instagram_arroba text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_foto_url text,
  ADD COLUMN IF NOT EXISTS linkedin_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_foto_url text,
  ADD COLUMN IF NOT EXISTS x_arroba text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS x_foto_url text;