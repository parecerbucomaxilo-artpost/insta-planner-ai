import { describe, it, expect, vi } from "vitest";
import { montarSemanaCronograma } from "./week-plan";
import { planDistinctTopics, espalharTemas, ANGULOS_EDITORIAIS } from "./dedup";
import {
  executarSemana,
  carregarRun,
  salvarRun,
  pendentes,
  progresso,
  classificar,
  type Estados,
  type ResultadoPost,
} from "./week-run";
import type { ItemSemana } from "./week-plan";

const TEMAS = [
  "Por que o siso incluso pode causar dor que irradia para o ouvido",
  "Como o bruxismo noturno pode sobrecarregar dentes e articulações",
  "Quando o estalo na ATM merece atenção especializada",
  "Por que infecções odontogênicas não devem ser ignoradas",
  "Quando uma ferida na boca precisa ser investigada",
  "Como a Odontologia Hospitalar protege pacientes internados",
  "Fratura de mandíbula: sinais que ninguém pode ignorar",
  "Enxerto ósseo antes do implante: o que muda no planejamento",
  "Cistos odontogênicos: quando um achado radiográfico vira cirurgia",
  "Sinusite maxilar de origem odontogênica: quando o dente é o culpado",
  "Neuralgia do trigêmeo: quando a dor facial não é dentária",
  "Angina de Ludwig: emergência de vias aéreas",
];
const agora = new Date(2026, 9, 25, 12, 0, 0);

function semana(): ItemSemana[] {
  const temas = planDistinctTopics(TEMAS, [], 60, ANGULOS_EDITORIAIS);
  const base = montarSemanaCronograma(temas, agora);
  const ordem = espalharTemas(temas, base.map((i) => i.quando));
  return base.map((i, k) => ({ ...i, tema: ordem[k] }));
}

/** "Backend" em memória: persiste por slotKey (idempotente) como o servidor real. */
function backendFalso(falhas: Record<string, string[]> = {}) {
  const salvos = new Map<string, ResultadoPost & { tema: string; rede?: string; quando: string }>();
  const chamadas: string[] = [];
  const gerar = vi.fn(async (item: ItemSemana, slotKey: string) => {
    chamadas.push(slotKey);
    const fila = falhas[item.key];
    const erro = fila?.shift();
    if (erro === "IMAGEM")
      return { id: `p-${slotKey}`, urls: [], legenda: `Texto ${item.tema}`, imagemErro: "provedor recusou" };
    if (erro) throw new Error(erro);
    const existente = salvos.get(slotKey);
    if (existente) return existente;
    const urls = item.formato === "Carrossel" ? [1, 2, 3, 4, 5].map((n) => `img/${slotKey}/${n}`) : [`img/${slotKey}/1`];
    const r = { id: `p-${slotKey}`, urls, legenda: `Legenda sobre ${item.tema}`, tema: item.tema, rede: item.rede, quando: item.quando };
    salvos.set(slotKey, r);
    return r;
  });
  return { salvos, chamadas, gerar };
}

const semEspera = async () => {};

