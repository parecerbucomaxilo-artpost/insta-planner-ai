import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/woig439jfttlafb64nc425f6fy4353i3";

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
      // Priorizamos o Webhook específico solicitado pelo usuário
      const webhookUrl = MAKE_WEBHOOK_URL;

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: data.caption ?? "",
          imagem_url: data.media_url ?? null,
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
