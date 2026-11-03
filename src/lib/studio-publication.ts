import { PERFIS, type PerfilId } from "./studio-profiles";
import { flagsDeRede, type Rede } from "./networks";

export type StudioContent = { perfil: PerfilId; tema: string; texto: string; imagens: string[]; formato: "Post Único" | "Carrossel" | "Story" | "Reels" | "Artigo LinkedIn"; rede: Rede; midiaPendente?: boolean };
export type StudioDestination = { canal: Rede; conta: string; conectado: boolean };
export type StudioAction = "rascunho" | "agendar" | "publicar";

export function validarPublicacao(c: StudioContent, d: StudioDestination, acao: StudioAction, quando?: string, agora = Date.now()) {
  if (!c.tema.trim()) throw new Error("Confirme o tema antes de salvar ou enviar.");
  if (!c.texto.trim() && !c.imagens.length) throw new Error("Selecione texto e/ou imagem do Estúdio.");
  if (/\[[^\]]+\]/.test(c.texto) && acao !== "rascunho") throw new Error("Complete os trechos entre colchetes antes de enviar.");
  if (acao === "rascunho") return;
  if (c.midiaPendente) throw new Error("A imagem/slide selecionado ainda não está pronto. Aguarde ou selecione mídia completa.");
  if (!d.conectado) throw new Error("Conta não conectada/autorizada. Abra Configurações → Redes Sociais e conecte o destino.");
  if (d.canal === "google") throw new Error("Google Business usa uma automação com assinatura/CTA fixos do Chico e sem seleção de conta ou confirmação final. Envio pelo Estúdio indisponível para preservar seu perfil.");
  if (d.canal === "instagram" && !d.conta) throw new Error("Escolha uma conta Instagram autorizada.");
  if (c.texto.length > (d.canal === "instagram" ? 2200 : 3000)) throw new Error("Texto acima do limite do canal: Instagram 2200; LinkedIn 3000 caracteres.");
  if (c.formato === "Reels" || c.formato === "Artigo LinkedIn") throw new Error("A integração existente não envia vídeos/Reels nem artigos LinkedIn. Escolha uma publicação compatível.");
  if (d.canal !== "instagram" && (c.formato === "Story" || c.formato === "Carrossel" || c.imagens.length > 1)) throw new Error("A integração LinkedIn aceita texto e uma imagem, não Story/carrossel. Selecione uma imagem ou texto.");
  if (d.canal === "linkedin" && !c.texto.trim()) throw new Error("LinkedIn exige texto nesta integração.");
  if (d.canal === "instagram" && !c.imagens.length) throw new Error("Instagram exige imagem; texto sozinho não pode ser enviado.");
  if (c.formato === "Carrossel" && c.imagens.length !== 5) throw new Error("Selecione os cinco slides completos do carrossel.");
  if (c.formato !== "Carrossel" && c.imagens.length > 1) throw new Error("Este formato aceita apenas uma imagem.");
  if (new Set(c.imagens).size !== c.imagens.length) throw new Error("Há imagens repetidas na seleção.");
  if (acao === "agendar" && (!quando || !Number.isFinite(Date.parse(quando)) || Date.parse(quando) <= agora)) throw new Error("Escolha uma data e hora no futuro.");
}

export function linhaStudio(c: StudioContent, d: StudioDestination, urls: string[]) {
  return {
    tipo_post: c.formato === "Carrossel" ? "Carrossel" : "Post Único",
    formato_midia: c.formato === "Story" ? "Story" : "Feed",
    legenda: c.texto,
    legenda_instagram: d.canal === "instagram" ? c.texto : null,
    legenda_linkedin: d.canal === "linkedin" ? c.texto : null,
    url_imagem: urls[0] ?? null,
    imagens_carrossel: c.formato === "Carrossel" ? urls : [],
    instagram_conta: d.canal === "instagram" ? d.conta : null,
    prompt_ia: `Estúdio · ${PERFIS[c.perfil].nome}\n${c.tema}`,
    ...flagsDeRede([d.canal]),
    status: "Rascunho",
    data_agendamento: null,
  };
}

export type PublishResult = { ok?: boolean; status?: string; warning?: string; instagram?: { ok?: boolean; externalId?: string; status?: string }; linkedin?: { ok?: boolean; ugcId?: string; shareUrl?: string } };
export type StudioServices = {
  autenticar: () => Promise<string>;
  verificar: (d: StudioDestination) => Promise<StudioDestination>;
  upload: (src: string, index: number, userId: string) => Promise<string>;
  salvar: (uid: string, row: ReturnType<typeof linhaStudio>) => Promise<{ id: string; existente: boolean }>;
  agendar: (id: string, uid: string, quando: string) => Promise<void>;
  publicar: (id: string) => Promise<PublishResult>;
};

/** Only called by the explicit confirmation. No generation or autonomous dispatch. */
export async function executarPublicacaoStudio(s: StudioServices, c: StudioContent, destino: StudioDestination, acao: StudioAction, quando?: string, salvoId?: string) {
  validarPublicacao(c, destino, acao, quando);
  const uid = await s.autenticar();
  const d = acao === "rascunho" ? destino : await s.verificar(destino);
  validarPublicacao(c, d, acao, quando);
  let id = salvoId;
  if (!id) {
    const urls: string[] = [];
    for (const [i, src] of c.imagens.entries()) urls.push(await s.upload(src, i, uid));
    const saved = await s.salvar(uid, linhaStudio(c, d, urls));
    if (saved.existente) throw new Error("Este texto já está salvo. Abra o post existente em Todas as publicações; nenhuma cópia ou envio foi feito.");
    id = saved.id;
  }
  if (acao === "agendar") {
    try { await s.agendar(id, uid, quando ?? ""); }
    catch (e) { throw Object.assign(new Error(e instanceof Error ? e.message : "Falha ao agendar."), { salvoId: id }); }
    return { id, estado: "agendado" as const };
  }
  if (acao === "publicar") {
    try {
      const r = await s.publicar(id);
      const canal = d.canal === "instagram" ? r.instagram : r.linkedin;
      if (r.ok !== true || r.status !== "Publicado" || canal?.ok !== true) throw new Error(r.warning || "A integração não confirmou a publicação. Conteúdo preservado.");
      return { id, estado: "publicado" as const, retorno: r };
    } catch (e) {
      throw Object.assign(new Error(e instanceof Error ? e.message : "Falha no envio."), { salvoId: id });
    }
  }
  return { id, estado: "rascunho" as const };
}