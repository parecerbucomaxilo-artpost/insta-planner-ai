DROP POLICY IF EXISTS "Preview can upload temp post-images" ON storage.objects;
DROP POLICY IF EXISTS "Preview can update temp post-images" ON storage.objects;
DROP POLICY IF EXISTS "Preview can delete temp post-images" ON storage.objects;

CREATE POLICY "Preview can upload temp post-images"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000000'
);

CREATE POLICY "Preview can update temp post-images"
ON storage.objects
FOR UPDATE
TO anon
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000000'
)
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000000'
);

CREATE POLICY "Preview can delete temp post-images"
ON storage.objects
FOR DELETE
TO anon
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000000'
);