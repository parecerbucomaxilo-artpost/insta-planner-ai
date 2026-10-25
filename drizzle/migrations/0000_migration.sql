DROP POLICY IF EXISTS "Public Access for post-images" ON storage.objects;
CREATE POLICY "post_images_select_owner_or_post" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'post-images' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR owner_id = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE (p.user_id = auth.uid() OR p.user_id = '00000000-0000-0000-0000-000000000000'::uuid)
        AND (position(objects.name in coalesce(p.url_imagem,'')) > 0
             OR position(objects.name in p.imagens_carrossel::text) > 0)
    )
  )
);