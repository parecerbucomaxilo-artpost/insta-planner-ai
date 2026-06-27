import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";

export const Route = createFileRoute("/api/public/dispatch-liga")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const { requireCronSecret } = await import("@/lib/cron-auth.server");
        const denied = requireCronSecret(request);
        if (denied) return denied;

        if (!process.env.MAKE_LIGA_WEBHOOK_URL) {
          return json({ error: "MAKE_LIGA_WEBHOOK_URL não configurado" }, 500);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { publishInstagramPostById } = await import("@/lib/social/instagram-publish.server");

        const { data: posts, error } = await supabaseAdmin
          .from("posts")
          .select("id,user_id")
          .eq("postar_instagram", true)
          .eq("instagram_conta", LIGA_ACCOUNT)
          .eq("status", "Agendado")
          .is("liga_dispatched_at", null)
          .lte("data_agendamento", new Date().toISOString())
          .order("data_agendamento", { ascending: true })
          .limit(10);

        if (error) return json({ error: error.message }, 500);
        if (!posts || posts.length === 0) return json({ ok: true, dispatched: 0 });

        const results: Array<{ id: string; ok: boolean; status?: string; via?: string; error?: string }> = [];

        for (const post of posts as Array<{ id: string; user_id: string | null }>) {
          try {
            const result = await publishInstagramPostById({
              supabaseAdmin,
              postId: post.id,
              userId: post.user_id || TEMP_USER_ID,
            });
            results.push({ id: post.id, ok: true, status: result.status, via: result.via });
          } catch (err) {
            results.push({ id: post.id, ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" });
          }
        }

        return json({
          ok: true,
          dispatched: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          results,
        });
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