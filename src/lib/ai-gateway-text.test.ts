import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTextAI } from "./ai-gateway.server";

afterEach(() => vi.unstubAllGlobals());
describe("real text request routing without live generation", () => {
  it.each(["openai/gpt-6-luna", "openai/gpt-6.1-sol", "google/gemini-3.8-flash"])(
    "preserves %s in the HTTP request",
    async (model) => {
      const request = vi.fn(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "fixture" } }] })),
      );
      vi.stubGlobal("fetch", request);
      expect(
        await generateTextAI({ apiKey: "fixture-key", prompt: "fixture", model, maxTokens: 1200 }),
      ).toBe("fixture");
      const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe(model);
      expect(body.max_completion_tokens).toBeUndefined();
      if (model === "openai/gpt-6-luna") expect(body.reasoning_effort).toBe("none");
    },
  );
  it.each([400, 401, 402, 403, 404, 429, 503])(
    "HTTP %s never falls back or replays",
    async (status) => {
      const request = vi.fn(
        async () => new Response(JSON.stringify({ message: "fixture error" }), { status }),
      );
      vi.stubGlobal("fetch", request);
      await expect(generateTextAI({ apiKey: "fixture-key", prompt: "fixture" })).rejects.toThrow(
        `texto ${status}`,
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("empty responses fail, never return local text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [] }))),
    );
    await expect(generateTextAI({ apiKey: "fixture-key", prompt: "fixture" })).rejects.toThrow(
      "resposta vazia",
    );
  });
  it("disconnected Claude never calls a wrong protocol", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(
      generateTextAI({
        apiKey: "fixture-key",
        prompt: "fixture",
        model: "anthropic/claude-sonnet-5",
      }),
    ).rejects.toThrow("não conectado");
    expect(request).not.toHaveBeenCalled();
  });
});
