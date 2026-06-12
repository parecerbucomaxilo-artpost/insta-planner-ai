DROP POLICY IF EXISTS "Temporary visitor can view temporary posts" ON public.posts;
DROP POLICY IF EXISTS "Temporary visitor can create temporary posts" ON public.posts;
DROP POLICY IF EXISTS "Temporary visitor can update temporary posts" ON public.posts;
DROP POLICY IF EXISTS "Temporary visitor can delete temporary posts" ON public.posts;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.posts FROM anon;