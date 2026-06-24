import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";

const AccountInput = z.object({
  conta: z.string().min(2).max(80),
});

const SaveDestinationInput = AccountInput.extend({
  webhookUrl: z.string().url(),
});

function normalizeAccount(conta: string) {
  const normalized = conta.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{2,80}$/.test(normalized)) {
    throw new Error("Informe um @ de Instagram válido.");
  }
  return normalized;
}

function validateWebhookUrl(webhookUrl: string) {
  const url = new URL(webhookUrl.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Cole uma URL de webhook válida (https://...).");
  }
  return url.toString();
}

export const getPublicationDestination = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AccountInput.parse(data))
  .handler(async ({ data }) => {
    const conta = normalizeAccount(data.conta);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: perfil, error } = await supabaseAdmin
      .from("perfil_usuario")
      .select("instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url")
      .or(`arroba_usuario.ilike.${conta},instagram_arroba.ilike.${conta}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`DB: ${error.message}`);

    const hasMeta = Boolean(perfil?.instagram_access_token && perfil?.instagram_business_account_id);
    const webhookUrl = String(perfil?.instagram_webhook_url || perfil?.webhook_url || "");

    return {
      webhookUrl,
      status: hasMeta || webhookUrl ? "ok" : "missing",
    } as const;
  });

export const savePublicationDestination = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SaveDestinationInput.parse(data))
  .handler(async ({ data }) => {
    const conta = normalizeAccount(data.conta);
    const webhookUrl = validateWebhookUrl(data.webhookUrl);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: findError } = await supabaseAdmin
      .from("perfil_usuario")
      .select("id")
      .or(`arroba_usuario.ilike.${conta},instagram_arroba.ilike.${conta}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw new Error(`DB: ${findError.message}`);

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("perfil_usuario")
        .update({
          arroba_usuario: conta,
          instagram_arroba: conta,
          instagram_webhook_url: webhookUrl,
          webhook_url: webhookUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(`DB: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin.from("perfil_usuario").insert({
        user_id: TEMP_USER_ID,
        nome_profissional: conta,
        arroba_usuario: conta,
        instagram_arroba: conta,
        instagram_webhook_url: webhookUrl,
        webhook_url: webhookUrl,
      });
      if (error) throw new Error(`DB: ${error.message}`);
    }

    return { webhookUrl, status: "ok" } as const;
  });