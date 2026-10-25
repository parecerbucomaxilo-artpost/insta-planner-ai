import { describe, expect, it } from "vitest";
import { canEditPreview, previewCaption, previewMedia, savedSlideText } from "./post-preview";
import type { PostRow } from "./posts-types";

describe("conteúdo real da prévia", () => {
  it("ne masque pas une image de carrossel absente par la couverture", () => {
    const post = {
      tipo_post: "Carrossel",
      legenda: "Slide 1: ATM\nSlide 2: Dor",
      imagens_carrossel: ["slide-real"],
      url_imagem: "capa",
    } as PostRow;
    expect(previewMedia(post)).toEqual(["slide-real", null]);
  });
  it("associa o texto ao número do slide, sem substituto quando ausente", () => {
    const caption = "Slide 1: Dor na ATM\nSlide 3: Cuidados com a articulação";
    expect(savedSlideText(caption, 0)).toBe("Dor na ATM");
    expect(savedSlideText(caption, 1)).toBeNull();
    expect(savedSlideText(caption, 2)).toBe("Cuidados com a articulação");
  });
  it("preserva a legenda da plataforma e sua ausência explícita", () => {
    const post = {
      legenda: "Texto comum",
      legenda_instagram: "#ATM",
      legenda_linkedin: "",
    } as PostRow;
    expect(previewCaption(post, "instagram")).toBe("#ATM");
    expect(previewCaption(post, "linkedin")).toBe("");
    expect(previewCaption({ ...post, legenda_linkedin: null }, "linkedin")).toBe("Texto comum");
  });
  it("permite edição interna apenas em pendente ou rascunho", () => {
    expect(canEditPreview("PendenteAprovacao")).toBe(true);
    expect(canEditPreview("Rascunho")).toBe(true);
    expect(canEditPreview("Agendado")).toBe(false);
    expect(canEditPreview("Publicado")).toBe(false);
  });
});
