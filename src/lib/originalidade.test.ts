import { describe, it, expect } from "vitest";
import { acharConflito, reformularTema, type AssinaturaPost } from "./dedup";

const quando = "2026-10-27T12:00:00.000Z";
const hist: AssinaturaPost[] = [
  {
    tema: "Por que o siso incluso pode causar dor que irradia para o ouvido — mito ou verdade",
    quando,
  },
  {
    tema: "Fratura de mandíbula: sinais que ninguém pode ignorar",
    titulo: "Fratura de mandíbula",
    corpo:
      "Dor ao morder, mordida torta e inchaço após trauma exigem avaliação imediata no pronto-socorro.",
    quando,
  },
];
const conflito = (h: AssinaturaPost[]) => (t: string) =>
  acharConflito({ tema: t, quando }, h, { janelaDias: 6 });

describe("Originalidade automática", () => {
  it("duplicata exata é detectada", () => {
    expect(conflito(hist)(hist[0].tema)).not.toBeNull();
  });

  it("semelhança semântica (título reescrito, mesmo assunto) é detectada", () => {
    expect(
      conflito(hist)("Siso incluso: dor que vai para o ouvido — mito ou verdade"),
    ).not.toBeNull();
  });

  it("mesmo nicho com assunto diferente é aceito (sem falso positivo)", () => {
    expect(conflito(hist)("Como a Odontologia Hospitalar protege pacientes internados")).toBeNull();
  });

  it("tema em conflito vira novo ângulo/assunto automaticamente e é revalidado", () => {
    const r = reformularTema(
      hist[0].tema,
      conflito(hist),
      () => "Angina de Ludwig: emergência de vias aéreas",
    );
    expect(r).not.toBeNull();
    expect(r!.via).not.toBe("original");
    expect(conflito(hist)(r!.tema)).toBeNull();
    expect(r!.rejeitados[0].tema).toBe(hist[0].tema);
  });

  it("sem conflito mantém o tema original", () => {
    const t = "Neuralgia do trigêmeo: quando a dor facial não é dentária";
    expect(reformularTema(t, conflito(hist), () => null)).toMatchObject({
      tema: t,
      via: "original",
      tentativas: 0,
    });
  });

  it("regeneração é limitada e não salva quando tudo colide", () => {
    let chamadas = 0;
    const r = reformularTema(
      "X",
      () => ({ motivo: "tema", com: "y" }) as any,
      () => `alt ${chamadas++}`,
      { maxTentativas: 5 },
    );
    expect(r).toBeNull();
    expect(chamadas).toBeLessThanOrEqual(5);
  });

  it("vale entre plataformas/lote: item já aceito no lote bloqueia cópia em outra rede", () => {
    const lote: AssinaturaPost[] = [
      {
        tema: "Cistos odontogênicos: quando um achado radiográfico vira cirurgia — mito ou verdade",
        quando,
      },
    ];
    expect(conflito(lote)(lote[0].tema)).not.toBeNull();
    // Mesmo assunto no mesmo dia não passa nem com outro ângulo: troca de assunto.
    const r = reformularTema(lote[0].tema, conflito(lote), () => "Neuralgia do trigêmeo: dor facial não dentária");
    expect(r?.via).toBe("novo-assunto");
    expect(conflito(lote)(r!.tema)).toBeNull();
  });
});