describe("Planejar semana → geração de todos os slots", () => {
  it("gera e persiste texto+imagem para os 56 slots das 3 redes", async () => {
    const itens = semana();
    const be = backendFalso();
    const estados: Estados = {};
    const r = await executarSemana({
      itens,
      gerar: be.gerar,
      novoTema: async () => undefined,
      onEstado: (k, e) => (estados[k] = e),
      esperar: semEspera,
    });
    expect(be.gerar).toHaveBeenCalledTimes(56);
    expect(r).toEqual({ ok: 56, imagem: 0, erro: 0 });
    expect(be.salvos.size).toBe(56);
    const porRede = (rd: string) => [...be.salvos.values()].filter((p) => p.rede === rd).length;
    expect([porRede("instagram"), porRede("google"), porRede("linkedin")]).toEqual([28, 14, 14]);
    // cada conteúdo diferente; carrossel IG = 5 imagens; demais = 1
    expect(new Set([...be.salvos.values()].map((p) => p.legenda)).size).toBe(56);
    for (const i of itens) expect(estados[i.key].res!.urls).toHaveLength(i.formato === "Carrossel" ? 5 : 1);
    expect(progresso(itens, estados)).toMatchObject({ total: 56, ok: 56, pendentes: 0 });
  });

  it("falha de imagem mantém o texto, marca o slot e não conta como completo", async () => {
    const itens = semana();
    const alvo = itens[4];
    const be = backendFalso({ [alvo.key]: ["IMAGEM"] });
    const estados: Estados = {};
    const r = await executarSemana({ itens, gerar: be.gerar, novoTema: async () => undefined, onEstado: (k, e) => (estados[k] = e), esperar: semEspera });
    expect(r.ok).toBe(55);
    expect(r.imagem).toBe(1);
    expect(estados[alvo.key].status).toBe("imagem");
    expect(estados[alvo.key].res!.legenda).toContain(alvo.tema);
    expect(estados[alvo.key].erro).toMatch(/imagem falhou/);
    expect(classificar({ id: "x", urls: [], legenda: "t" }).status).toBe("imagem");
  });

  it("deduplicação troca o tema do slot e não aborta o lote", async () => {
    const itens = semana();
    const alvo = itens[10];
    const be = backendFalso({ [alvo.key]: ["Tema repetido: já usado. Nada foi salvo."] });
    const estados: Estados = {};
    const r = await executarSemana({
      itens,
      gerar: be.gerar,
      novoTema: async () => "Odontoma: o tumor mais comum dos maxilares",
      onEstado: (k, e) => (estados[k] = e),
      esperar: semEspera,
    });
    expect(r).toEqual({ ok: 56, imagem: 0, erro: 0 });
    expect(be.chamadas).toContain(`${alvo.key}#1`);
  });

  it("dedup persistente esgota as tentativas e marca só aquele slot com erro explícito", async () => {
    const itens = semana();
    const alvo = itens[3];
    const dup = "Mesmo assunto de um post próximo. Nada foi salvo.";
    const be = backendFalso({ [alvo.key]: [dup, dup, dup, dup] });
    const estados: Estados = {};
    let n = 0;
    const r = await executarSemana({ itens, gerar: be.gerar, novoTema: async () => `Tema extra ${n++}`, onEstado: (k, e) => (estados[k] = e), esperar: semEspera });
    expect(r).toEqual({ ok: 55, imagem: 0, erro: 1 });
    expect(estados[alvo.key]).toMatchObject({ status: "erro", erro: dup });
  });

  it("erro transitório (429) tenta de novo com a MESMA chave (idempotente)", async () => {
    const itens = semana().slice(0, 3);
    const be = backendFalso({ [itens[0].key]: ["429 rate limit"] });
    const r = await executarSemana({ itens, gerar: be.gerar, novoTema: async () => undefined, onEstado: () => {}, esperar: semEspera });
    expect(r.ok).toBe(3);
    expect(be.chamadas.filter((c) => c === itens[0].key)).toHaveLength(2);
  });

  it("crédito/permissão (402) pausa o lote com erro real, sem simular sucesso", async () => {
    const itens = semana().slice(0, 6);
    const be = backendFalso({ [itens[0].key]: ["402 créditos insuficientes"] });
    const estados: Estados = {};
    const r = await executarSemana({ itens, gerar: be.gerar, concorrencia: 1, novoTema: async () => undefined, onEstado: (k, e) => (estados[k] = e), esperar: semEspera });
    expect(r.interrompido).toMatch(/402/);
    expect(r.ok).toBe(0);
    expect(Object.values(estados).every((e) => e.status === "erro")).toBe(true);
  });

  it("slot sem tema recebe tema da IA automaticamente", async () => {
    const itens = semana().slice(0, 2).map((i) => ({ ...i, tema: "" }));
    const be = backendFalso();
    let n = 0;
    const r = await executarSemana({ itens, gerar: be.gerar, novoTema: async () => `Tema automático ${n++}`, onEstado: () => {}, esperar: semEspera });
    expect(r.ok).toBe(2);
    expect([...be.salvos.values()].map((p) => p.tema)).toEqual(["Tema automático 0", "Tema automático 1"]);
  });
});

describe("Retomada sem duplicar", () => {
  it("recarregar a página: slots 'gerando' voltam para a fila e prontos não rodam de novo", async () => {
    const itens = semana();
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const estados: Estados = {};
    itens.slice(0, 10).forEach((i) => (estados[i.key] = { status: "ok", res: { id: i.key, urls: ["u"], legenda: "l" } }));
    estados[itens[10].key] = { status: "gerando" };
    salvarRun(storage, "k", { plano: itens, estados, operacaoId: "op-1" });

    const run = carregarRun(storage, "k")!;
    expect(run.operacaoId).toBe("op-1");
    expect(run.estados[itens[10].key].status).toBe("fila");
    const fila = pendentes(run.plano, run.estados);
    expect(fila).toHaveLength(46);
    expect(fila.some((i) => run.estados[i.key]?.status === "ok")).toBe(false);

    const be = backendFalso();
    await executarSemana({ itens: fila, gerar: be.gerar, novoTema: async () => undefined, onEstado: () => {}, esperar: semEspera });
    expect(be.gerar).toHaveBeenCalledTimes(46);
  });

  it("repetir o mesmo slot devolve o mesmo post (sem segundo registro)", async () => {
    const [item] = semana();
    const be = backendFalso();
    const a = await be.gerar(item, item.key);
    const b = await be.gerar(item, item.key);
    expect(a.id).toBe(b.id);
    expect(be.salvos.size).toBe(1);
  });
});
