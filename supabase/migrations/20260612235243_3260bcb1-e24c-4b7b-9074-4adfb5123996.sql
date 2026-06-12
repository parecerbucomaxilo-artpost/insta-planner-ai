GRANT UPDATE, DELETE ON public.posts TO anon;

DROP POLICY IF EXISTS "Preview can update temp posts while auth is disabled" ON public.posts;
CREATE POLICY "Preview can update temp posts while auth is disabled"
ON public.posts
FOR UPDATE
TO anon
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid)
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Preview can delete temp posts while auth is disabled" ON public.posts;
CREATE POLICY "Preview can delete temp posts while auth is disabled"
ON public.posts
FOR DELETE
TO anon
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);