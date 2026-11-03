import { describe, it, expect, vi } from "vitest";
import { definirMidiaEstudio, lerMidiaEstudio, conteudoComMidia } from "./studio-media";
import { bloqueioAntesDeAbrir, origemMidia, executarPublicacaoStudio, type StudioContent } from "./studio-publication";

const BASE = "https://proj.supabase.co";
const base = { perfil: "chico" as const, tema: "Siso", texto: "Legenda", rede: "instagram" as const };

describe("Mídia do Estúdio até a publicação", () => {
  it("arte selecionada chega ao conteúdo de publicação do texto", () => {
    definirMidiaEstudio({ ...base, imagens: ["data:image/jpeg;base64,AA"], formato: "Post Único" });
    const c = conteudoComMidia(base, lerMidiaEstudio());
    expect(c.imagens).toEqual(["data:image/jpeg;base64,AA"]);
    expect(bloqueioAntesDeAbrir(c, "publicar")).toBeNull();
  });
  it("sem imagem: Instagram bloqueia publicar/agendar com orientação, rascunho permitido", () => {
    const c = conteudoComMidia(base, null);
    expect(bloqueioAntesDeAbrir(c, "publicar")).toMatch(/Selecione ou gere uma arte/);
    expect(bloqueioAntesDeAbrir(c, "agendar")).toMatch(/exige imagem/);
    expect(bloqueioAntesDeAbrir(c, "rascunho")).toBeNull();
  });
  it("classifica data URL/blob como local, URL do storage como persistida, outras como inválidas", () => {
    expect(origemMidia("data:image/png;base64,AA", BASE)).toBe("local");
    expect(origemMidia("blob:http://x/1", BASE)).toBe("local");
    expect(origemMidia(`${BASE}/storage/v1/object/public/post-images/u/a.jpg`, BASE)).toBe("persistida");
    expect(origemMidia("https://outro.site/a.jpg", BASE)).toBe("invalida");
  });
  it("carrossel incompleto bloqueia; completo preserva as cinco imagens na ordem", async () => {
    const imgs = [1, 2, 3, 4, 5].map(i => `data:image/jpeg;base64,${i}`);
    expect(bloqueioAntesDeAbrir({ ...base, imagens: imgs.slice(0, 4), formato: "Carrossel" }, "publicar")).toMatch(/cinco/);
    const c: StudioContent = { ...base, imagens: imgs, formato: "Carrossel" };
    const salvar = vi.fn(async () => ({ id: "p1", existente: false }));
    await executarPublicacaoStudio({ autenticar: async () => "u", verificar: async d => d, upload: async s => s.replace("data:", "up:"), salvar, agendar: vi.fn(), publicar: vi.fn() }, c, { canal: "instagram", conta: "a", conectado: true }, "rascunho");
    expect((salvar.mock.calls[0] as unknown as [string, { imagens_carrossel: string[] }])[1].imagens_carrossel).toEqual(imgs.map(s => s.replace("data:", "up:")));
  });
  it("retry após falha da API reaproveita o post salvo: sem novo upload nem novo save", async () => {
    const upload = vi.fn(async (s: string) => s); const salvar = vi.fn(async () => ({ id: "p1", existente: false }));
    const publicar = vi.fn().mockRejectedValueOnce(new Error("API")).mockResolvedValueOnce({ ok: true, status: "Publicado", instagram: { ok: true, externalId: "9" } });
    const s = { autenticar: async () => "u", verificar: async (d: any) => d, upload, salvar, agendar: vi.fn(), publicar };
    const c: StudioContent = { ...base, imagens: ["data:image/jpeg;base64,AA"], formato: "Post Único" };
    const d = { canal: "instagram" as const, conta: "a", conectado: true };
    const salvoId = await executarPublicacaoStudio(s, c, d, "publicar").catch(e => e.salvoId);
    await executarPublicacaoStudio(s, c, d, "publicar", undefined, salvoId);
    expect(upload).toHaveBeenCalledTimes(1); expect(salvar).toHaveBeenCalledTimes(1); expect(publicar).toHaveBeenCalledTimes(2);
  });
});
