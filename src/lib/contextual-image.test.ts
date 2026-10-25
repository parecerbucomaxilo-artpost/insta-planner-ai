import { describe, expect, it, vi } from "vitest";
import { buildVisualBrief, extractFinalSlides, generateBoundImage, validateImageBindings, type VisualBrief } from "./contextual-image";

const brief: VisualBrief = {
  postId: "post-a", slideIndex: 0, total: 2, tema: "Disco articular da ATM",
  titulo: "Por que a ATM estala?", texto: "O disco articular se desloca durante a abertura da boca.",
  objetivo: "Educar", publico: "Público leigo", contexto: "CTBMF", identidade: "Azul petróleo e ciano",
};

describe("Geração contextual Chico", () => {
  it("cada texto final chega integralmente ao gerador, antes de salvar e na ordem correta", async () => {
    const generate = vi.fn(async (prompt: string) => prompt.includes("fisioterapia") ? "image-2" : "image-1");
    const save = vi.fn(async (image: string, postId: string, slideIndex: number) => ({ postId, slideIndex, publicUrl: `https://media.test/${image}`, signedUrl: `https://media.test/${image}?signed=1` }));
    const second = { ...brief, slideIndex: 1, texto: "A fisioterapia orientada melhora a mobilidade mandibular.", titulo: "Cuidado orientado" };
    const result = await Promise.all([brief, second].map((b) => generateBoundImage(b, generate, save)));
    expect(generate.mock.calls[0][0]).toBe(buildVisualBrief(brief));
    expect(generate.mock.calls[1][0]).toBe(buildVisualBrief(second));
    expect(generate.mock.calls[0][0]).toContain(brief.texto);
    expect(generate.mock.calls[1][0]).toContain(second.texto);
    expect(generate.mock.calls[0][0]).not.toContain(second.texto);
    expect(validateImageBindings("post-a", 2, result.reverse()).map((r) => r.publicUrl)).toEqual(["https://media.test/image-1", "https://media.test/image-2"]);
  });
  it("falha contextual não salva gradiente nem chama outro gerador", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("Recusa do provedor"));
    const save = vi.fn();
    await expect(generateBoundImage(brief, generate, save)).rejects.toThrow("Recusa do provedor");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });
  it("bloqueia imagem vazia antes do upload", async () => {
    const save = vi.fn();
    await expect(generateBoundImage(brief, async () => "", save)).rejects.toThrow("não retornou imagem");
    expect(save).not.toHaveBeenCalled();
  });
  it("rejeita URL reutilizada, outro post e outro slide antes do salvamento", () => {
    const image = { postId: "post-a", slideIndex: 0, publicUrl: "https://media.test/a", signedUrl: "https://media.test/a?s=1" };
    expect(() => validateImageBindings("post-a", 2, [image, { ...image, slideIndex: 1 }])).toThrow("URL repetida");
    expect(() => validateImageBindings("post-a", 1, [{ ...image, postId: "post-b" }])).toThrow("incorreto");
    expect(() => validateImageBindings("post-a", 1, [{ ...image, slideIndex: 2 }])).toThrow("incorreto");
  });
  it("não trunca texto nem completa slides ausentes com roteiro genérico", () => {
    const longText = "Abertura mandibular orientada. ".repeat(30);
    expect(extractFinalSlides(`Slide 1: ${longText}\n\nSlide 2: Fisioterapia orientada individualmente.`, 2)[0]).toBe(longText.trim());
    expect(() => extractFinalSlides("Slide 1: Um único texto completo.", 5)).toThrow("5 slides");
  });
});