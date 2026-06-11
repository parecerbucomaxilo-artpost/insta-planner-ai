
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update in posts_media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to posts_media" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for posts_media" ON storage.objects;

CREATE POLICY "posts_media_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'posts_media' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "posts_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts_media' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "posts_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'posts_media' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'posts_media' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "posts_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'posts_media' AND (auth.uid())::text = (storage.foldername(name))[1]);
