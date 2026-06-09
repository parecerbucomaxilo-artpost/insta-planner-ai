
-- 1. Add owner columns (nullable for backfill)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_perfil_user_id ON public.perfil_usuario(user_id);

-- 2. Lock down posts
DROP POLICY IF EXISTS "Public posts access" ON public.posts;
REVOKE ALL ON public.posts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

CREATE POLICY "posts_select_own" ON public.posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Lock down perfil_usuario
DROP POLICY IF EXISTS "Public perfil read" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Public perfil insert" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Public perfil update" ON public.perfil_usuario;
REVOKE ALL ON public.perfil_usuario FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_usuario TO authenticated;
GRANT ALL ON public.perfil_usuario TO service_role;

CREATE POLICY "perfil_select_own" ON public.perfil_usuario FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "perfil_insert_own" ON public.perfil_usuario FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "perfil_update_own" ON public.perfil_usuario FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "perfil_delete_own" ON public.perfil_usuario FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Storage policies for logos bucket — owner = first path segment
DROP POLICY IF EXISTS "logos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_delete_own" ON storage.objects;

CREATE POLICY "logos_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "logos_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "logos_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "logos_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Claim helper: assigns all orphan rows to the first authenticated caller
CREATE OR REPLACE FUNCTION public.claim_legacy_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;

  -- Only claim if no rows yet have an owner (so only the very first user wins)
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE user_id IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.perfil_usuario WHERE user_id IS NOT NULL) THEN
    UPDATE public.posts SET user_id = v_uid WHERE user_id IS NULL;
    UPDATE public.perfil_usuario SET user_id = v_uid WHERE user_id IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_legacy_data() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_legacy_data() TO authenticated;
