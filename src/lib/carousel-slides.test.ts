import { describe, it, expect } from "vitest";
import { quantidadeSlides, carrosselForaDoPadrao, SLIDES_PADRAO_IG_FEED } from "./carousel-slides";
import { podeAprovar, problemasPrevia } from "./post-review";

describe("carrossel do Feed do Instagram", () => {
  it("padrão é exatamente 5 slides", () => {
    expect(SLIDES_PADRAO_IG_FEED).toBe(5);
    expect(quantidadeSlides({ rede: "instagram", formato: "Carrossel", tipo: "feed" })).toBe(5);
    expect(quantidadeSlides({ rede: "instagram", formato: "Carrossel" })).toBe(5);
  });
  it("quantidade pedida explicitamente é respeitada", () => {
    expect(quantidadeSlides({ rede: "instagram", formato: "Carrossel", pedido: 7 })).toBe(7);
  });
  it("não se aplica a story, post único nem Estilo X", () => {
    expect(quantidadeSlides({ rede: "instagram", formato: "Story", tipo: "stories" })).toBe(1);
    expect(quantidadeSlides({ rede: "instagram", formato: "Post Único" })).toBe(1);
    expect(quantidadeSlides({ rede: "estilo-x", formato: "Carrossel" })).toBe(3);
    expect(carrosselForaDoPadrao({ tipo_post: "Carrossel", postar_instagram: false, slides: 3 })).toBe(false);
  });
  const slides = (n: number, repetir = false) => Array.from({ length: n }, (_, i) => `Slide ${i + 1}: ${repetir ? "o mesmo texto repetido sobre bruxismo noturno" : `etapa ${["gancho sobre a dor", "problema da mordida", "mecanismo da articulação", "conduta e tratamento", "quando buscar ajuda", "extra a", "extra b"][i]}`}`).join("\n");
  const pd = (n: number, repetir = false, urls?: string[]) => ({
    post: { tipo_post: "Carrossel", postar_instagram: true, estilo_layout: "Padrão", legenda: slides(n, repetir) } as any,
    media: urls ?? Array.from({ length: n }, (_, i) => `u${i}`), mediaFalhas: [], mediaAusente: [],
  });
  it("prévia: 5 slides únicos não têm problema", () => expect(problemasPrevia(pd(5))).toEqual([]));
  it("prévia: 4 slides sinaliza fora do padrão (exige decisão explícita)", () => {
    const p = problemasPrevia(pd(4));
    expect(p).toContain("slides-fora-padrao");
    expect(podeAprovar({ visto: true, problemas: p, ignorado: true })).toBe(true);
  });
  it("aprovação: slides repetidos bloqueiam sempre", () => {
    const p = problemasPrevia(pd(5, true));
    expect(p).toContain("slides-repetidos");
    expect(podeAprovar({ visto: true, problemas: p, ignorado: true })).toBe(false);
    expect(problemasPrevia(pd(5, false, ["a", "b", "a", "c", "d"]))).toContain("slides-repetidos");
  });
});
