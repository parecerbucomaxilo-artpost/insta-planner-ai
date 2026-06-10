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
    console.log("[Webhook] Iniciando disparo para Make:", { 
      has_image: !!data.media_url, 
      image_is_base64: data.media_url?.startsWith("data:"),
      caption_length: data.caption?.length 
    });

    try {
      const webhookUrl = MAKE_WEBHOOK_URL;

      // Se por algum motivo ainda chegar base64 aqui, avisamos no log (não deve ocorrer com o novo fluxo do frontend)
      if (data.media_url?.startsWith("data:")) {
        console.warn("[Webhook] ALERTA: Recebido base64 no servidor. Isso pode causar lentidão ou erro de payload.");
      }

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

      console.log("[Webhook] Resposta do Make:", { status: res.status, ok: res.ok });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      console.error("[Webhook] Erro fatal ao disparar:", err);
      return { ok: false, status: 0, error: err instanceof Error ? err.message : "unknown" };
    }
  });
