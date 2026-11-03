import { describe, it, expect, vi } from "vitest";
import { executarPublicacaoStudio, linhaStudio, validarPublicacao, type StudioContent, type StudioDestination, type StudioServices } from "./studio-publication";

const content: StudioContent = { perfil: "liga", tema: "Diagnóstico de lesões", texto: "Texto revisado com conteúdo clínico selecionado.", imagens: ["data:image/jpeg;base64,fixture"], formato: "Post Único", rede: "instagram" };
const destino: StudioDestination = { canal: "instagram", conta: "conta-escolhida", conectado: true };
function services(): StudioServices {
  return { autenticar: vi.fn(async () => "user"), verificar: vi.fn(async d => d), upload: vi.fn(async (_, i) => `https://media.example/${i}.jpg`), salvar: vi.fn(async () => ({ id: "post", existente: false })), agendar: vi.fn(async () => {}), publicar: vi.fn(async () => ({ ok: true, status: "Publicado", instagram: { ok: true, externalId: "meta-id" } })) };
}
describe("Publicação explícita no Estúdio", () => {
  it("confirmação chama o publicador existente com id e payload exato", async () => {
    const s = services();
    const out = await executarPublicacaoStudio(s, content, destino, "publicar");
    expect(s.publicar).toHaveBeenCalledExactlyOnceWith("post");
    expect(s.upload).toHaveBeenCalledWith(content.imagens[0], 0, "user");
    expect(s.salvar).toHaveBeenCalledWith("user", expect.objectContaining({ legenda: content.texto, legenda_instagram: content.texto, url_imagem: "https://media.example/0.jpg", instagram_conta: "conta-escolhida", status: "Rascunho", postar_instagram: true, postar_linkedin: false, prompt_ia: "Estúdio · Planner Liga\nDiagnóstico de lesões" }));
    expect(out.estado).toBe("publicado");
    expect(out.retorno?.instagram?.externalId).toBe("meta-id");
  });
  it("sessão inválida não salva nem publica", async () => {
    const s = services(); s.autenticar = vi.fn(async () => { throw new Error("Unauthorized"); });
    await expect(executarPublicacaoStudio(s, content, destino, "publicar")).rejects.toThrow("Unauthorized");
    expect(s.salvar).not.toHaveBeenCalled(); expect(s.publicar).not.toHaveBeenCalled();
  });
  it("conexão inválida não envia", async () => {
    const s = services(); s.verificar = vi.fn(async d => ({ ...d, conectado: false }));
    await expect(executarPublicacaoStudio(s, content, destino, "publicar")).rejects.toThrow("não conectada");
    expect(s.upload).not.toHaveBeenCalled(); expect(s.publicar).not.toHaveBeenCalled();
  });
  it.each([{ ok: false, status: "Erro" }, { ok: true, status: "Publicado" }, { ok: true, status: "Erro", instagram: { ok: true } }])("resposta incompleta/erro não gera falso sucesso %j", async response => {
    const s = services(); s.publicar = vi.fn(async () => response);
    await expect(executarPublicacaoStudio(s, content, destino, "publicar")).rejects.toThrow("não confirmou");
  });
  it("erro de API preserva id para repetir sem upload/save duplicado", async () => {
    const s = services(); s.publicar = vi.fn(async () => { throw new Error("API 403"); });
    await expect(executarPublicacaoStudio(s, content, destino, "publicar")).rejects.toMatchObject({ message: "API 403", salvoId: "post" });
    s.publicar = vi.fn(async () => ({ ok: true, status: "Publicado", instagram: { ok: true } }));
    await executarPublicacaoStudio(s, content, destino, "publicar", undefined, "post");
    expect(s.salvar).toHaveBeenCalledTimes(1); expect(s.upload).toHaveBeenCalledTimes(1);
  });
  it("rascunho não verifica conexão nem publica nem agenda", async () => {
    const s = services();
    expect((await executarPublicacaoStudio(s, content, { ...destino, conectado: false }, "rascunho")).estado).toBe("rascunho");
    expect(s.verificar).not.toHaveBeenCalled(); expect(s.agendar).not.toHaveBeenCalled(); expect(s.publicar).not.toHaveBeenCalled();
  });
  it("agendar escreve data futura e não publica agora", async () => {
    const s = services(); const date = "2099-11-03T14:00:00.000Z";
    expect((await executarPublicacaoStudio(s, content, destino, "agendar", date)).estado).toBe("agendado");
    expect(s.agendar).toHaveBeenCalledExactlyOnceWith("post", "user", date); expect(s.publicar).not.toHaveBeenCalled();
  });
  it("bloqueia agendamento passado", () => { expect(() => validarPublicacao(content, destino, "agendar", "2020-01-01", Date.parse("2026-11-03"))).toThrow("futuro"); });
  it("carrossel envia cinco slides na ordem selecionada", async () => {
    const s = services(); const c = { ...content, formato: "Carrossel" as const, imagens: ["a", "b", "c", "d", "e"] };
    await executarPublicacaoStudio(s, c, destino, "publicar");
    expect(s.salvar).toHaveBeenCalledWith("user", expect.objectContaining({ imagens_carrossel: [0, 1, 2, 3, 4].map(i => `https://media.example/${i}.jpg`) }));
  });
  it("bloqueia carrossel incompleto", () => { expect(() => validarPublicacao({ ...content, formato: "Carrossel" }, destino, "publicar")).toThrow("cinco slides"); });
  it("bloqueia imagem selecionada mas não pronta", () => { expect(() => validarPublicacao({ ...content, midiaPendente: true }, destino, "publicar")).toThrow("não está pronto"); });
  it("Instagram bloqueia texto sem imagem", () => { expect(() => validarPublicacao({ ...content, imagens: [] }, destino, "publicar")).toThrow("exige imagem"); });
  it("LinkedIn permite texto puro com confirmação real", async () => {
    const s = services(); s.publicar = vi.fn(async () => ({ ok: true, status: "Publicado", linkedin: { ok: true, ugcId: "ugc", shareUrl: "https://linkedin.example/post" } }));
    expect((await executarPublicacaoStudio(s, { ...content, imagens: [] }, { canal: "linkedin", conta: "membro", conectado: true }, "publicar")).estado).toBe("publicado");
    expect(s.upload).not.toHaveBeenCalled();
  });
  it("LinkedIn bloqueia carrossel sem descartar slides", () => { expect(() => validarPublicacao({ ...content, formato: "Carrossel", imagens: ["a", "b", "c", "d", "e"] }, { ...destino, canal: "linkedin" }, "publicar")).toThrow("não Story/carrossel"); });
  it("Google bloqueado preserva perfis", () => { expect(() => validarPublicacao(content, { ...destino, canal: "google" }, "publicar")).toThrow("assinatura/CTA fixos"); });
  it.each(["chico", "cirurgia-biopsias", "clinica-escola", "liga"] as const)("perfil %s não altera conta/mídia", perfil => {
    expect(linhaStudio({ ...content, perfil }, destino, ["url"]).instagram_conta).toBe("conta-escolhida");
    expect(linhaStudio({ ...content, perfil }, destino, ["url"]).url_imagem).toBe("url");
  });
});