
DROP POLICY IF EXISTS "Preview can create posts while auth is disabled" ON public.posts;
DROP POLICY IF EXISTS "Preview can delete temp posts while auth is disabled" ON public.posts;
DROP POLICY IF EXISTS "Preview can read temp posts while auth is disabled" ON public.posts;
DROP POLICY IF EXISTS "Preview can update temp posts while auth is disabled" ON public.posts;
DROP POLICY IF EXISTS "Preview can upload temp post-images" ON storage.objects;
DROP POLICY IF EXISTS "Preview can update temp post-images" ON storage.objects;
DROP POLICY IF EXISTS "Preview can delete temp post-images" ON storage.objects;
