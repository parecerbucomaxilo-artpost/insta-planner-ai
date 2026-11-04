import { describe, expect, it, vi } from "vitest";
import { connectionState, lifecycleFromOAuth, shouldRefresh, assertInstagramResponse, InstagramAuthorizationError, validOAuthNonce } from "./instagram-connection";
import { maintainInstagramConnection } from "./instagram-connection.server";

const now = Date.parse("2026-11-04T15:04:00Z");
function fixture(flow: "instagram" | "facebook" = "instagram", expires = 60 * 86400) {
  return { id: "profile-a", user_id: "user-a", instagram_business_account_id: "12345", instagram_access_token: "fixture-only-old", instagram_connection: lifecycleFromOAuth(flow, expires, now) };
}
function database(rows: any[]) {
  const writes: any[] = [];
  return { writes, from: () => {
    let payload: any; const filters: Record<string, any> = {};
    const q = { update: (p: any) => { payload = p; return q; }, eq: (k: string, v: any) => { filters[k] = v; return q; }, select: () => q,
      maybeSingle: async () => { const row = rows.find(r => Object.entries(filters).every(([k, v]) => r[k] === v)); if (!row) return { data: null, error: null }; writes.push({ payload, filters }); Object.assign(row, payload); return { data: { id: row.id }, error: null }; } };
    return q;
  } };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("Instagram connection lifecycle without provider calls", () => {
  it("OAuth callback timeout does not authorize stale or future state", () => {
    expect(validOAuthNonce(`fixture~${now}`, now)).toBe(true);
    expect(validOAuthNonce(`fixture~${now - 31 * 60_000}`, now)).toBe(false);
    expect(validOAuthNonce(`fixture~${now + 1}`, now)).toBe(false);
    expect(validOAuthNonce("legacy", now)).toBe(false);
  });
  it.each(["reload", "navigation", "editorial profile change", "reopen"])("%s restores durable credentials without disconnecting", async () => {
    const saved = fixture(); const db = database([saved]); const meta = vi.fn();
    const restored = JSON.parse(JSON.stringify(saved));
    expect((await maintainInstagramConnection(db, restored, now, meta)).state).toBe("connected");
    expect(db.writes).toHaveLength(0); expect(meta).not.toHaveBeenCalled();
  });
  it("refreshes valid long-lived Instagram token and persists the replacement", async () => {
    const saved = fixture(); saved.instagram_connection = lifecycleFromOAuth("instagram", 60 * 86400, now - 55 * 86400_000);
    const db = database([saved]); const meta = vi.fn().mockResolvedValue(response({ access_token: "fixture-only-new", expires_in: 60 * 86400 }));
    const result = await maintainInstagramConnection(db, { ...saved }, now, meta);
    expect(result.state).toBe("connected"); expect(meta).toHaveBeenCalledTimes(1);
    const url = meta.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe("https://graph.instagram.com/refresh_access_token"); expect(url.searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(saved.instagram_access_token).toBe("fixture-only-new"); expect(saved.instagram_connection.expiresAt).toBe("2027-01-03T15:04:00.000Z");
    expect((await maintainInstagramConnection(db, { ...saved }, now, meta)).state).toBe("connected"); expect(meta).toHaveBeenCalledTimes(1);
  });
  it("does not refresh before 24 hours or after expiration or Facebook Page tokens", () => {
    expect(shouldRefresh(lifecycleFromOAuth("instagram", 3 * 86400, now), now)).toBe(false);
    expect(shouldRefresh(lifecycleFromOAuth("instagram", 86400, now - 2 * 86400_000), now)).toBe(false);
    expect(shouldRefresh(lifecycleFromOAuth("facebook", 3 * 86400, now - 2 * 86400_000), now)).toBe(false);
  });
  it("expired token retains credentials and persists reconnect without a Meta call", async () => {
    const saved = fixture("instagram", 1); const db = database([saved]); const meta = vi.fn();
    expect((await maintainInstagramConnection(db, { ...saved }, now + 2000, meta)).state).toBe("reconnect");
    expect(saved.instagram_access_token).toBe("fixture-only-old"); expect(saved.instagram_business_account_id).toBe("12345"); expect(saved.instagram_connection.state).toBe("reconnect"); expect(meta).not.toHaveBeenCalled();
  });
  it("confirmed revocation preserves token/account and persists reconnect", async () => {
    const saved = fixture(); saved.instagram_connection.checkedAt = new Date(now - 7200_000).toISOString(); const db = database([saved]);
    const meta = vi.fn().mockResolvedValue(response({ error: { code: 190 } }, 400));
    expect((await maintainInstagramConnection(db, { ...saved }, now, meta)).state).toBe("reconnect");
    expect(saved.instagram_access_token).toBe("fixture-only-old"); expect(saved.instagram_business_account_id).toBe("12345");
  });
  it.each([429, 503, 403])("transient/permission response %s never clears authorization", async status => {
    const saved = fixture(); saved.instagram_connection.checkedAt = new Date(now - 7200_000).toISOString(); const db = database([saved]);
    const meta = vi.fn().mockResolvedValue(response({ error: { code: status === 403 ? 10 : 2, message: "OAuthException access token" } }, status));
    expect((await maintainInstagramConnection(db, { ...saved }, now, meta)).state).toBe("unverified"); expect(db.writes).toHaveLength(0); expect(saved.instagram_connection.state).toBe("connected");
  });
  it("failed refresh keeps previous token and marks unverified, not connected", async () => {
    const saved = fixture(); saved.instagram_connection = lifecycleFromOAuth("instagram", 60 * 86400, now - 55 * 86400_000); const db = database([saved]);
    expect((await maintainInstagramConnection(db, { ...saved }, now, vi.fn().mockRejectedValue(new Error("network")))).state).toBe("unverified");
    expect(saved.instagram_access_token).toBe("fixture-only-old"); expect(db.writes).toHaveLength(0);
  });
  it("refresh isolates owner and Instagram account, including equal account names", async () => {
    const a = fixture(); a.instagram_connection = lifecycleFromOAuth("instagram", 60 * 86400, now - 55 * 86400_000);
    const b = { ...fixture(), id: "profile-b", user_id: "user-b" }; const c = { ...fixture(), id: "profile-c", instagram_business_account_id: "67890" }; const before = JSON.stringify([b,c]); const db = database([a,b,c]);
    await maintainInstagramConnection(db, { ...a }, now, vi.fn().mockResolvedValue(response({ access_token: "fixture-only-new", expires_in: 60 * 86400 })));
    expect(JSON.stringify([b,c])).toBe(before); expect(db.writes[0].filters.user_id).toBe("user-a"); expect(db.writes[0].filters.id).toBe("profile-a");
  });
  it("an old request cannot overwrite a newer OAuth connection", async () => {
    const saved = fixture(); const stale = { ...saved, instagram_access_token: "fixture-stale", instagram_connection: lifecycleFromOAuth("instagram", 60 * 86400, now - 55 * 86400_000) }; const db = database([saved]);
    expect((await maintainInstagramConnection(db, stale, now, vi.fn().mockResolvedValue(response({ access_token: "fixture-new", expires_in: 60 * 86400 })))).state).toBe("unverified"); expect(saved.instagram_access_token).toBe("fixture-only-old");
  });
  it("legacy credentials require actual validation rather than assumed connected", () => {
    expect(connectionState(true, null, now)).toBe("unverified"); expect(connectionState(false, null, now)).toBe("missing");
    expect(() => assertInstagramResponse({ ok: false, status: 400 }, { error: { code: 190 } })).toThrow(InstagramAuthorizationError);
  });
});