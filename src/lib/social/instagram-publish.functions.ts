import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const INSTAGRAM_GRAPH_URL = "https://graph.facebook.com/v19.0";

type IgPublishInput = {
  caption: string;
  imageUrl: string;
};

type IgPublishResult = {
  ok: boolean;
  postId?: string;
  error?: string;
};

const publishToInstagramSchema = z.object({
  caption: z.string(),
  imageUrl: z.string(),
});

export const publishToInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => publishToInstagramSchema.parse(d))
  .handler(async ({ data: input }): Promise<IgPublishResult> => {
    try {
      if (!input) throw new Error("Dados de entrada ausentes");

      // 1. Buscar tokens do usuário
      const { data: perfil, error: perfilError } = await supabase
        .from("perfil_usuario")
        .select("instagram_access_token, instagram_business_account_id")
        .limit(1)
        .maybeSingle();

      if (perfilError || !perfil?.instagram_access_token || !perfil?.instagram_business_account_id) {
        throw new Error("Instagram não configurado. Vá em Configurações -> Integrações.");
      }

      const { instagram_access_token: token, instagram_business_account_id: igId } = perfil;

      // 2. Criar container de mídia
      const containerRes = await fetch(`${INSTAGRAM_GRAPH_URL}/${igId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: input.imageUrl,
          caption: input.caption,
          access_token: token,
        }),
      });

      const containerData = await containerRes.json();
      if (!containerRes.ok) throw new Error(containerData.error?.message || "Erro ao criar container IG");

      const creationId = containerData.id;

      // 3. Publicar container
      const publishRes = await fetch(`${INSTAGRAM_GRAPH_URL}/${igId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: token,
        }),
      });

      const publishData = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishData.error?.message || "Erro ao publicar no IG");

      return { ok: true, postId: publishData.id };
    } catch (e) {
      console.error("[publishToInstagram]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

