import { describe, expect, it } from "vitest";
import { assertPublicationAllowed } from "./publication-policy";

describe("publication approval and timing", () => {
  const now = Date.parse("2026-11-04T18:20:00Z");
  it("allows approved posts immediately", () => {
    expect(() => assertPublicationAllowed("Rascunho", null, now)).not.toThrow();
  });
  it("blocks pending and rejected posts", () => {
    for (const status of ["PendenteAprovacao", "Arquivado", "Erro"])
      expect(() => assertPublicationAllowed(status, null, now)).toThrow("aprove");
  });
  it("does not send scheduled posts before the chosen time", () => {
    expect(() => assertPublicationAllowed("Agendado", "2026-11-04T18:21:00Z", now)).toThrow("horário escolhido");
    expect(() => assertPublicationAllowed("Agendado", "2026-11-04T18:20:00Z", now)).not.toThrow();
  });
  it("blocks invalid scheduling and already sent posts", () => {
    expect(() => assertPublicationAllowed("Agendado", null, now)).toThrow("horário válido");
    expect(() => assertPublicationAllowed("Publicado", null, now)).toThrow("reenviados");
  });
});