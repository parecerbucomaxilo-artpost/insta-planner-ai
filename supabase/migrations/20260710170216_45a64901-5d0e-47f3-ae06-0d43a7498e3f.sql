CREATE POLICY "Authenticated can read shared app posts"
ON public.posts FOR SELECT
TO authenticated
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Authenticated can update shared app posts"
ON public.posts FOR UPDATE
TO authenticated
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid)
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Authenticated can delete shared app posts"
ON public.posts FOR DELETE
TO authenticated
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);