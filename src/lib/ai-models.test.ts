import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, MODELOS_IA, MODELOS_IMAGEM, TextModelInput, ImageModelInput, modelRoute, validateModel } from "./ai-models";

describe("catalog-verified model policy", () => {
  it("uses current economical defaults", () => {
    expect(TextModelInput.parse(undefined)).toBe("openai/gpt-6-luna");
    expect(ImageModelInput.parse(undefined)).toBe("google/gemini-3.1-flash-lite-image");
    expect(DEFAULT_TEXT_MODEL).toBe("openai/gpt-6-luna");
    expect(DEFAULT_IMAGE_MODEL).toBe("google/gemini-3.1-flash-lite-image");
  });
  it("accepts every offered ID with the appropriate modality", () => {
    for (const m of MODELOS_IA) expect(TextModelInput.parse(m.id)).toBe(m.id);
    for (const m of MODELOS_IMAGEM) expect(ImageModelInput.parse(m.id)).toBe(m.id);
  });
  it("preserves explicit catalog-listed legacy preferences", () => {
    expect(TextModelInput.parse("openai/gpt-5-mini")).toBe("openai/gpt-5-mini");
    expect(ImageModelInput.parse("google/gemini-3.1-flash-image")).toBe("google/gemini-3.1-flash-image");
  });
  it.each(["invented/model", "google/gemini-2.5-pro", "local/sem-custo", "anthropic/claude-sonnet-5"])("rejects unavailable or disconnected text %s without replacement", id => {
    expect(() => TextModelInput.parse(id)).toThrow();
  });
  it("does not accept an image ID as a text model", () => {
    expect(() => validateModel("openai/gpt-image-2.5-flare", "text")).toThrow();
  });
  it("routes each provider to the documented protocol", () => {
    expect(modelRoute("openai/gpt-6-luna", "text")).toEqual({provider: "openai", endpoint: "/chat/completions", format: "chat"});
    expect(modelRoute("google/gemini-3.8-flash", "text").provider).toBe("google");
    expect(modelRoute("google/gemini-3.1-flash-lite-image", "image").format).toBe("generate-content");
    expect(modelRoute("google/gemini-3-pro-image", "image").format).toBe("gemini-chat");
    expect(modelRoute("openai/gpt-image-2.5-flare", "image").format).toBe("openai");
  });
});