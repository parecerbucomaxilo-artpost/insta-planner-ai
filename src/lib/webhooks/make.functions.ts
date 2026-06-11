import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEFAULT_MAKE_WEBHOOK_URL = "https://hook.us2.make.com/vxh3w2d4e014i1rkig6xxp2dm6fkxprn";

export const dispatchMakeWebhook = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      texto: z.string(),
      imagem_url: z.string(),
      custom_webhook_url: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[MakeServerFn] Iniciando disparo via servidor...");
    
    const webhookUrl = data.custom_webhook_url || DEFAULT_MAKE_WEBHOOK_URL;

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          texto: data.texto,
          imagem_url: data.imagem_url
        }),
      });

      console.log("[MakeServerFn] Resposta do Make:", response.status);

      if (!response.ok) {
        throw new Error(`Make respondeu com erro: ${response.status}`);
      }

      const responseText = await response.text();
      return { success: true, status: response.status, response: responseText };
    } catch (error) {
      console.error("[MakeServerFn] Erro no disparo:", error);
      throw error;
    }
  });
