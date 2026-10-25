import { describe, it, expect } from "vitest";
import { quantidadeSlides } from "./carousel-slides";
import { extractFinalSlides, buildVisualBrief } from "./contextual-image";
import { slidesRepetidos } from "./post-guard";

const legenda = (n: number) =>
  Array.from({ length: n }, (_, i) => `Slide ${i + 1}: ${["Gancho: dor na mandíbula ao acordar", "Problema: o bruxismo desgasta os dentes", "Mecanismo: tensão nos músculos da mastigação", "Conduta: placa feita sob medida e avaliação", "Quando procurar o especialista e o que levar", "Extra seis", "Extra sete"][i]}`).join("\n");

describe("geração de carrossel do Feed do Instagram (pipeline real de slides)", () => {
  const n = quantidadeSlides({ rede: "instagram", formato: "Carrossel", tipo: "feed" });
  it("gera exatamente 5 slides, únicos e com brief de imagem próprio", () => {
    const slides = extractFinalSlides(legenda(7), n);
    expect(slides).toHaveLength(5);
    expect(slidesRepetidos(slides)).toEqual([]);
    const briefs = slides.map((texto, i) => buildVisualBrief({ tema: "Bruxismo", titulo: texto.split(":")[0], texto, slideIndex: i, total: n } as any));
    expect(new Set(briefs).size).toBe(5);
    briefs.forEach((b, i) => expect(b).toContain(slides[i]));
  });
  it("texto com menos de 5 slides bloqueia a geração das imagens", () => {
    expect(() => extractFinalSlides(legenda(4), n)).toThrow(/5 slides/);
  });
  it("slides com texto igual bloqueiam a geração", () => {
    expect(() => extractFinalSlides("Slide 1: igual igual igual\nSlide 2: igual igual igual\nSlide 3: a b c d e f g\nSlide 4: h i j k l m n\nSlide 5: o p q r s t u", n)).toThrow();
  });
  it("quantidade pedida explicitamente é usada na geração", () => {
    expect(extractFinalSlides(legenda(7), quantidadeSlides({ rede: "instagram", formato: "Carrossel", pedido: 7 }))).toHaveLength(7);
  });
});
