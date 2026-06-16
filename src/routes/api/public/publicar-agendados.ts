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
        // PUBLICAÇÃO AUTOMÁTICA DESATIVADA.
        // Todos os posts (Story, Feed, Reels, Carrossel, LinkedIn, Google Business)
        // exigem aprovação manual no preview antes de ir ao ar.
        // Use approvePost({ acao: "publicar" }) a partir da interface.
        return json({
          ok: true,
          published: 0,
          message: "Publicação automática desativada — todos os posts exigem aprovação manual no preview.",
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
