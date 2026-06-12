CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tipo_post TEXT,
  estilo_layout TEXT,
  formato_midia TEXT,
  legenda TEXT,
  legenda_instagram TEXT,
  legenda_linkedin TEXT,
  postar_instagram BOOLEAN DEFAULT false,
  postar_linkedin BOOLEAN DEFAULT false,
  url_imagem TEXT,
  imagens_carrossel TEXT[],
  data_agendamento TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Rascunho',
  prompt_ia TEXT,
  visualizacoes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT ALL ON public.posts TO anon, authenticated, service_role;

ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
