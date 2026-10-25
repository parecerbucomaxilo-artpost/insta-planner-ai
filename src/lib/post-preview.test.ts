import { describe, expect, it } from "vitest";
import { canEditPreview, previewCaption, previewMedia, savedSlideText } from "./post-preview";
import type { PostRow } from "./posts-types";

describe("conteúdo real da prévia", () => {
  it("não substitui um slide ausente pela imagem de capa", () => {
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

import { formatPreviewDate, loadPostPreview, PreviewLoadError } from "./post-preview";

describe("carregamento real da prévia", () => {
  const carrossel = {
    id: "p1",
    tipo_post: "Carrossel",
    legenda: "Slide 1: ATM\nSlide 2: Dor\nSlide 3: Conduta",
    imagens_carrossel: [
      "https://x.supabase.co/storage/v1/object/public/post-images/p1/slide-1.jpg",
      "https://x.supabase.co/storage/v1/object/public/post-images/p1/slide-2.jpg",
    ],
    url_imagem: null,
    status: "PendenteAprovacao",
  } as unknown as PostRow;

  it("consulta o post pelo ID, assina cada slide na posição certa e sinaliza falha/ausência", async () => {
    const pedidos: string[] = [];
    const r = await loadPostPreview("p1", {
      fetchPost: async (id) => {
        pedidos.push(id);
        return { data: carrossel, error: null };
      },
      signOne: async (u) => (u.includes("slide-2") ? null : `${u}?token=ok`),
    });
    expect(pedidos).toEqual(["p1"]);
    expect(r.media).toEqual([`${carrossel.imagens_carrossel[0]}?token=ok`, null, null]);
    expect(r.mediaFalhas).toEqual([1]);
    expect(r.mediaAusente).toEqual([2]);
  });

  it("erro de permissão/sessão vira mensagem clara (não abre prévia vazia)", async () => {
    await expect(
      loadPostPreview("p1", {
        fetchPost: async () => ({
          data: null,
          error: { message: "JWT expired", code: "PGRST301" },
        }),
        signOne: async (u) => u,
      }),
    ).rejects.toThrow(/sessão expirou/);
  });

  it("post inexistente ou sem acesso gera erro explícito", async () => {
    await expect(
      loadPostPreview("p404", {
        fetchPost: async () => ({ data: null, error: null }),
        signOne: async (u) => u,
      }),
    ).rejects.toBeInstanceOf(PreviewLoadError);
  });

  it("mostra data/horário no fuso de Brasília, não no do navegador", () => {
    expect(formatPreviewDate("2026-11-01T12:00:00.000Z")).toBe(
      "01/11/2026 09:00 (horário de Brasília)",
    );
    expect(formatPreviewDate("2026-10-27T00:00:00.000Z")).toBe(
      "26/10/2026 21:00 (horário de Brasília)",
    );
    expect(formatPreviewDate(null)).toBe("Sem data/horário");
  });
});
