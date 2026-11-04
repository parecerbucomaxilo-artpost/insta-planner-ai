import { assertInstagramResponse, connectionState, InstagramAuthorizationError, shouldRefresh, type InstagramLifecycle } from "./instagram-connection";

/** Server-only credential lifecycle. Caller must supply an already authorized owner. */
export async function maintainInstagramConnection(db: any, perfil: any, now = Date.now(), request: typeof fetch = fetch) {
  let meta: InstagramLifecycle = perfil.instagram_connection || {};
  let token: string | null = perfil.instagram_access_token;
  const hasCredentials = Boolean(token && perfil.instagram_business_account_id);
  const persist = async (next: InstagramLifecycle, nextToken?: string) => {
    const { data, error } = await db.from("perfil_usuario").update({ instagram_connection: next, ...(nextToken ? { instagram_access_token: nextToken } : {}) })
      .eq("id", perfil.id).eq("user_id", perfil.user_id).eq("instagram_access_token", token).select("id").maybeSingle();
    if (error || !data) throw new Error("Não foi possível sincronizar Instagram. Credenciais anteriores preservadas; tente novamente.");
    meta = next;
    if (nextToken) token = nextToken;
  };
  if (connectionState(hasCredentials, meta, now) === "reconnect") {
    if (meta.state !== "reconnect") await persist({ ...meta, state: "reconnect" });
    return { state: "reconnect" as const, token };
  }
  if (!hasCredentials || !token) return { state: "missing" as const, token: null };
  try {
    if (shouldRefresh(meta, now)) {
      const url = new URL("https://graph.instagram.com/refresh_access_token");
      url.searchParams.set("grant_type", "ig_refresh_token"); url.searchParams.set("access_token", token);
      const res = await request(url); const body = await res.json();
      assertInstagramResponse(res, body);
      if (typeof body.access_token !== "string" || !Number.isFinite(body.expires_in) || body.expires_in <= 0) throw new Error("Renovação Instagram incompleta. Conexão anterior preservada.");
      await persist({ ...meta, state: "connected", refreshedAt: new Date(now).toISOString(), checkedAt: new Date(now).toISOString(), expiresAt: new Date(now + body.expires_in * 1000).toISOString() }, body.access_token);
    } else if (!meta.checkedAt || now - Date.parse(meta.checkedAt) > 3600_000) {
      const hosts = meta.flow === "instagram" ? ["graph.instagram.com"] : meta.flow === "facebook" ? ["graph.facebook.com"] : ["graph.facebook.com", "graph.instagram.com"];
      let lastError: unknown;
      let verified = false;
      let invalid = 0;
      for (const host of hosts) {
        try {
          const url = new URL(`https://${host}/v21.0/${perfil.instagram_business_account_id}`);
          url.searchParams.set("fields", "id,username"); url.searchParams.set("access_token", token || "");
          const res = await request(url); const body = await res.json(); assertInstagramResponse(res, body);
          if (String(body.id || body.user_id) !== String(perfil.instagram_business_account_id)) throw new Error("Conta Instagram não confirmada; conexão preservada.");
          await persist({ ...meta, flow: host === "graph.instagram.com" ? "instagram" : "facebook", state: "connected", checkedAt: new Date(now).toISOString() });
          verified = true; break;
        } catch (error) { lastError = error; if (error instanceof InstagramAuthorizationError) invalid++; }
      }
      if (!verified) { if (invalid === hosts.length) throw new InstagramAuthorizationError(); throw lastError; }
    }
    return { state: connectionState(true, meta, now), token };
  } catch (error) {
    if (error instanceof InstagramAuthorizationError) { await persist({ ...meta, state: "reconnect" }); return { state: "reconnect" as const, token }; }
    // Never log provider payloads, request URLs, tokens, or arbitrary exceptions.
    return { state: "unverified" as const, token, message: "Não foi possível verificar ou renovar Instagram agora. Conta preservada; tente novamente." };
  }
}