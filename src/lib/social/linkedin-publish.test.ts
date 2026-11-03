import { afterEach, describe, expect, it, vi } from "vitest";
import { publishLinkedInPostById } from "./linkedin-publish.server";

function db(image: string | null = null) {
  const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
  return { update, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "post", legenda_linkedin: "Texto realmente selecionado", postar_linkedin: true, url_imagem: image, imagens_carrossel: [] }, error: null }) }) }), update }) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Publicador real LinkedIn com HTTP mockado", () => {
  it("envia texto correto e retorna identificador da API, nunca o mock legado", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "fixture"); vi.stubEnv("LINKEDIN_API_KEY", "fixture");
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("userinfo")) return new Response(JSON.stringify({ sub: "member" }));
      expect(url).toBe("https://connector-gateway.lovable.dev/linkedin/v2/ugcPosts");
      const body = JSON.parse(String(init?.body));
      expect(body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text).toBe("Texto realmente selecionado");
      return new Response(JSON.stringify({ id: "urn:li:ugcPost:123" }), { status: 201 });
    });
    vi.stubGlobal("fetch", request);
    const client = db();
    const r = await publishLinkedInPostById({ supabaseAdmin: client, postId: "post" });
    expect(r.ugcId).toBe("urn:li:ugcPost:123"); expect(r.ok).toBe(true); expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ status: "Publicado" }));
  });
  it("falha de mídia impede POST e falso sucesso de texto puro", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "fixture"); vi.stubEnv("LINKEDIN_API_KEY", "fixture");
    const request = vi.fn(async (url: string) => url.endsWith("userinfo") ? new Response(JSON.stringify({ sub: "member" })) : new Response("erro mídia", { status: 403 }));
    vi.stubGlobal("fetch", request); const client = db("https://media.example/image.jpg");
    await expect(publishLinkedInPostById({ supabaseAdmin: client, postId: "post" })).rejects.toThrow("baixar imagem 403");
    expect(client.update).not.toHaveBeenCalled(); expect(request.mock.calls.some(([u]) => u.endsWith("ugcPosts"))).toBe(false);
  });
  it("API rejeita envio sem marcar publicado", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "fixture"); vi.stubEnv("LINKEDIN_API_KEY", "fixture");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("userinfo") ? new Response(JSON.stringify({ sub: "member" })) : new Response("missing scope", { status: 403 })));
    const client = db(); await expect(publishLinkedInPostById({ supabaseAdmin: client, postId: "post" })).rejects.toThrow("ugcPosts 403"); expect(client.update).not.toHaveBeenCalled();
  });
});