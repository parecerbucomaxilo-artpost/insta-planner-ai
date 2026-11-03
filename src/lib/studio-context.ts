import type { PerfilId } from './studio-profiles';
import type { Objetivo } from './free-studio';

export const OBJETIVOS_ESTUDIO = ['Educar', 'Prevenir', 'Orientar', 'Informar', 'Fortalecer autoridade', 'Autoridade', 'Educativo', 'Engajamento', 'Institucional'];
export type MaterialEstudio = { id: string; userId: string; perfil: PerfilId; tema: string; objetivo: string; escolhidos: { tema: boolean; objetivo: boolean }; rascunhos: Record<string, unknown> };
export const chaveContexto = (userId: string, perfil: PerfilId) => `studio-context:v1:${userId}:${perfil}`;
export function novoMaterial(userId: string, perfil: PerfilId): MaterialEstudio {
  return { id: crypto.randomUUID(), userId, perfil, tema: '', objetivo: '', escolhidos: { tema: false, objetivo: false }, rascunhos: {} };
}
export function alterarContexto(m: MaterialEstudio, campo: 'tema' | 'objetivo', valor: string): MaterialEstudio {
  return { ...m, [campo]: valor.trim(), escolhidos: { ...m.escolhidos, [campo]: true } };
}
export function preencherContexto(m: MaterialEstudio, dados: { tema?: string; objetivo?: string }): MaterialEstudio {
  let out = m;
  for (const campo of ['tema', 'objetivo'] as const) {
    if (!m.escolhidos[campo] && !m[campo] && dados[campo]?.trim()) out = { ...out, [campo]: dados[campo].trim() };
  }
  return out;
}
export function salvarMaterial(m: MaterialEstudio, storage: Pick<Storage, 'setItem'> | null) {
  try { storage?.setItem(chaveContexto(m.userId, m.perfil), JSON.stringify(m)); storage?.setItem(`${chaveContexto(m.userId, m.perfil)}:${m.id}`, JSON.stringify(m)); } catch { /* Keep the live draft if browser storage is full. */ }
}
export function restaurarMaterial(userId: string, perfil: PerfilId, storage: Pick<Storage, 'getItem'> | null): MaterialEstudio {
  try {
    const raw = storage?.getItem(chaveContexto(userId, perfil));
    const m = raw ? JSON.parse(raw) as MaterialEstudio : null;
    if (m && m.userId === userId && m.perfil === perfil && typeof m.id === 'string' && typeof m.tema === 'string' && typeof m.objetivo === 'string' && m.escolhidos && m.rascunhos) return m;
  } catch { /* Corrupt drafts do not borrow another material. */ }
  return novoMaterial(userId, perfil);
}
/** Explicit mapping to the existing local templates, never a default for an absent objective. */
export function objetivoLocal(valor: string): Objetivo | null {
  if (['Educar', 'Educativo', 'Prevenir', 'Orientar', 'Informar'].includes(valor)) return 'educativo';
  if (['Fortalecer autoridade', 'Autoridade'].includes(valor)) return 'autoridade';
  if (valor === 'Engajamento') return 'engajamento';
  if (valor === 'Institucional') return 'institucional';
  return null;
}