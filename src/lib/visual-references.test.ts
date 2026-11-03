import { afterEach, describe, expect, it, vi } from "vitest";
import { visualReferences } from "./visual-references";
import { generateImageBase64 } from "./ai-gateway.server";

afterEach(() => vi.unstubAllGlobals());

describe("real final text supplies image references without auxiliary inference", () => {
  it("single image keeps the actual caption even with brackets or quotes", () => {
    const caption = 'Lesão [persistente]: procure orientação. “Biópsia” esclarece o diagnóstico.';
    expect(visualReferences(caption, [])).toEqual({ scene: caption, perSlide: [] });
  });
  it("five carousel references preserve the five actual slides in order", () => {
    const slides = ["Lesão persistente", "Exame clínico", "Indicação da biópsia", "Análise do tecido", "Orientação individual"];
    expect(visualReferences("Legenda real do carrossel", slides).perSlide).toEqual(slides);
  });
  it("never replaces missing captions with local content", () => {
    expect(() => visualReferences(" ", [])).toThrow("Legenda vazia");
  });
  it("never substitutes missing slide text", () => {
    expect(() => visualReferences("Legenda real", ["Slide real", " "])).toThrow("Slide 2 vazio");
  });
  it("real image gateway consumes the final reference without a text-summary request", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "fixture-image" }] })));
    vi.stubGlobal("fetch", request);
    const { scene } = visualReferences("Exame clínico de lesão persistente", []);
    expect(await generateImageBase64({ apiKey: "fixture-key", model: "openai/gpt-image-2.5-sunburst", prompt: scene })).toBe("fixture-image");
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/images/generations");
    expect(JSON.parse(String(init.body)).prompt).toContain(scene);
  });
});