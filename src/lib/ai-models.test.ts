import { describe, it, expect } from "vitest";
import {
  normalizeTextModel,
  normalizeImageModel,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  MODELOS_IA,
  MODELOS_IMAGEM,
  modeloLiberado,
} from "./ai-models";

describe("catálogo de modelos", () => {
  it("padrão de texto e imagem é a opção grátis", () => {
    expect(DEFAULT_TEXT_MODEL).toBe("auto/gratis");
    expect(DEFAULT_IMAGE_MODEL).toBe("auto/gratis");
  });
  it("modelo escolhido válido é respeitado", () => {
    expect(normalizeTextModel("groq/openai/gpt-oss-120b")).toBe("groq/openai/gpt-oss-120b");
    expect(normalizeImageModel("pollinations/zimage")).toBe("pollinations/zimage");
    expect(normalizeTextModel("local/sem-custo")).toBe("local/sem-custo");
  });
  it("modelos Pollinations que não existem mais são trocados", () => {
    expect(normalizeImageModel("pollinations/flux-realism")).toBe("pollinations/flux");
    expect(normalizeImageModel("pollinations/turbo")).toBe("pollinations/zimage");
  });
  it("modelos pagos antigos não são mais aceitos e viram o padrão grátis", () => {
    expect(normalizeTextModel("openai/gpt-5.5")).toBe("auto/gratis");
    expect(normalizeImageModel("google/gemini-3.1-flash-image")).toBe("auto/gratis");
  });
  it("únicos pagos são opt-in de OpenAI/Gemini e o padrão nunca é pago", () => {
    for (const m of [...MODELOS_IA, ...MODELOS_IMAGEM]) {
      if (m.nivel === "pago-opt-in") expect(["openai", "gemini"]).toContain(m.id.split("/")[0]);
    }
    expect(MODELOS_IA.find((m) => m.id === DEFAULT_TEXT_MODEL)?.nivel).not.toBe("pago-opt-in");
    expect(MODELOS_IMAGEM.find((m) => m.id === DEFAULT_IMAGE_MODEL)?.nivel).not.toBe("pago-opt-in");
  });
  it("OpenAI fica desativada sem chave ou sem aceite de cobrança", () => {
    const m = MODELOS_IA.find((x) => x.id === "openai/gpt-5-mini")!;
    const base = { gemini: true, groq: true, pollinations: true, openai: false, openaiPagoLiberado: false, geminiPagoLiberado: false };
    expect(modeloLiberado(m, base)).toBe(false);
    expect(modeloLiberado(m, { ...base, openai: true })).toBe(false);
    expect(modeloLiberado(m, { ...base, openaiPagoLiberado: true })).toBe(false);
    expect(modeloLiberado(m, { ...base, openai: true, openaiPagoLiberado: true })).toBe(true);
  });
  it("imagem Gemini paga exige aceite; texto Gemini gratuito não", () => {
    const img = MODELOS_IMAGEM.find((x) => x.id === "gemini/gemini-3.1-flash-image")!;
    const txt = MODELOS_IA.find((x) => x.id === "gemini/gemini-3.8-flash")!;
    const s = { gemini: true, groq: false, pollinations: false, openai: false, openaiPagoLiberado: false, geminiPagoLiberado: false };
    expect(modeloLiberado(img, s)).toBe(false);
    expect(modeloLiberado(img, { ...s, geminiPagoLiberado: true })).toBe(true);
    expect(modeloLiberado(txt, s)).toBe(true);
  });
  it("id desconhecido vira o padrão grátis", () => {
    expect(normalizeTextModel("xyz/inexistente")).toBe("auto/gratis");
  });
});
