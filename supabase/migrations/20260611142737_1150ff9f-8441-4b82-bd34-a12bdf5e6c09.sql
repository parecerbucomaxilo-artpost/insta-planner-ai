-- Remove políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Allow public view of post-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

-- Cria nova política de leitura pública total para o bucket post-images
CREATE POLICY "Public Access for post-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');
