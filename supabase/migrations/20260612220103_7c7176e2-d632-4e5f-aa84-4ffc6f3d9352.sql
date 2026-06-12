GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO anon;

CREATE POLICY "Temporary visitor can view temporary posts"
ON public.posts
FOR SELECT
TO anon
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Temporary visitor can create temporary posts"
ON public.posts
FOR INSERT
TO anon
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Temporary visitor can update temporary posts"
ON public.posts
FOR UPDATE
TO anon
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid)
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Temporary visitor can delete temporary posts"
ON public.posts
FOR DELETE
TO anon
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);