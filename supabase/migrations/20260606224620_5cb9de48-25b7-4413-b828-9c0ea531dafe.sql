
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_post TEXT NOT NULL CHECK (tipo_post IN ('Post Único', 'Carrossel')),
  estilo_layout TEXT NOT NULL DEFAULT 'Padrão' CHECK (estilo_layout IN ('Padrão', 'Estilo X')),
  legenda TEXT NOT NULL DEFAULT '',
  url_imagem TEXT,
  imagens_carrossel JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_agendamento TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Agendado', 'Publicado', 'Erro')),
  prompt_ia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO anon, authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public posts access" ON public.posts FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
