-- Criar bucket se não existir (via SQL direto na tabela buckets do schema storage é desencorajado, mas aqui usamos o padrão seguro)
-- Nota: A ferramenta supabase--storage_create_bucket é a preferida para criar o bucket, mas as políticas precisam estar na migração.

-- Grant select on storage.objects to anon for public access
GRANT SELECT ON TABLE storage.objects TO anon;
GRANT SELECT ON TABLE storage.objects TO authenticated;

-- Policies for the bucket
-- Note: 'posts_media' bucket should be created first via storage_create_bucket tool.

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'posts_media');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts_media' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'posts_media' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE USING (bucket_id = 'posts_media' AND auth.role() = 'authenticated');