import { useSyncExternalStore } from "react";
import type { PerfilId } from "./studio-profiles";
import type { StudioContent } from "./studio-publication";

/** Art chosen in the Image Studio, kept in memory (data URLs are too big for storage) so it survives tab switches. */
export type MidiaEstudio = { perfil: PerfilId; tema: string; imagens: string[]; formato: StudioContent["formato"]; rede: StudioContent["rede"] };

let atual: MidiaEstudio | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(f => f());

export function definirMidiaEstudio(m: MidiaEstudio | null) { atual = m && m.imagens.length ? { ...m, imagens: [...m.imagens] } : null; avisar(); }
export function lerMidiaEstudio() { return atual; }
function assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

/** Returns the selected art only for the same editorial profile, never across profiles. */
export function useMidiaEstudio(perfil: PerfilId) {
  const m = useSyncExternalStore(assinar, lerMidiaEstudio, () => null);
  return m && m.perfil === perfil ? m : null;
}

/** Combines text with the selected art without inventing media. */
export function conteudoComMidia(base: Omit<StudioContent, "imagens" | "formato">, m: MidiaEstudio | null): StudioContent {
  if (!m) return { ...base, imagens: [], formato: "Post Único" };
  return { ...base, imagens: m.imagens, formato: m.formato };
}
