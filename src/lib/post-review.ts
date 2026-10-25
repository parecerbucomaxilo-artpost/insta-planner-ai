import type { PreviewData } from "./post-preview";
import { conflitosNoLote, titleOf } from "./dedup";
import { savedSlideText } from "./post-preview";
import { slidesRepetidos } from "./post-guard";
import { carrosselForaDoPadrao, SLIDES_PADRAO_IG_FEED } from "./carousel-slides";
import type { PostRow } from "./posts-types";

export type ReviewDecision = "aceitar" | "negar";
export const GENERATED_POST_STATUS = "PendenteAprovacao" as const;

// Rascunho is the existing internally accepted state; only Agendado enters the publisher.
export function reviewStatus(decision: ReviewDecision): PostRow["status"] {
  return decision === "aceitar" ? "Rascunho" : "Arquivado";
}

export function canReview(status: PostRow["status"]): boolean {
  return status === "PendenteAprovacao";
}

export const POST_REVIEW_CHANGED = "planner-post-review-changed";

// ── Prévia obrigatória antes da aprovação ───────────────────────────────────

export type ProblemaPrevia =
  | "sem-texto"
  | "midia-ausente"
  | "midia-falhou"
  | "duplicado"
  | "slides-fora-padrao"
  | "slides-repetidos";

export function problemasPrevia(p: PreviewData): ProblemaPrevia[] {
  const out: ProblemaPrevia[] = [];
  const texto = (
    p.post.legenda_instagram ??
    p.post.legenda_linkedin ??
    p.post.legenda ??
    ""
  ).trim();
  if (texto.length < 20) out.push("sem-texto");
  if (p.media.length === 0 || p.mediaAusente.length) out.push("midia-ausente");
  if (p.mediaFalhas.length) out.push("midia-falhou");
  if (p.post.tipo_post === "Carrossel") {
    if (carrosselForaDoPadrao({ ...p.post, slides: p.media.length }))
      out.push("slides-fora-padrao");
    const textos = p.media.map((_, i) => savedSlideText(p.post.legenda, i) ?? "");
    const urls = p.media.filter(Boolean);
    if (slidesRepetidos(textos).length || new Set(urls).size < urls.length)
      out.push("slides-repetidos");
  }
  return out;
}

export const PROBLEMA_LABEL: Record<ProblemaPrevia, string> = {
  "sem-texto": "Sem legenda/texto válido",
  "midia-ausente": "Imagem ausente em um ou mais slides",
  "midia-falhou": "Imagem não carregou em um ou mais slides",
  duplicado: "Conteúdo duplicado de outro post do lote",
  "slides-fora-padrao": `Carrossel do Feed do Instagram com quantidade diferente de ${SLIDES_PADRAO_IG_FEED} slides (aprove só se foi pedido)`,
  "slides-repetidos": "Slides repetidos no carrossel (texto ou imagem iguais)",
};

/** Aprovação só depois de ver a prévia; problemas exigem "ignorar" explícito; duplicado nunca. */
export function podeAprovar(s: {
  visto: boolean;
  problemas: ProblemaPrevia[];
  ignorado: boolean;
}): boolean {
  if (!s.visto) return false;
  if (s.problemas.includes("duplicado") || s.problemas.includes("slides-repetidos")) return false;
  return s.problemas.length === 0 || s.ignorado;
}

/** Índices do lote que repetem um post anterior (texto + tema). */
export function duplicadosNoLote(
  posts: Array<{
    legenda?: string | null;
    prompt_ia?: string | null;
    data_agendamento?: string | null;
  }>,
): number[] {
  return conflitosNoLote(
    posts.map((p) => ({
      tema: p.prompt_ia || titleOf(p.legenda || "") || "?",
      titulo: titleOf(p.legenda || ""),
      corpo: (p.legenda || "").slice(0, 1500),
      quando: p.data_agendamento ?? null,
    })),
  );
}

/** Posts cuja prévia já foi aberta nesta sessão (compartilhado entre card, modal e revisão em lote). */
const vistos = new Set<string>();
export const PREVIEW_SEEN = "planner-post-preview-seen";
export function marcarVisto(id: string) {
  vistos.add(id);
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(PREVIEW_SEEN, { detail: { id } }));
}
export function foiVisto(id: string) {
  return vistos.has(id);
}
