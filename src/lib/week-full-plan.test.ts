import { describe, it, expect } from "vitest";
import { montarSemanaCronograma, SLOTS_POR_SEMANA } from "./week-plan";
import { planDistinctTopics, conflitosNoLote, espalharTemas, ANGULOS_EDITORIAIS } from "./dedup";
const TEMAS_GERAIS = [
  "Por que o siso incluso pode causar dor que irradia para o ouvido",
  "Como o bruxismo noturno pode sobrecarregar dentes e articulações",
  "Quando o estalo na ATM merece atenção especializada",
  "Por que infecções odontogênicas não devem ser ignoradas",
  "Quando uma ferida na boca precisa ser investigada",
  "Como a Odontologia Hospitalar protege pacientes internados",
  "Fratura de mandíbula: sinais que ninguém pode ignorar",
  "Enxerto ósseo antes do implante: o que muda no planejamento",
];

const agora = new Date(2026, 9, 25, 12, 0, 0); // domingo

describe("Planejar semana — cronograma global completo", () => {
  const temas = planDistinctTopics([...TEMAS_GERAIS], [], SLOTS_POR_SEMANA, ANGULOS_EDITORIAIS);
  const bruto = montarSemanaCronograma(temas, agora);
  const ordem = espalharTemas(bruto.map((i) => i.tema), bruto.map((i) => i.quando));
  const plano = bruto.map((i, k) => ({ ...i, tema: ordem[k] }));

  it("gera 56 temas, não 2", () => {
    expect(temas).toHaveLength(56);
    expect(plano).toHaveLength(56);
    expect(plano.every((i) => i.tema.length > 0)).toBe(true);
  });

  it("quantidade por plataforma em 7 dias", () => {
    const por = (r: string) => plano.filter((i) => i.rede === r);
    expect(por("instagram")).toHaveLength(28);
    expect(por("google")).toHaveLength(14);
    expect(por("linkedin")).toHaveLength(14);
  });

  it("horários e formatos por rede", () => {
    const h = (r: string) => [...new Set(plano.filter((i) => i.rede === r).map((i) => `${i.horario} ${i.formato}`))].sort();
    expect(h("instagram")).toEqual(["09:00 Story", "14:00 Carrossel", "18:00 Story", "21:00 Carrossel"]);
    expect(h("google")).toEqual(["10:00 Post Único", "15:00 Post Único"]);
    expect(h("linkedin")).toEqual(["09:00 Post Único", "13:00 Post Único"]);
  });

  it("cada conteúdo é diferente e o lote não acusa conflito", () => {
    expect(new Set(plano.map((i) => i.tema)).size).toBe(56);
    expect(new Set(plano.map((i) => i.key)).size).toBe(56);
    expect(conflitosNoLote(plano.map((i) => ({ tema: i.tema, quando: i.quando })))).toEqual([]);
  });

  it("tema guiado também preenche a semana inteira (antes sobravam 2)", () => {
    const guia = ["visão geral", "sinais de alerta"].map((a) => `Siso: ${a}`);
    const hist = guia.map((g) => `${g} — mito e verdade`);
    let t = planDistinctTopics(guia, hist, 56, ANGULOS_EDITORIAIS);
    t = [...t, ...planDistinctTopics([...TEMAS_GERAIS], [...hist, ...t], 56 - t.length, ANGULOS_EDITORIAIS)];
    expect(t).toHaveLength(56);
    expect(new Set(t).size).toBe(56);
  });
});
