-- Allow authenticated users to upload images to 'post-images'
CREATE POLICY "Allow authenticated uploads to post-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images');

-- Allow anyone to view images in 'post-images' (needed for public URL/webhooks)
CREATE POLICY "Allow public view of post-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Allow authenticated users to update/delete their own uploads if needed
CREATE POLICY "Allow authenticated management of own post-images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'post-images' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'post-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
