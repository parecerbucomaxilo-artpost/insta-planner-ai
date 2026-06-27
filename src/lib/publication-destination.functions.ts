import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const LIGA_ACCOUNT = "lactbmf.anhanguerasbo";

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

async function findProfileByAccount(supabaseAdmin: any, conta: string, columns: string) {
  const variants = [conta, `@${conta}`];
  const fields = ["arroba_usuario", "instagram_arroba"];

  for (const field of fields) {
    for (const value of variants) {
      const { data, error } = await supabaseAdmin
        .from("perfil_usuario")
        .select(columns)
        .ilike(field, value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`DB: ${error.message}`);
      if (data) return data;
    }
  }

  return null;
}

export const getPublicationDestination = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AccountInput.parse(data))
  .handler(async ({ data }) => {
    const conta = normalizeAccount(data.conta);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const perfil = await findProfileByAccount(
      supabaseAdmin,
      conta,
      "instagram_access_token,instagram_business_account_id,instagram_webhook_url,webhook_url",
    );

    const hasMeta = Boolean(perfil?.instagram_access_token && perfil?.instagram_business_account_id);
    const webhookUrl = String(perfil?.instagram_webhook_url || perfil?.webhook_url || "");

    return {
      webhookUrl,
      hasMeta,
      mode: hasMeta ? "meta" : webhookUrl ? "webhook" : "missing",
      status: hasMeta || webhookUrl ? "ok" : "missing",
    } as const;
  });

export const savePublicationDestination = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SaveDestinationInput.parse(data))
  .handler(async ({ data }) => {
    const conta = normalizeAccount(data.conta);
    const webhookUrl = validateWebhookUrl(data.webhookUrl);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await findProfileByAccount(supabaseAdmin, conta, "id");

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

export const ensurePublicationDestinationProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AccountInput.parse(data))
  .handler(async ({ data, context }) => {
    const conta = normalizeAccount(data.conta);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await findProfileByAccount(supabaseAdmin, conta, "id,user_id");

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("perfil_usuario")
        .update({
          user_id: context.userId,
          nome_profissional: conta,
          arroba_usuario: conta,
          instagram_arroba: conta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(`DB: ${error.message}`);
      return { id: existing.id as string, conta };
    }

    const { data: created, error } = await supabaseAdmin
      .from("perfil_usuario")
      .insert({
        user_id: context.userId,
        nome_profissional: conta,
        arroba_usuario: conta,
        instagram_arroba: conta,
      })
      .select("id")
      .maybeSingle();

    if (error) throw new Error(`DB: ${error.message}`);
    if (!created?.id) throw new Error("Falha ao criar destino de publicação.");
    return { id: created.id as string, conta };
  });

const ManualTokenInput = AccountInput.extend({
  accessToken: z.string().min(20),
  igBusinessId: z.string().regex(/^\d{5,25}$/, "ID Instagram inválido (apenas dígitos)"),
});

export const saveManualInstagramToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ManualTokenInput.parse(data))
  .handler(async ({ data, context }) => {
    const conta = normalizeAccount(data.conta);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await findProfileByAccount(supabaseAdmin, conta, "id");
    const payload = {
      user_id: context.userId,
      nome_profissional: conta,
      arroba_usuario: conta,
      instagram_arroba: conta,
      instagram_access_token: data.accessToken.trim(),
      instagram_business_account_id: data.igBusinessId.trim(),
      updated_at: new Date().toISOString(),
    };
    if (existing?.id) {
      const { error } = await supabaseAdmin.from("perfil_usuario").update(payload).eq("id", existing.id);
      if (error) throw new Error(`DB: ${error.message}`);
      return { id: existing.id as string, conta, status: "ok" as const };
    }
    const { data: created, error } = await supabaseAdmin
      .from("perfil_usuario")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`DB: ${error.message}`);
    if (!created?.id) throw new Error("Falha ao salvar token Instagram manual.");
    return { id: created.id as string, conta, status: "ok" as const };
  });