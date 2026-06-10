import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FALLBACK_WEBHOOK_URL =
  "https://h.albato.com/wh/38/1lfds2n/dinfhr571VvcgIB5bHqOChq0jVVYnN7ZndwJdQNJXmE/";

export const dispatchAlbato = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      media_url: z.string().nullable().optional(),
      caption: z.string().default(""),
      data_agendamento: z.string().nullable().optional(),
      post_id: z.string().optional(),
      status: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      // Busca webhook customizado no perfil do usuário
      const { data: perfil } = await supabaseAdmin
        .from("perfil_usuario")
        .select("webhook_url")
        .limit(1)
        .maybeSingle();

      const webhookUrl = perfil?.webhook_url || FALLBACK_WEBHOOK_URL;

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: data.media_url ?? null,
          caption: data.caption ?? "",
          data_agendamento: data.data_agendamento ?? null,
          post_id: data.post_id ?? null,
          status: data.status ?? null,
        }),
      });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      console.error("[Webhook] error", err);
      return { ok: false, status: 0, error: err instanceof Error ? err.message : "unknown" };
    }
  });
