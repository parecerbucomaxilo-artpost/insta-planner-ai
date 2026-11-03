export type LinkedInStatus = { connected: boolean; message: string };

export const LINKEDIN_RECONNECT_MESSAGE =
  "LinkedIn indisponível — reconecte a integração nas configurações de conexões do Lovable para publicar ou agendar no LinkedIn. O painel e as demais ferramentas continuam disponíveis.";

/** Read-only check. Never starts OAuth, publishes, or returns credentials/profile data. */
export async function checkLinkedInConnection(
  lovableKey: string | undefined,
  connectionKey: string | undefined,
  request: typeof fetch = fetch,
): Promise<LinkedInStatus> {
  if (!lovableKey || !connectionKey) {
    return { connected: false, message: LINKEDIN_RECONNECT_MESSAGE };
  }
  try {
    const response = await request("https://connector-gateway.lovable.dev/linkedin/v2/userinfo", {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connectionKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { connected: false, message: LINKEDIN_RECONNECT_MESSAGE };
    const member = await response.json() as { sub?: unknown };
    const connected = typeof member.sub === "string" && member.sub.length > 0;
    return {
      connected,
      message: connected ? "LinkedIn conectado. Integração opcional para publicação." : LINKEDIN_RECONNECT_MESSAGE,
    };
  } catch {
    return { connected: false, message: LINKEDIN_RECONNECT_MESSAGE };
  }
}

export function canSendToLinkedIn(status: LinkedInStatus | null | undefined): boolean {
  return status?.connected === true;
}