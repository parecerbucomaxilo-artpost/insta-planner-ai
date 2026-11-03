import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { comGuardaIA, definirModo, registrarConfirmador, resetarConfirmacao, ModoGratuitoError, JANELA_CONFIRMACAO_MS } from "./generation-mode";
import { completeCaptionIfNeeded, slidesNaoChico } from "./ai-post.functions";
import { generateTextAI } from "./ai-gateway.server";
import { executarSemana } from "./week-run";
import { montarSemanaCronograma } from "./week-plan";

beforeEach(() => { resetarConfirmacao(); definirModo("ia", undefined); registrarConfirmador(async () => true); });

describe("modo de geração (fluxo principal)", () => {
  it("modo IA chama a função real após confirmação", async () => {
    const gerar = vi.fn().mockResolvedValue({ legenda: "IA" });
    expect(await comGuardaIA("Gerar publicação", gerar)({ data: 1 })).toEqual({ legenda: "IA" });
    expect(gerar).toHaveBeenCalledWith({ data: 1 });
  });
  it("modo Gratuito bloqueia e não chama a IA nem devolve modelo fixo", async () => {
    definirModo("gratuito", undefined);
    const gerar = vi.fn();
    await expect(comGuardaIA("Gerar publicação", gerar)()).rejects.toBeInstanceOf(ModoGratuitoError);
    expect(gerar).not.toHaveBeenCalled();
  });
  it("cancelar a confirmação não chama a IA", async () => {
    registrarConfirmador(async () => false);
    const gerar = vi.fn();
    await expect(comGuardaIA("Gerar legenda", gerar)()).rejects.toThrow(/cancelada/);
    expect(gerar).not.toHaveBeenCalled();
  });
  it("falha do gateway chega ao usuário, sem fallback", async () => {
    const gerar = vi.fn().mockRejectedValue(new Error("Lovable AI 402: sem créditos"));
    await expect(comGuardaIA("Gerar publicação", gerar)()).rejects.toThrow("402");
  });
  it("uma confirmação cobre o lote e expira depois da janela", async () => {
    const confirmar = vi.fn().mockResolvedValue(true);
    registrarConfirmador(confirmar);
    let t = 0;
    const f = comGuardaIA("Gerar publicação", async () => 1, () => t);
    for (let i = 0; i < 56; i++) await f();
    expect(confirmar).toHaveBeenCalledTimes(1);
    t = JANELA_CONFIRMACAO_MS + 1;
    await f();
    expect(confirmar).toHaveBeenCalledTimes(2);
  });
});

describe("pipeline server-side não usa modelos fixos", () => {
  const base = { tema: "Fratura de mandíbula", rede: "instagram" as const, formato: "Post Único" as const, audiencia: "chico-drfm" as const, especialidade: "CTBMF" };
  it("legenda vazia da IA vira erro visível, não legenda de modelo", () => {
    expect(() => completeCaptionIfNeeded({ ...base, legenda: "" })).toThrow(/nenhum texto de modelo fixo/);
  });
  it("não acrescenta parágrafos editoriais fixos ao texto da IA", () => {
    const out = completeCaptionIfNeeded({ ...base, legenda: "Texto curto da IA." });
    expect(out).not.toMatch(/Por que acontece:|Como conduzir:|Ganho real:|Quando ligar o alerta:/);
    expect(out.startsWith("Texto curto da IA.")).toBe(true);
  });
  it("carrossel sem slides da IA vira erro, não roteiro fixo", () => {
    expect(() => slidesNaoChico("sem slides", "Fratura de mandíbula", "estudantes-graduacao", 5)).toThrow(/nenhum roteiro de modelo fixo/);
  });
});

describe("gateway real", () => {
  const env = process.env.LOVABLE_API_KEY;
  beforeEach(() => { process.env.LOVABLE_API_KEY = "teste"; });
  afterEach(() => { process.env.LOVABLE_API_KEY = env; vi.unstubAllGlobals(); });
  it("generateTextAI chama o Lovable AI Gateway", async () => {
    const req = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", req);
    await generateTextAI({ prompt: "x" });
    expect(String(req.mock.calls[0][0])).toContain("ai.gateway.lovable.dev");
  });
  it("erro do gateway é lançado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("limite", { status: 429 })));
    await expect(generateTextAI({ prompt: "x" })).rejects.toThrow();
  });
});

describe("geração semanal passa pela guarda de IA", () => {
  it("modo Gratuito: nenhum slot chama a IA e todos ficam com erro visível", async () => {
    definirModo("gratuito", undefined);
    const real = vi.fn();
    const gerar = comGuardaIA("Gerar publicação", real);
    const itens = montarSemanaCronograma(["Fratura de mandíbula", "Siso incluso"], new Date(2026, 9, 25, 12)).slice(0, 4);
    const estados: string[] = [];
    await executarSemana({ itens, gerar: (i, k) => gerar(i, k) as never, novoTema: async () => undefined, onEstado: (_k, e) => estados.push(e.status), tentativasTransitorio: 0, tentativasConteudo: 0, esperar: async () => {} });
    expect(real).not.toHaveBeenCalled();
    expect(estados.filter((s) => s === "erro").length).toBeGreaterThan(0);
  });
  it("modo IA: cada slot chama a função real", async () => {
    const real = vi.fn().mockResolvedValue({ id: "x", urls: ["u"], legenda: "IA" });
    const gerar = comGuardaIA("Gerar publicação", real);
    const itens = montarSemanaCronograma(["Fratura de mandíbula", "Siso incluso"], new Date(2026, 9, 25, 12)).slice(0, 4);
    await executarSemana({ itens, gerar: (i, k) => gerar(i, k) as never, novoTema: async () => undefined, onEstado: () => {}, esperar: async () => {} });
    expect(real).toHaveBeenCalledTimes(itens.filter((i) => i.tema.trim()).length);
  });
});
