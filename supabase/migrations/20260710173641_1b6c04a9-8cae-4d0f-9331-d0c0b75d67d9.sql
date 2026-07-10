
-- Role infrastructure to restrict shared posts writes to admins
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Bootstrap: grant admin to all existing users (single-tenant team app).
-- Future signups will NOT be admins by default.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Replace permissive write policies on shared app posts with admin-only ones
DROP POLICY IF EXISTS "Authenticated can update shared app posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated can delete shared app posts" ON public.posts;

CREATE POLICY "Admins can update shared app posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete shared app posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND public.has_role(auth.uid(), 'admin')
  );
