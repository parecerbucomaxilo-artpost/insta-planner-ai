-- Garante acesso público de leitura para as imagens
DROP POLICY IF EXISTS "Public Access for post-images" ON storage.objects;
CREATE POLICY "Public Access for post-images" ON storage.objects 
FOR SELECT USING (bucket_id = 'post-images');

-- Permite que usuários autenticados façam upload
DROP POLICY IF EXISTS "Allow authenticated management of own post-images" ON storage.objects;
CREATE POLICY "Allow authenticated management of own post-images" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Allow authenticated update of own post-images" ON storage.objects;
CREATE POLICY "Allow authenticated update of own post-images" ON storage.objects 
FOR UPDATE TO authenticated USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Allow authenticated delete of own post-images" ON storage.objects;
CREATE POLICY "Allow authenticated delete of own post-images" ON storage.objects 
FOR DELETE TO authenticated USING (bucket_id = 'post-images');