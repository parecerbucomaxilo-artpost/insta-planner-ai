import { describe, expect, it } from "vitest";
import {
  batchDuplicates,
  contentKey,
  findDuplicate,
  planDistinctTopics,
  retryDistinct,
  similarity,
  titleOf,
} from "./dedup";

describe("deduplicação de posts", () => {
  it("detecta duplicata exata mesmo com acento, caixa e pontuação diferentes", () => {
    expect(similarity("Dor na ATM: sinais de alerta!", "dor na atm sinais de alerta")).toBe(1);
  });

  it("detecta duplicata semântica (paráfrase) e não marca temas diferentes", () => {
    expect(
      findDuplicate("Sinais de alerta da dor na ATM", ["Dor na ATM: sinais de alerta"]),
    ).not.toBeNull();
    expect(
      findDuplicate("Extração de siso incluso", ["Fratura de mandíbula em acidentes"]),
    ).toBeNull();
  });

  it("encontra itens repetidos dentro do mesmo lote", () => {
    expect(
      batchDuplicates(["Siso incluso", "Bruxismo noturno", "siso  incluso!", "Fratura de órbita"]),
    ).toEqual([2]);
  });

  it("planeja 7 temas distintos, sem histórico e com ângulos diferentes", () => {
    const base = [
      "Siso incluso",
      "Bruxismo",
      "Fratura de mandíbula",
      "Disfunção da ATM",
      "Cisto maxilar",
      "Implante zigomático",
      "Odontologia hospitalar na UTI",
      "Biópsia oral",
    ];
    const plano = planDistinctTopics(base, ["Siso incluso"], 7);
    expect(plano).toHaveLength(7);
    expect(plano.some((t) => t.startsWith("Siso incluso"))).toBe(false);
    expect(batchDuplicates(plano)).toEqual([]);
    expect(new Set(plano.map((t) => t.split(" — ")[1])).size).toBe(7);
  });

  it("tenta no máximo N vezes e devolve null se não conseguir variedade", async () => {
    let chamadas = 0;
    const r = await retryDistinct(
      async () => {
        chamadas++;
        return "Siso incluso";
      },
      (v) => v,
      ["Siso incluso"],
      3,
    );
    expect(r).toBeNull();
    expect(chamadas).toBe(3);
    const ok = await retryDistinct(
      async (i) => (i === 0 ? "Siso incluso" : "Bruxismo"),
      (v) => v,
      ["Siso incluso"],
      3,
    );
    expect(ok).toEqual({ valor: "Bruxismo", tentativas: 2 });
  });

  it("gera a mesma chave para o mesmo conteúdo normalizado (idempotência)", () => {
    expect(contentKey(["Siso Incluso", "Carrossel"])).toBe(
      contentKey(["siso incluso!", "carrossel"]),
    );
    expect(contentKey(["Siso", "Carrossel"])).not.toBe(contentKey(["Siso", "Story"]));
  });

  it("extrai o título ignorando marcador de slide", () => {
    expect(titleOf("Slide 1: Seu siso dói?\nTexto")).toBe("Seu siso dói?");
  });
});
