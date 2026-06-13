import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_REFRESH_MARGIN_MS = 60 * 60 * 1000;

function isCacheValid(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() > CACHE_REFRESH_MARGIN_MS;
}

export const Route = createFileRoute("/api/public/posts-agendados")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () => {
        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const nowIso = new Date().toISOString();

          const { data, error } = await supabaseAdmin
            .from("posts")
            .select(
              "id, tipo_post, url_imagem, url_imagem_cache, url_imagem_cache_expires_at, legenda_instagram, legenda_linkedin, data_agendamento"
            )
            .eq("status", "Agendado")
            .lte("data_agendamento", nowIso)
            .order("data_agendamento", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (error) {
            return new Response(
              JSON.stringify({ error: error.message }),
              {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          if (!data) {
            return new Response(
              JSON.stringify({ post: null, message: "Nenhum post agendado pronto para publicação." }),
              {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          let urlImagem = isCacheValid(data.url_imagem_cache_expires_at)
            ? data.url_imagem_cache
            : data.url_imagem;
          let refreshedCache = false;
          if (urlImagem) {
            try {
              const url = new URL(urlImagem);
              const parts = url.pathname.split("/").filter(Boolean);
              const objectIndex = parts.findIndex((part) => part === "object");
              const bucket = objectIndex >= 0 ? parts[objectIndex + 2] : null;
              const path = objectIndex >= 0 ? parts.slice(objectIndex + 3).map(decodeURIComponent).join("/") : null;
              if (bucket && path && !isCacheValid(data.url_imagem_cache_expires_at)) {
                const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
                urlImagem = signed?.signedUrl ?? urlImagem;
                refreshedCache = Boolean(signed?.signedUrl);
              }
            } catch {
              urlImagem = data.url_imagem;
            }
          }

          if (refreshedCache && urlImagem) {
            await supabaseAdmin
              .from("posts")
              .update({
                url_imagem_cache: urlImagem,
                url_imagem_cache_expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
              })
              .eq("id", data.id);
          }

          return new Response(
            JSON.stringify({
              id: data.id,
              tipo_post: data.tipo_post,
              url_imagem: urlImagem,
              legenda_instagram: data.legenda_instagram,
              legenda_linkedin: data.legenda_linkedin,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          return new Response(
            JSON.stringify({ error: message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
      },
    },
  },
});
