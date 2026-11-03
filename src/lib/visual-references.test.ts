import { describe, expect, it } from "vitest";
import { visualReferences } from "./visual-references";

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
});