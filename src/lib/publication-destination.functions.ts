import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEMP_USER_ID = "00000000-0000-0000-0000-000000000000";
const AccountInput = z.object({
  conta: z.string().min(2).max(80),
});

function normalizeAccount(conta: string) {
  const normalized = conta.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{2,80}$/.test(normalized)) {
    throw new Error("Informe um @ de Instagram válido.");
  }
  return normalized;
}

async function findProfileByAccount(supabaseAdmin: any, conta: string, columns: string, userId: string) {
  const variants = [conta, `@${conta}`];
  const fields = ["arroba_usuario", "instagram_arroba"];

  for (const field of fields) {
    for (const value of variants) {
      const { data, error } = await supabaseAdmin
        .from("perfil_usuario")
        .select(columns)
        .eq("user_id", userId)
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AccountInput.parse(data))
  .handler(async ({ data, context }) => {
    const conta = normalizeAccount(data.conta);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const perfil = await findProfileByAccount(
      supabaseAdmin,
      conta,
      "id,user_id,instagram_access_token,instagram_business_account_id,instagram_connection",
      context.userId,
    );

    const { maintainInstagramConnection } = await import("./instagram-connection.server");
    const result = perfil ? await maintainInstagramConnection(supabaseAdmin, perfil) : { state: "missing" };
    const hasMeta = result.state === "connected";

    return {
      webhookUrl: "",
      hasMeta,
      mode: hasMeta ? "meta" : "missing",
      status: hasMeta ? "ok" : "missing",
      connectionState: result.state,
    } as const;
  });

export const ensurePublicationDestinationProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AccountInput.parse(data))
  .handler(async ({ data, context }) => {
    const conta = normalizeAccount(data.conta);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await findProfileByAccount(context.supabase, conta, "id,user_id", context.userId);

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

function sanitizeAccessToken(value: string) {
  let token = value
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();

  const accessTokenMatch = token.match(/(?:^|[?&#\s])access_token=([^&#\s]+)/i);
  if (accessTokenMatch?.[1]) {
    token = decodeURIComponent(accessTokenMatch[1]);
  }

  return token.replace(/\s+/g, "");
}

function metaErrorMessage(payload: any, fallback: string) {
  return payload?.error?.message || payload?.error_message || payload?.message || fallback;
}

function normalizeOptionalAccount(value: string | null | undefined) {
  return value ? normalizeAccount(value) : null;
}

async function validateInstagramTokenForAccount(token: string, igBusinessId: string, conta: string) {
  const expectedAccount = normalizeOptionalAccount(conta);
  const checks = [
    {
      host: "graph.facebook.com",
      edge: `${igBusinessId}`,
      fields: "username",
    },
    {
      host: "graph.instagram.com",
      edge: "me",
      fields: "user_id,username",
    },
  ];

  let lastError = "Token não validado.";
  for (const check of checks) {
    const url = new URL(`https://${check.host}/v21.0/${check.edge}`);
    url.searchParams.set("fields", check.fields);
    url.searchParams.set("access_token", token);
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      lastError = metaErrorMessage(json, `Meta respondeu ${res.status}`);
      continue;
    }

    const username = normalizeOptionalAccount(json.username);
    const returnedId = String(json.user_id || json.id || "");
    if (returnedId && returnedId !== igBusinessId && check.host === "graph.instagram.com") {
      lastError = `O token informado pertence ao ID ${returnedId}, não ao IG Business ID ${igBusinessId}.`;
      continue;
    }
    if (expectedAccount && username && username !== expectedAccount) {
      throw new Error(`Token pertence a @${username}, mas o destino selecionado é @${expectedAccount}.`);
    }
    return;
  }

  throw new Error(
    `Access Token inválido ou sem permissão para publicar nessa conta: ${lastError}. ` +
    "Gere um novo token com instagram_content_publish/pages_show_list ou reconecte a conta pelo Meta.",
  );
}

export const saveManualInstagramToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ManualTokenInput.parse(data))
  .handler(async ({ data, context }) => {
    const conta = normalizeAccount(data.conta);
    const accessToken = sanitizeAccessToken(data.accessToken);
    if (!/^[A-Za-z0-9._\-]{20,}$/.test(accessToken)) {
      throw new Error("Cole apenas o Access Token, sem espaços, aspas, URL completa ou texto adicional.");
    }
    const igBusinessId = data.igBusinessId.trim();
    await validateInstagramTokenForAccount(accessToken, igBusinessId, conta);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await findProfileByAccount(context.supabase, conta, "id", context.userId);
    const payload = {
      user_id: context.userId,
      nome_profissional: conta,
      arroba_usuario: conta,
      instagram_arroba: conta,
      instagram_access_token: accessToken,
      instagram_business_account_id: igBusinessId,
      instagram_connection: { flow: "unknown", state: "connected", checkedAt: new Date().toISOString() },
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