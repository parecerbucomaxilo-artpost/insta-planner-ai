
CREATE TABLE public.notificacoes_erro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  post_id uuid,
  contexto jsonb DEFAULT '{}'::jsonb,
  lida boolean NOT NULL DEFAULT false,
  enviada_no_resumo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notificacoes_erro TO authenticated;
GRANT ALL ON public.notificacoes_erro TO service_role;

ALTER TABLE public.notificacoes_erro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own" ON public.notificacoes_erro
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users mark own read" ON public.notificacoes_erro
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notificacoes_erro_user_lida ON public.notificacoes_erro(user_id, lida, created_at DESC);
CREATE INDEX idx_notificacoes_erro_resumo ON public.notificacoes_erro(enviada_no_resumo, created_at) WHERE enviada_no_resumo = false;
