-- Remover políticas antigas
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to post-images" ON storage.objects;

-- Política para permitir leitura pública
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

-- Política para permitir upload seguro
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
