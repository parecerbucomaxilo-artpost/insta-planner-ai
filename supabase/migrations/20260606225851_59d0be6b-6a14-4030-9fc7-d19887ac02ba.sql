CREATE TABLE public.perfil_usuario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_profissional text NOT NULL DEFAULT '',
  arroba_usuario text NOT NULL DEFAULT '',
  url_logo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO anon, authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;

ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public perfil read" ON public.perfil_usuario FOR SELECT USING (true);
CREATE POLICY "Public perfil insert" ON public.perfil_usuario FOR INSERT WITH CHECK (true);
CREATE POLICY "Public perfil update" ON public.perfil_usuario FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER trg_perfil_usuario_updated_at
BEFORE UPDATE ON public.perfil_usuario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();