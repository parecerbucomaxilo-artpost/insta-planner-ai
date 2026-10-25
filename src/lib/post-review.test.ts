import { describe, it, expect } from "vitest";
import { canReview, reviewStatus, GENERATED_POST_STATUS } from "./post-review";

describe("Revisão interna", () => {
  it("posts gerados começam pendentes e permitem aprovação, mesmo com data planejada", () => {
    expect(GENERATED_POST_STATUS).toBe("PendenteAprovacao");
    expect(canReview(GENERATED_POST_STATUS)).toBe(true);
  });
  it("aceitar salva como rascunho, nunca agenda ou publica", () => {
    expect(reviewStatus("aceitar")).toBe("Rascunho");
  });
  it("negar preserva o post arquivado", () => {
    expect(reviewStatus("negar")).toBe("Arquivado");
  });
  it("permite decidir somente posts pendentes", () => {
    expect(canReview("PendenteAprovacao")).toBe(true);
    for (const status of [
      "Rascunho",
      "Agendado",
      "Publicado",
      "EnviadoMake",
      "Erro",
      "Arquivado",
    ] as const) {
      expect(canReview(status)).toBe(false);
    }
  });
});
