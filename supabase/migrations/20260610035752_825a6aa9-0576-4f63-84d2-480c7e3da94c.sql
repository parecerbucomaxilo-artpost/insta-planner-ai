-- Policies for the 'posts_media' bucket in storage.objects

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access for posts_media'
    ) THEN
        CREATE POLICY "Public Access for posts_media" ON storage.objects FOR SELECT USING (bucket_id = 'posts_media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can upload to posts_media'
    ) THEN
        CREATE POLICY "Authenticated users can upload to posts_media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts_media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can update in posts_media'
    ) THEN
        CREATE POLICY "Authenticated users can update in posts_media" ON storage.objects FOR UPDATE USING (bucket_id = 'posts_media');
    END IF;
END $$;
