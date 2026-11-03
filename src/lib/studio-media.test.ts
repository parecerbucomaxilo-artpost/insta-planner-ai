import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { definirMidiaEstudio, restaurarMidia, limparMidiaEstudio, conteudoComMidia, persistirArteCanvas, midiaPadrao } from "./studio-media";
import { bloqueioAntesDeAbrir, origemMidia, executarPublicacaoStudio, validarPublicacao, type StudioContent, type StudioServices } from "./studio-publication";

const BASE = "https://proj.supabase.co";
const URL1 = `${BASE}/storage/v1/object/public/post-images/u1/arte.jpg`;
const base = { perfil: "chico" as const, tema: "Siso", texto: "Legenda", rede: "instagram" as const };
const dest = { canal: "instagram" as const, conta: "drfranciscomenezes", conectado: true };
function mem(): Storage { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage; }
function svc(over: Partial<StudioServices> = {}): StudioServices {
  return { autenticar: vi.fn(async () => "u1"), verificar: vi.fn(async d => d), upload: vi.fn(async (s: string) => s), salvar: vi.fn(async () => ({ id: "p1", existente: false })), agendar: vi.fn(async () => {}), publicar: vi.fn(async () => ({ ok: true, status: "Publicado", instagram: { ok: true, externalId: "ig-1" } })), verificarMidia: vi.fn(async () => true), ...over };
}

describe("Arte do canvas → texto → diálogo → URL persistida", () => {
  it("exporta o canvas final, envia uma vez e guarda só URL persistida", async () => {
    const upload = vi.fn(async (f: File) => { expect(f.type).toBe("image/jpeg"); return URL1; });
    const url = await persistirArteCanvas(async () => new Blob(["px"], { type: "image/jpeg" }), upload);
    expect(url).toBe(URL1); expect(upload).toHaveBeenCalledTimes(1);
    await expect(persistirArteCanvas(async () => null, upload)).rejects.toThrow("exportar");
    expect(() => definirMidiaEstudio({ userId: "u1", ...base, imagens: ["data:image/jpeg;base64,AA"], formato: "Post Único" }, mem())).toThrow("salva");
  });
  it("arte restaurada após troca de aba/recarga chega ao diálogo com 1 imagem e é reaproveitada sem novo upload", async () => {
    const st = mem();
    definirMidiaEstudio({ userId: "u1", ...base, imagens: [URL1], formato: "Post Único" }, st);
    const c = conteudoComMidia(base, restaurarMidia("u1", "chico", st));
    expect(c.imagens).toEqual([URL1]);
    expect(bloqueioAntesDeAbrir(c, "publicar")).toBeNull();
    expect(origemMidia(URL1, BASE)).toBe("persistida");
    const s = svc({ upload: vi.fn(async (src: string) => (origemMidia(src, BASE) === "persistida" ? src : "x")) });
    await executarPublicacaoStudio(s, c, dest, "publicar");
    expect((s.salvar as any).mock.calls[0][1]).toMatchObject({ url_imagem: URL1, instagram_conta: "drfranciscomenezes", postar_instagram: true });
    expect(s.publicar).toHaveBeenCalledWith("p1");
  });
  it("não cruza usuários nem perfis", () => {
    const st = mem();
    definirMidiaEstudio({ userId: "u1", ...base, imagens: [URL1], formato: "Post Único" }, st);
    expect(restaurarMidia("u2", "chico", st)).toBeNull();
    limparMidiaEstudio("u1", "chico", st);
    definirMidiaEstudio({ userId: "u1", ...base, perfil: "liga", imagens: [URL1], formato: "Post Único" }, st);
    expect(restaurarMidia("u1", "chico", st)).toBeNull();
  });
});

describe("Bloqueios e envio", () => {
  it("sem imagem: Instagram bloqueia publicar/agendar com orientação; rascunho permitido", () => {
    const c = conteudoComMidia(base, null);
    expect(bloqueioAntesDeAbrir(c, "publicar")).toMatch(/Selecione ou gere uma arte/);
    expect(bloqueioAntesDeAbrir(c, "rascunho")).toBeNull();
  });
  it("imagem inacessível bloqueia antes de salvar/enviar", async () => {
    const s = svc({ verificarMidia: vi.fn(async () => false) });
    await expect(executarPublicacaoStudio(s, { ...base, imagens: [URL1], formato: "Post Único" }, dest, "publicar")).rejects.toThrow("não está acessível");
    expect(s.salvar).not.toHaveBeenCalled(); expect(s.publicar).not.toHaveBeenCalled();
  });
  it("IA Avançada usa a imagem pronta em vez de enviar zero", () => {
    expect(midiaPadrao({}, 5)).toBe("nenhuma");
    expect(midiaPadrao({ unico: "x" }, 5)).toBe("unico");
    expect(midiaPadrao({ capa: "a", "slide-2": "b", "slide-3": "c", "slide-4": "d", "slide-5": "e" }, 5)).toBe("carrossel");
  });
  it("carrossel preserva as cinco imagens na ordem", async () => {
    const imgs = [1, 2, 3, 4, 5].map(i => `${URL1}?${i}`);
    const s = svc();
    await executarPublicacaoStudio(s, { ...base, imagens: imgs, formato: "Carrossel" }, dest, "publicar");
    expect((s.salvar as any).mock.calls[0][1].imagens_carrossel).toEqual(imgs);
  });
  it("retry após falha da API não repete upload nem save", async () => {
    const publicar = vi.fn().mockRejectedValueOnce(new Error("API")).mockResolvedValueOnce({ ok: true, status: "Publicado", instagram: { ok: true } });
    const s = svc({ publicar });
    const c: StudioContent = { ...base, imagens: ["data:image/jpeg;base64,AA"], formato: "Post Único" };
    const id = await executarPublicacaoStudio(s, c, dest, "publicar").catch(e => e.salvoId);
    await executarPublicacaoStudio(s, c, dest, "publicar", undefined, id);
    expect(s.upload).toHaveBeenCalledTimes(1); expect(s.salvar).toHaveBeenCalledTimes(1); expect(publicar).toHaveBeenCalledTimes(2);
  });
});

describe("Agendamento", () => {
  it("grava data em UTC a partir da hora local e não publica agora", async () => {
    const local = "2099-11-03T14:00"; const iso = new Date(local).toISOString();
    const s = svc();
    expect((await executarPublicacaoStudio(s, { ...base, imagens: [URL1], formato: "Post Único" }, dest, "agendar", iso)).estado).toBe("agendado");
    expect(s.agendar).toHaveBeenCalledWith("p1", "u1", iso); expect(s.publicar).not.toHaveBeenCalled();
  });
  it("LinkedIn não pode ser agendado (sem rotina automática ativa)", () => {
    expect(() => validarPublicacao({ ...base, rede: "linkedin", imagens: [] }, { canal: "linkedin", conta: "", conectado: true }, "agendar", "2099-01-01T00:00:00Z", 0)).toThrow("só para Instagram");
  });
  it("rotina agendada publica posts vencidos de qualquer conta Instagram, não só a Liga", () => {
    const src = readFileSync("src/routes/api/public/posts-agendados.ts", "utf8");
    const post = src.slice(src.indexOf("POST: async"));
    expect(post).toContain('.eq("status", "Agendado")');
    expect(post).toContain('.lte("data_agendamento", nowIso)');
    expect(post).toContain("publishInstagramPostById");
    expect(post).not.toContain('.eq("instagram_conta", LIGA_ACCOUNT)');
  });
});
