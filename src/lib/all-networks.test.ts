/* eslint-disable @typescript-eslint/no-explicit-any -- dublê de teste */
import { describe, it, expect } from "vitest";
import { previewPlatforms } from "./post-preview";
import { buildScheduleSlots } from "./schedule-config";
import { distribuirTemas } from "./week-themes";
import { quantidadeSlides } from "./carousel-slides";
import { verificarInedito, assinaturasDoHistorico } from "./post-guard";

describe("todas as redes inclui Google Business", () => {
  it("prévia mostra Google Business", () => {
    expect(
      previewPlatforms({
        postar_instagram: false,
        postar_linkedin: false,
        postar_google: true,
      } as any),
    ).toEqual(["google"]);
  });
  it("cronograma tem Google 10h e 15h com post único (sem carrossel de 5)", () => {
    const g = distribuirTemas(buildScheduleSlots(new Date("2026-10-27T03:30:00Z"), 1), [
      "a b c siso",
      "bruxismo",
      "fratura mandibula",
      "atm",
      "implante",
      "cisto",
      "anestesia",
      "trauma dental",
    ]).filter((s) => s.rede === "google");
    expect(g.map((s) => new Date(s.quando).toISOString())).toEqual([
      "2026-10-27T13:00:00.000Z",
      "2026-10-27T18:00:00.000Z",
    ]);
    expect(
      g.every(
        (s) =>
          s.formato === "Post Único" &&
          quantidadeSlides({ rede: "google", formato: s.formato }) === 1,
      ),
    ).toBe(true);
  });
  it("dedup compara entre plataformas: post do Instagram bloqueia o mesmo assunto no Google", () => {
    const hist = assinaturasDoHistorico([
      {
        prompt_ia: "Siso incluso: quando extrair",
        legenda: "Siso",
        data_agendamento: "2026-10-27T17:00:00Z",
        status: "PendenteAprovacao",
      },
    ]);
    expect(
      verificarInedito(
        {
          tema: "Terceiro molar e dor na gengiva",
          legenda: "Google post",
          quando: "2026-10-27T18:00:00Z",
        },
        hist,
      ),
    ).not.toBeNull();
  });
});
