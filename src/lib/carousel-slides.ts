// Regra global: carrossel do Feed do Instagram = 5 slides, salvo pedido explícito.
// Stories, Reels e outras plataformas mantêm suas próprias regras.
export const SLIDES_PADRAO_IG_FEED = 5;
export const SLIDES_MIN = 2;
export const SLIDES_MAX = 10;

export function quantidadeSlides(o: {
  rede: string;
  formato?: string | null;
  tipo?: string | null;
  pedido?: number | null;
}): number {
  if (o.formato !== "Carrossel") return 1;
  if (o.pedido && Number.isFinite(o.pedido))
    return Math.min(SLIDES_MAX, Math.max(SLIDES_MIN, Math.round(o.pedido)));
  if (o.rede === "estilo-x") return 3;
  return SLIDES_PADRAO_IG_FEED;
}

/** Carrossel do Feed do IG fora do padrão (sem pedido explícito salvo) — sinalizado na prévia. */
export function carrosselForaDoPadrao(o: {
  tipo_post?: string | null;
  postar_instagram?: boolean | null;
  estilo_layout?: string | null;
  slides: number;
}): boolean {
  if (o.tipo_post !== "Carrossel" || !o.postar_instagram || o.estilo_layout === "Estilo X")
    return false;
  return o.slides !== SLIDES_PADRAO_IG_FEED;
}
