ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS postar_google boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_estilo_layout_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_estilo_layout_check CHECK (estilo_layout = ANY (ARRAY['Padrão'::text, 'Estilo X'::text, 'Google Business'::text]));