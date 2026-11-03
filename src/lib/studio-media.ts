import { useEffect, useState, useSyncExternalStore } from "react";
import type { PerfilId } from "./studio-profiles";
import type { StudioContent } from "./studio-publication";

/**
 * Art chosen in the Image Studio, scoped to user + editorial profile.
 * Only persisted storage URLs are kept (memory + sessionStorage), never volatile data URLs,
 * so the art survives tab/profile/mode switches and reloads without crossing accounts.
 */
export type MidiaEstudio = { userId: string; perfil: PerfilId; tema: string; imagens: string[]; formato: StudioContent["formato"]; rede: StudioContent["rede"] };

const PREFIXO = "studio-midia:v2";
export const chaveMidia = (userId: string, perfil: PerfilId) => `${PREFIXO}:${userId}:${perfil}`;

let atual: MidiaEstudio | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(f => f());
const storage = (): Storage | null => { try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; } };

export function definirMidiaEstudio(m: MidiaEstudio, armazenamento: Storage | null = storage()) {
  if (!m.userId) throw new Error("Entre na sua conta para anexar a arte.");
  if (m.imagens.some(s => !/^https:\/\//.test(s))) throw new Error("A arte precisa estar salva no app antes de ser anexada.");
  atual = { ...m, imagens: [...m.imagens] };
  try { armazenamento?.setItem(chaveMidia(m.userId, m.perfil), JSON.stringify(atual)); } catch { /* quota */ }
  avisar();
}
export function limparMidiaEstudio(userId: string, perfil: PerfilId, armazenamento: Storage | null = storage()) {
  if (atual && atual.userId === userId && atual.perfil === perfil) atual = null;
  try { armazenamento?.removeItem(chaveMidia(userId, perfil)); } catch { /* ignore */ }
  avisar();
}
export function lerMidiaEstudio() { return atual; }

/** Restores the art for exactly this user + profile; anything else returns null. */
export function restaurarMidia(userId: string, perfil: PerfilId, armazenamento: Storage | null = storage()): MidiaEstudio | null {
  if (atual && atual.userId === userId && atual.perfil === perfil) return atual;
  try {
    const raw = armazenamento?.getItem(chaveMidia(userId, perfil));
    if (!raw) return null;
    const m = JSON.parse(raw) as MidiaEstudio;
    if (m.userId !== userId || m.perfil !== perfil || !Array.isArray(m.imagens) || !m.imagens.length) return null;
    return m;
  } catch { return null; }
}

function assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

/** Exports the final canvas (text/logo/filters included) to a File and uploads it once. */
export async function persistirArteCanvas(toBlob: () => Promise<Blob | null>, upload: (f: File) => Promise<string>): Promise<string> {
  const blob = await toBlob();
  if (!blob || !blob.size) throw new Error("Não foi possível exportar a arte final do editor.");
  const url = await upload(new File([blob], `studio-arte-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" }));
  if (!/^https:\/\//.test(url)) throw new Error("O envio da arte não retornou um endereço válido.");
  return url;
}

export function useMidiaEstudio(perfil: PerfilId, userId: string | null) {
  useSyncExternalStore(assinar, lerMidiaEstudio, () => null);
  return userId ? restaurarMidia(userId, perfil) : null;
}

export function useUsuarioAtual() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data } = await supabase.auth.getUser();
      if (vivo) setUid(data.user?.id ?? null);
    });
    return () => { vivo = false; };
  }, []);
  return uid;
}

/** Combines text with the selected art without inventing media. */
export function conteudoComMidia(base: Omit<StudioContent, "imagens" | "formato">, m: MidiaEstudio | null): StudioContent {
  if (!m) return { ...base, imagens: [], formato: "Post Único" };
  return { ...base, imagens: m.imagens, formato: m.formato };
}

/** Default media to send in Advanced AI: use what is ready instead of silently sending zero images. */
export type MidiaEnvio = "nenhuma" | "unico" | "capa" | "carrossel";
export function midiaPadrao(prontas: Record<string, string>, slides: number): MidiaEnvio {
  const completo = !!prontas.capa && Array.from({ length: slides - 1 }, (_, i) => prontas[`slide-${i + 2}`]).every(Boolean);
  if (completo && slides > 1) return "carrossel";
  if (prontas.unico) return "unico";
  if (prontas.capa) return "capa";
  return "nenhuma";
}
