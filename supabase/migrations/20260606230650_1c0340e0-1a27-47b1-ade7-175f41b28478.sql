ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visualizacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aviso_500_atingido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS formato_midia text NOT NULL DEFAULT 'Imagem' CHECK (formato_midia IN ('Imagem', 'Vídeo/Reels'));