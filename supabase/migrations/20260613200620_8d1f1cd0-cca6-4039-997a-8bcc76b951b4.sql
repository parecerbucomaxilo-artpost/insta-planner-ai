DROP POLICY IF EXISTS "Authenticated users can read posts" ON public.posts;
DROP POLICY IF EXISTS "Preview can read posts while auth is disabled" ON public.posts;

CREATE POLICY "Authenticated users can read own posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Preview can read temp posts while auth is disabled"
  ON public.posts FOR SELECT
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);