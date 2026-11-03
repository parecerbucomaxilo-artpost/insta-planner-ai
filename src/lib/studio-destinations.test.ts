import { describe, it, expect, vi } from "vitest";
import { carregarDestinos, comPrazo, type DestinationReaders } from "./studio-destinations";
const readers = (): DestinationReaders => ({ usuario: vi.fn(async () => "user"), perfis: vi.fn(async () => ["@connected", "missing", "connected"]), instagram: vi.fn(async c => c === "connected"), linkedin: vi.fn(async () => ({ connected: true, message: "ok" })) });
describe("Destinos do Estúdio, somente leitura", () => {
  it("lista somente contas verificadas e sem duplicatas, além do membro LinkedIn", async () => {
    const r = readers(); const out = await carregarDestinos(r);
    expect(out.contas.map(c => c.id)).toEqual(["instagram:connected", "linkedin:membro"]);
    expect(r.perfis).toHaveBeenCalledWith("user"); expect(r.instagram).toHaveBeenCalledTimes(2);
  });
  it("nenhuma conexão retorna lista vazia, sem inventar conta", async () => {
    const r = readers(); r.instagram = vi.fn(async () => false); r.linkedin = vi.fn(async () => ({ connected: false, message: "Conecte LinkedIn" }));
    expect((await carregarDestinos(r)).contas).toEqual([]);
  });
  it("erro de carregar perfis é recuperável e não ignora auth", async () => {
    const r = readers(); r.perfis = vi.fn(async () => { throw new Error("falha"); });
    await expect(carregarDestinos(r)).rejects.toThrow("falha"); expect(r.instagram).not.toHaveBeenCalled();
  });
  it("falha de sessão não consulta contas", async () => {
    const r = readers(); r.usuario = vi.fn(async () => { throw new Error("sessão"); });
    await expect(carregarDestinos(r)).rejects.toThrow("sessão"); expect(r.perfis).not.toHaveBeenCalled();
  });
  it("falha parcial não se torna conta autorizada", async () => {
    const r = readers(); r.instagram = vi.fn(async () => { throw new Error("API"); });
    const out = await carregarDestinos(r); expect(out.contas.map(c => c.canal)).toEqual(["linkedin"]); expect(out.avisos.length).toBe(2);
  });
  it("carregamento travado termina com erro em vez de loading infinito", async () => {
    await expect(comPrazo(() => new Promise(() => {}), 5)).rejects.toThrow("demorou demais");
  });
});