import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

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
              "id, tipo_post, url_imagem, legenda_instagram, legenda_linkedin, data_agendamento"
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

          return new Response(
            JSON.stringify({
              id: data.id,
              tipo_post: data.tipo_post,
              url_imagem: data.url_imagem,
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
