GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;

DROP POLICY IF EXISTS "Users can read own profile" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Users can create own profile" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Users can update own profile" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.perfil_usuario;

ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
ON public.perfil_usuario
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own profile"
ON public.perfil_usuario
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.perfil_usuario
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own profile"
ON public.perfil_usuario
FOR DELETE
TO authenticated
USING (user_id = auth.uid());