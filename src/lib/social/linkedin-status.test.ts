import { describe, expect, it, vi } from "vitest";
import { canSendToLinkedIn, checkLinkedInConnection } from "./linkedin-status";

describe("LinkedIn opcional", () => {
  it("sem conexão não faz chamadas externas e não permite envio", async () => {
    const request = vi.fn();
    const status = await checkLinkedInConnection(undefined, undefined, request);
    expect(status.connected).toBe(false);
    expect(canSendToLinkedIn(status)).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("conexão expirada retorna indisponível sem lançar erro de inicialização", async () => {
    const request = vi.fn().mockResolvedValue(new Response("expired", { status: 401 }));
    expect(canSendToLinkedIn(await checkLinkedInConnection("test", "test", request))).toBe(false);
    expect(request.mock.calls[0]?.[0]).toBe("https://connector-gateway.lovable.dev/linkedin/v2/userinfo");
    expect(request.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it("serviço fora do ar mantém status indisponível sem lançar", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await checkLinkedInConnection("test", "test", request)).connected).toBe(false);
  });
  it("apenas identidade válida permite envio", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ sub: "member" }));
    expect(canSendToLinkedIn(await checkLinkedInConnection("test", "test", request))).toBe(true);
  });
  it("resposta incompleta não habilita envio", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({}));
    expect(canSendToLinkedIn(await checkLinkedInConnection("test", "test", request))).toBe(false);
    expect(canSendToLinkedIn(null)).toBe(false);
  });
});