import { describe, it, expect } from "vitest";
import { normalizeTextModel, normalizeImageModel, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL } from "./ai-models";

describe("catálogo de modelos", () => {
  it("padrão de texto e imagem é a opção grátis", () => {
    expect(DEFAULT_TEXT_MODEL).toBe("auto/gratis");
    expect(DEFAULT_IMAGE_MODEL).toBe("auto/gratis");
  });
  it("modelo escolhido válido é respeitado", () => {
    expect(normalizeTextModel("openai/gpt-5.5")).toBe("openai/gpt-5.5");
    expect(normalizeImageModel("openai/gpt-image-2")).toBe("openai/gpt-image-2");
    expect(normalizeTextModel("local/sem-custo")).toBe("local/sem-custo");
  });
  it("modelos Pollinations que não existem mais são trocados", () => {
    expect(normalizeImageModel("pollinations/flux-realism")).toBe("pollinations/flux");
    expect(normalizeImageModel("pollinations/turbo")).toBe("pollinations/zimage");
  });
  it("id desconhecido vira o padrão grátis", () => {
    expect(normalizeTextModel("xyz/inexistente")).toBe("auto/gratis");
  });
});
