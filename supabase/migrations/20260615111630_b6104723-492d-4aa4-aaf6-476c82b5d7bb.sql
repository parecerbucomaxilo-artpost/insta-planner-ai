ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_formato_midia_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_formato_midia_check
  CHECK (formato_midia = ANY (ARRAY['Imagem'::text, 'Vídeo/Reels'::text, 'Carrossel'::text, 'Story'::text, 'Stories'::text]));