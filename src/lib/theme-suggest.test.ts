import { describe, it, expect, vi } from "vitest";
import { sugerirTemasComIA, sugerirTemasLocais, lerSugestoes, SugerirTemasInput } from "./theme-suggest";
import { PERFIS, PERFIS_IDS, legendaDoPerfil } from "./studio-profiles";
import { comGuardaIA, definirModo, registrarConfirmador, resetarConfirmacao, ModoGratuitoError } from "./generation-mode";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("perfis do Estúdio", () => {
  it("tem os quatro perfis com nomes exatos", () => {
    expect(PERFIS_IDS.map((id) => PERFIS[id].nome)).toEqual(["Planner Chico", "Cirurgia e Biópsias", "Clínica Escola", "Planner Liga"]);
  });
  it("isola logo, paleta, assinatura e telefone", () => {
    expect(PERFIS.liga.logo).toBe("liga-ctbmf");
    expect(PERFIS.liga.paleta.destaque).toBe("#c92e28");
    expect(PERFIS.liga.audiencia).toBe("estudantes-graduacao");
    expect(PERFIS.chico.logo).toBe("planner");
    expect(new Set(PERFIS_IDS.map((id) => PERFIS[id].paleta.destaque)).size).toBe(4);
    expect(new Set(PERFIS_IDS.map((id) => PERFIS[id].assinatura)).size).toBe(4);
    expect(PERFIS.liga.telefone).toBe("");
  });
  it("legenda da Liga não leva WhatsApp/CROSP do Chico", () => {
    const l = legendaDoPerfil("Texto\nFale comigo pelo WhatsApp: https://wa.me/5511947684004", "liga");
    expect(l).not.toMatch(/wa\.me/);
    expect(l).toContain("Liga Acadêmica de CTBMF");
  });
});

describe("IA escolhe o tema", () => {
  const input = SugerirTemasInput.parse({ perfil: "liga", objetivo: "Educar", rede: "instagram" });
  it("chama o gerador real, envia histórico e descarta repetidos", async () => {
    const gerar = vi.fn(async (_a: { prompt: string }) => JSON.stringify({ sugestoes: [
      { tema: "Fratura de mandíbula em acidentes de moto", motivo: "repetido" },
      { tema: "Terceiros molares inclusos na prova", motivo: "novo", formato: "Carrossel", abordagem: "caiu na prova" },
    ] }));
    const s = await sugerirTemasComIA(input, ["Fratura de mandíbula em acidentes de moto"], gerar);
    expect(gerar).toHaveBeenCalledTimes(1);
    expect(gerar.mock.calls[0]?.[0].prompt).toContain("Fratura de mandíbula");
    expect(s.map((x) => x.tema)).toEqual(["Terceiros molares inclusos na prova"]);
    expect(s[0].origem).toBe("ia");
  });
  it("erro do gateway sobe sem sugestões fixas", async () => {
    await expect(sugerirTemasComIA(input, [], async () => { throw new Error("gateway caiu"); })).rejects.toThrow("gateway caiu");
    expect(() => lerSugestoes("sem json", [])).toThrow();
  });
  it("modo Gratuito bloqueia antes de chamar o gateway", async () => {
    const st = mem(); vi.stubGlobal("localStorage", st); definirModo("gratuito", st);
    const gateway = vi.fn(async () => []);
    await expect(comGuardaIA("Sugerir temas com IA", gateway)()).rejects.toBeInstanceOf(ModoGratuitoError);
    expect(gateway).not.toHaveBeenCalled();
    definirModo("ia", st); resetarConfirmacao(); registrarConfirmador(async () => true);
    await comGuardaIA("Sugerir temas com IA", gateway)();
    expect(gateway).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it("sugestões locais são por regras e não repetem", () => {
    const a = sugerirTemasLocais("clinica-escola", "instagram", []);
    expect(a.every((x) => x.origem === "regras")).toBe(true);
    const b = sugerirTemasLocais("clinica-escola", "instagram", a.map((x) => x.tema));
    expect(b.some((x) => a.map((y) => y.tema).includes(x.tema))).toBe(false);
  });
});
