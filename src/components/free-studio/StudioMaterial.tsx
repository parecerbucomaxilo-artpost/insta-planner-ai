import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { alterarContexto, novoMaterial, preencherContexto, restaurarMaterial, salvarMaterial, type MaterialEstudio } from '@/lib/studio-context';
import type { PerfilId } from '@/lib/studio-profiles';

type Context = { material: MaterialEstudio; alterar: (campo: 'tema' | 'objetivo', valor: string) => void; preencher: (dados: { tema?: string; objetivo?: string }) => void; novo: () => void; guardar: (chave: string, valor: unknown) => void };
const MaterialContext = createContext<Context | null>(null);
function storage() { try { return window.sessionStorage; } catch { return null; } }
export function StudioMaterial({ userId, perfil, children }: { userId: string | null; perfil: PerfilId; children: ReactNode }) {
  const [material, setMaterial] = useState(() => novoMaterial(userId ?? 'visitante', perfil));
  const [pronto, setPronto] = useState(false);
  useEffect(() => { setMaterial(restaurarMaterial(userId ?? 'visitante', perfil, userId ? storage() : null)); setPronto(true); }, [userId, perfil]);
  useEffect(() => { if (pronto && userId) salvarMaterial(material, storage()); }, [material, pronto, userId]);
  if (!pronto) return null;
  return <MaterialContext.Provider value={{ material, alterar: (k, v) => setMaterial(m => alterarContexto(m, k, v)), preencher: d => setMaterial(m => preencherContexto(m, d)), novo: () => { if (userId) salvarMaterial(material, storage()); setMaterial(novoMaterial(userId ?? 'visitante', perfil)); }, guardar: (k, v) => setMaterial(m => ({ ...m, rascunhos: { ...m.rascunhos, [k]: v } })) }}>{children}</MaterialContext.Provider>;
}
export function useStudioMaterial() { const c = useContext(MaterialContext); if (!c) throw new Error('Contexto do material indisponível.'); return c; }
/** Draft updates are stored only on explicit edits/results, not when central context changes. */
export function useRascunhoStudio<T>(chave: string, inicial: T) {
  const { material, guardar } = useStudioMaterial();
  const [valor, setValor] = useState<T>(() => (material.rascunhos[chave] as T | undefined) ?? inicial);
  const ref = useRef(valor);
  const set = (acao: SetStateAction<T>) => { const v = typeof acao === 'function' ? (acao as (s: T) => T)(ref.current) : acao; ref.current = v; setValor(v); guardar(chave, v); };
  return [valor, set] as const;
}