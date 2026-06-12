import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEFAULT_MAKE_WEBHOOK_URL = "https://hook.us2.make.com/vxh3w2d4e014i1rkig6xxp2dm6fkxprn";

export const dispatchMakeWebhook = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      texto: z.string(),
      url_da_imagem: z.string(),
      rede_social: z.string().optional(),
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
          url_da_imagem: data.url_da_imagem,
          rede_social: data.rede_social || "Instagram"
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
