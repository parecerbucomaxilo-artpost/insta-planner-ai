ALTER TABLE public.perfil_usuario ADD COLUMN IF NOT EXISTS instagram_connection jsonb;
COMMENT ON COLUMN public.perfil_usuario.instagram_connection IS 'Server-only Instagram lifecycle: login flow, expiry, refresh, authorization state. Tokens remain in existing instagram_access_token.';
REVOKE SELECT, INSERT, UPDATE ON public.perfil_usuario FROM anon, authenticated;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(column_name), ', ') INTO cols FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'perfil_usuario' AND column_name NOT IN ('instagram_access_token', 'instagram_business_account_id', 'instagram_connection');
 EXECUTE 'GRANT SELECT (' || cols || '), INSERT (' || cols || '), UPDATE (' || cols || ') ON public.perfil_usuario TO authenticated';
END $$;
GRANT ALL ON public.perfil_usuario TO service_role;
CREATE OR REPLACE FUNCTION public.save_instagram_connection(p_perfil uuid, p_account text, p_ig_id text, p_token text, p_metadata jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; existing_id uuid; current_ig text;
BEGIN
 SELECT user_id, instagram_business_account_id INTO owner_id, current_ig FROM public.perfil_usuario WHERE id = p_perfil;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Perfil inexistente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || p_ig_id, 0));
 SELECT id INTO existing_id FROM public.perfil_usuario WHERE user_id = owner_id AND (instagram_business_account_id = p_ig_id OR lower(ltrim(instagram_arroba, '@')) = lower(p_account)) ORDER BY created_at DESC LIMIT 1;
 IF existing_id IS NULL AND (current_ig IS NULL OR current_ig = p_ig_id) THEN existing_id := p_perfil; END IF;
 IF existing_id IS NULL THEN
  INSERT INTO public.perfil_usuario(user_id, nome_profissional, arroba_usuario, instagram_arroba, instagram_business_account_id, instagram_access_token, instagram_connection) VALUES(owner_id, p_account, p_account, p_account, p_ig_id, p_token, p_metadata) RETURNING id INTO existing_id;
 ELSE
  UPDATE public.perfil_usuario SET instagram_arroba = p_account, arroba_usuario = p_account, instagram_business_account_id = p_ig_id, instagram_access_token = p_token, instagram_connection = p_metadata, updated_at = now() WHERE id = existing_id AND user_id = owner_id;
 END IF;
 RETURN existing_id;
END $$;
REVOKE ALL ON FUNCTION public.save_instagram_connection(uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_instagram_connection(uuid,text,text,text,jsonb) TO service_role;