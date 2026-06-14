import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

// Publica posts Agendados cuja data_agendamento já passou.
// Processa 1 post LinkedIn por chamada para evitar timeouts/burst.
export const Route = createFileRoute("/api/public/publicar-agendados")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { publishLinkedInPostById } = await import("@/lib/social/linkedin-publish.server");

          const agora = new Date().toISOString();
          const { data: pendentes, error } = await supabaseAdmin
            .from("posts")
            .select("id,user_id,postar_linkedin,data_agendamento")
            .eq("status", "Agendado")
            .eq("postar_linkedin", true)
            .lte("data_agendamento", agora)
            .order("data_agendamento", { ascending: true })
            .limit(1);
          if (error) return json({ error: error.message }, 500);

          if (!pendentes || pendentes.length === 0) {
            return json({ ok: true, published: 0 });
          }

          const post = pendentes[0];
          try {
            const r = await publishLinkedInPostById({ supabaseAdmin, postId: post.id, userId: post.user_id });
            return json({ ok: true, published: 1, post_id: post.id, shareUrl: r.shareUrl });
          } catch (err: any) {
            await supabaseAdmin
              .from("posts")
              .update({ status: "Erro", updated_at: new Date().toISOString() })
              .eq("id", post.id);
            return json({ ok: false, post_id: post.id, error: String(err?.message || err) }, 500);
          }
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
