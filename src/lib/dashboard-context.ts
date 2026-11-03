import type { PerfilId } from "./studio-profiles";

/** Subset of the Dashboard profile (perfil_usuario) that is safe to reuse as generation context. */
export type PerfilDashboard = {
  user_id?: string | null;
  nome_profissional?: string | null;
  arroba_usuario?: string | null;
  instagram_arroba?: string | null;
  cro_uf?: string | null;
  subespecialidades?: string[] | null;
  tom_voz?: string | null;
  objetivo?: string | null; // não existe no cadastro atual; mantido para quando existir
};

export type ContextoDashboard = { objetivo: string; nome: string; area: string; tom: string };

/** Only editorial profiles with their own Dashboard account. Others never borrow another account's data. */
const CONTA_DO_PERFIL: Partial<Record<PerfilId, string>> = {
  chico: "drfranciscomenezes",
  liga: "lactbmf.anhanguerasbo",
};

const norm = (s?: string | null) => (s ?? "").trim().replace(/^@/, "").toLowerCase();

export function perfilDashboardDe(rows: PerfilDashboard[], perfil: PerfilId, userId: string): PerfilDashboard | null {
  const conta = CONTA_DO_PERFIL[perfil];
  if (!conta) return null;
  return rows.find(r => r.user_id === userId && (norm(r.instagram_arroba) === conta || norm(r.arroba_usuario) === conta)) ?? null;
}

/** Real saved values only; missing fields stay empty (never invented). */
export function contextoDashboard(r: PerfilDashboard | null): ContextoDashboard {
  if (!r) return { objetivo: "", nome: "", area: "", tom: "" };
  const subs = (r.subespecialidades ?? []).map(s => s.trim()).filter(Boolean);
  return {
    objetivo: (r.objetivo ?? "").trim(),
    nome: (r.nome_profissional ?? "").trim(),
    area: [subs.join(", "), (r.cro_uf ?? "").trim()].filter(Boolean).join(" · "),
    tom: (r.tom_voz ?? "").trim(),
  };
}

export function linhaContexto(c: ContextoDashboard) {
  return [c.nome && `Profissional: ${c.nome}`, c.area && `Área de atuação: ${c.area}`].filter(Boolean).join(" · ");
}

type Campos = { objetivo: string; tom: string; contexto: string };

/** Fills only empty/untouched fields, unless the user explicitly clicked "Usar dados do Dashboard". */
export function aplicarDashboard<T extends Campos>(atual: T, c: ContextoDashboard, editados: ReadonlySet<keyof Campos>, forcar = false): T {
  const novo = { objetivo: c.objetivo, tom: c.tom, contexto: linhaContexto(c) };
  const out = { ...atual };
  (Object.keys(novo) as (keyof Campos)[]).forEach(k => {
    if (!novo[k]) return;
    if (forcar || (!editados.has(k) && !atual[k].trim())) out[k] = novo[k] as T[typeof k];
  });
  return out;
}
