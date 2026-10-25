import type { PostRow } from "@/lib/posts-types";
import { FUSO_PADRAO } from "@/lib/post-slots";

export type PreviewPlatform = "instagram" | "linkedin";

export function previewPlatforms(post: PostRow): PreviewPlatform[] {
  return [
    ...(post.postar_instagram ? ["instagram" as const] : []),
    ...(post.postar_linkedin ? ["linkedin" as const] : []),
  ];
}

export function previewCaption(post: PostRow, platform: PreviewPlatform | null): string {
  if (platform === "instagram") return post.legenda_instagram ?? post.legenda ?? "";
  if (platform === "linkedin") return post.legenda_linkedin ?? post.legenda ?? "";
  return post.legenda ?? "";
}

export function savedSlideText(caption: string, index: number): string | null {
  const blocks = [
    ...(caption || "").matchAll(
      /^\s*\**Slide\s*(\d+)\s*\**\s*[:\-–—.)]?\s*([\s\S]*?)(?=^\s*\**Slide\s*\d+\b|(?![\s\S]))/gim,
    ),
  ];
  return blocks.find((block) => Number(block[1]) === index + 1)?.[2]?.trim() || null;
}

export function canEditPreview(status: PostRow["status"]): boolean {
  return status === "PendenteAprovacao" || status === "Rascunho";
}

function carousel(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : ""));
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => (typeof v === "string" ? v : ""));
    } catch {
      return [value];
    }
  }
  return [];
}

/** Mídia salva, alinhada por slide (null = slide sem imagem salva; nunca troca pela capa). */
export function previewMedia(post: PostRow): (string | null)[] {
  if (post.tipo_post !== "Carrossel") return post.url_imagem ? [post.url_imagem] : [];
  const imgs = carousel(post.imagens_carrossel);
  const numbers = [...(post.legenda || "").matchAll(/^\s*\**Slide\s*(\d+)\b/gim)].map((m) => Number(m[1]));
  const total = Math.max(imgs.length, ...numbers, 0);
  return Array.from({ length: total }, (_, i) => imgs[i] || null);
}

/** Data/horário no fuso do projeto (não no fuso do navegador/servidor). */
export function formatPreviewDate(iso: string | null | undefined, tz = FUSO_PADRAO): string {
  if (!iso) return "Sem data/horário";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Data inválida";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (horário de Brasília)`;
}

export type PreviewDeps = {
  fetchPost: (id: string) => Promise<{ data: PostRow | null; error: { message: string; code?: string } | null }>;
  /** Devolve URL exibível ou null se a mídia não puder ser acessada. */
  signOne: (url: string) => Promise<string | null>;
};

export type PreviewData = {
  post: PostRow;
  /** Uma entrada por slide; null = sem imagem utilizável. */
  media: (string | null)[];
  /** Slides que têm imagem salva mas não puderam ser carregados (permissão/arquivo). */
  mediaFalhas: number[];
  /** Slides sem nenhuma imagem salva. */
  mediaAusente: number[];
};

export class PreviewLoadError extends Error {}

/** Carrega a prévia pelo ID real: post do banco + mídia assinada, sem mock e sem trocar slides. */
export async function loadPostPreview(id: string, deps: PreviewDeps): Promise<PreviewData> {
  if (!id) throw new PreviewLoadError("Post sem identificador — não é possível abrir a prévia.");
  let res: Awaited<ReturnType<PreviewDeps["fetchPost"]>>;
  try {
    res = await deps.fetchPost(id);
  } catch (e) {
    throw new PreviewLoadError(
      `Falha de conexão ao carregar o post: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (res.error) {
    const auth = /jwt|auth|permission|401|403|rls/i.test(`${res.error.code ?? ""} ${res.error.message}`);
    throw new PreviewLoadError(
      auth
        ? "Sua sessão expirou ou você não tem permissão para ver este post. Entre novamente."
        : `Não foi possível carregar o post: ${res.error.message}`,
    );
  }
  if (!res.data) {
    throw new PreviewLoadError("Post não encontrado (pode ter sido excluído) ou sem permissão de acesso.");
  }
  const post = res.data;
  const raw = previewMedia(post);
  const mediaFalhas: number[] = [];
  const mediaAusente: number[] = [];
  const media = await Promise.all(
    raw.map(async (url, i) => {
      if (!url) {
        mediaAusente.push(i);
        return null;
      }
      const signed = await deps.signOne(url).catch(() => null);
      if (!signed) mediaFalhas.push(i);
      return signed;
    }),
  );
  return { post, media, mediaFalhas: mediaFalhas.sort((a, b) => a - b), mediaAusente: mediaAusente.sort((a, b) => a - b) };
}
