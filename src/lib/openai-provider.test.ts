import { describe, expect, it } from "vitest";
import { modelosDoProvedor, padraoDoProvedor, provedorDoModelo, modelRoute } from "./ai-models";
import { montarPacote, type Resultado } from "./advanced-ai";

const res = (o: Partial<Resultado> = {}): Resultado => ({
  titulo: "Dente do siso: quando operar?", ideiaCentral: "Explicar sinais de alerta",
  variantes: { media: "Legenda real" }, hashtags: ["#siso"], auditoria: [], precisaFonte: false, observacoes: "", ...o,
});

describe("OpenAI como provedor", () => {
  it("seletor de provedor lista só modelos OpenAI ou só Gemini", () => {
    expect(modelosDoProvedor("text", "openai").every((m) => m.id.startsWith("openai/"))).toBe(true);
    expect(modelosDoProvedor("image", "google").every((m) => m.id.startsWith("google/"))).toBe(true);
    expect(modelosDoProvedor("image", "openai").length).toBeGreaterThan(0);
  });
  it("padrão OpenAI é o modelo econômico do catálogo e roteia para OpenAI", () => {
    expect(padraoDoProvedor("text", "openai")).toBe("openai/gpt-6-luna");
    expect(padraoDoProvedor("image", "openai")).toBe("openai/gpt-image-2.5-flare");
    expect(modelRoute("openai/gpt-image-2.5-flare", "image").provider).toBe("openai");
  });
  it("Gemini continua disponível", () => {
    expect(provedorDoModelo(padraoDoProvedor("text", "google"))).toBe("google");
  });
  it("pacote usa texto real da IA, sem preencher por modelo fixo", () => {
    const p = montarPacote(res(), "media", "Link na Bio");
    expect(p).toEqual({ conceito: "Explicar sinais de alerta", textoArte: "Dente do siso: quando operar?", legenda: "Legenda real", cta: "Link na Bio", hashtags: ["#siso"] });
  });
  it("resposta vazia da IA vira erro visível", () => {
    expect(() => montarPacote(res({ titulo: "", variantes: {} }), "media", "")).toThrow();
  });
});
