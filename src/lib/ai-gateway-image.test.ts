import { afterEach, describe, expect, it, vi } from "vitest";
import { generateImageBase64 } from "./ai-gateway.server";

afterEach(() => vi.unstubAllGlobals());

describe("Parâmetro real enviado ao provedor", () => {
  it("Gemini Flash Lite Image usa o formato nativo confirmado, sem parâmetros OpenAI", async () => {
    const request = vi.fn(
      async () => new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2U=" }] })),
    );
    vi.stubGlobal("fetch", request);
    await generateImageBase64({
      apiKey: "test-key",
      prompt: "Cena do slide",
      model: "google/gemini-3.1-flash-lite-image",
    });
    const body = JSON.parse(
      (request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.model).toBe("google/gemini-3.1-flash-lite-image");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Cena do slide" }] }]);
    expect(body.generationConfig.responseModalities).toEqual(["TEXT", "IMAGE"]);
    expect(body.messages).toBeUndefined();
    expect(body.quality).toBeUndefined();
  });
  it.each(["google/gemini-3.1-flash-image", "openai/gpt-image-2"])(
    "preserva brief e modelo %s no corpo HTTP",
    async (model) => {
      const request = vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2U=" }] }), { status: 200 }),
      );
      vi.stubGlobal("fetch", request);
      const prompt =
        "SLIDE 2: mostrar disco da ATM anterior ao côndilo; não mostrar extração dentária.";
      expect(await generateImageBase64({ apiKey: "test-key", model, prompt })).toBe("aW1hZ2U=");
      const body = JSON.parse(
        (request.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
      );
      expect(body.model).toBe(model);
      if (model.startsWith("google/")) {
        expect(body.messages).toEqual([{ role: "user", content: prompt }]);
        expect(body.modalities).toEqual(["image", "text"]);
        expect(body.prompt).toBeUndefined();
      } else expect(body.prompt).toBe(prompt);
    },
  );
  it.each([400, 402, 403, 404, 429, 503])(
    "HTTP %s não troca modelo/provedor nem devolve fundo local",
    async (status) => {
      const request = vi.fn(
        async () => new Response(JSON.stringify({ message: "geração bloqueada" }), { status }),
      );
      vi.stubGlobal("fetch", request);
      await expect(
        generateImageBase64({
          apiKey: "test-key",
          model: "openai/gpt-image-2",
          prompt: "Disco da ATM deslocado",
        }),
      ).rejects.toThrow(`imagem ${status}`);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("resposta sem imagem é erro, não um gradiente", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    await expect(
      generateImageBase64({
        apiKey: "test-key",
        model: "google/gemini-3.1-flash-image",
        prompt: "ATM",
      }),
    ).rejects.toThrow("sem b64/url");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("modelo local não invoca provedor diferente silenciosamente", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(generateImageBase64({ model: "local/sem-custo", prompt: "ATM" })).rejects.toThrow(
      "local não gera imagens contextuais",
    );
    expect(request).not.toHaveBeenCalled();
  });
});
