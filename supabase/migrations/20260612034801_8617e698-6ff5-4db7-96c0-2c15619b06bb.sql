-- Remove políticas permissivas do bucket post-images que não verificam dono
DROP POLICY IF EXISTS "Allow authenticated management of own post-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update of own post-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete of own post-images" ON storage.objects;

-- Recria com verificação de dono via primeiro segmento do path = auth.uid()
CREATE POLICY "post_images_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "post_images_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "post_images_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);