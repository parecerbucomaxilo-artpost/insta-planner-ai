export type InstagramLifecycle = {
  flow?: "instagram" | "facebook" | "unknown";
  state?: "connected" | "reconnect";
  expiresAt?: string | null;
  issuedAt?: string;
  refreshedAt?: string;
  checkedAt?: string;
};
export type InstagramState = "connected" | "reconnect" | "unverified" | "missing";
export function connectionState(hasCredentials: boolean, meta: InstagramLifecycle | null, now = Date.now()): InstagramState {
  if (meta?.state === "reconnect") return "reconnect";
  if (!hasCredentials) return "missing";
  if (meta?.expiresAt && Date.parse(meta.expiresAt) <= now) return "reconnect";
  return meta?.checkedAt ? "connected" : "unverified";
}
export function shouldRefresh(meta: InstagramLifecycle | null, now = Date.now()) {
  if (meta?.flow !== "instagram" || meta.state === "reconnect" || !meta.expiresAt) return false;
  const expiry = Date.parse(meta.expiresAt);
  const issued = Date.parse(meta.refreshedAt || meta.issuedAt || "");
  return Number.isFinite(issued) && now - issued >= 24 * 3600_000 && expiry > now && expiry - now < 7 * 24 * 3600_000;
}
export function lifecycleFromOAuth(flow: "instagram" | "facebook", expiresIn?: number, now = Date.now()): InstagramLifecycle {
  return { flow, state: "connected", issuedAt: new Date(now).toISOString(), checkedAt: new Date(now).toISOString(), expiresAt: expiresIn && expiresIn > 0 ? new Date(now + expiresIn * 1000).toISOString() : null };
}
export class InstagramAuthorizationError extends Error {
  constructor() { super("Autorização Instagram expirada ou revogada. Reconecte a conta em Configurações."); }
}
export function assertInstagramResponse(response: { ok: boolean; status: number }, json: { error?: { code?: number } }) {
  if (json.error?.code === 190 || json.error?.code === 102) throw new InstagramAuthorizationError();
  if (!response.ok || json.error) throw new Error(`Instagram indisponível ou sem permissão para esta ação (${response.status}). A conexão salva foi preservada.`);
}
export const PROFILE_PUBLIC_COLUMNS = "id,user_id,nome_profissional,arroba_usuario,url_logo,instagram_arroba,instagram_foto_url,linkedin_nome,linkedin_foto_url,cro_uf,subespecialidades,tom_voz,linkedin_webhook_url,instagram_webhook_url,webhook_url,buffer_access_token";

export function validOAuthNonce(nonce: string | undefined, now = Date.now()) {
  const issued = Number(nonce?.split("~")[1]);
  return Number.isFinite(issued) && issued > 0 && issued <= now && now - issued <= 30 * 60_000;
}