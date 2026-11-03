import type { StudioDestination } from "./studio-publication";

export type DestinationOption = StudioDestination & { id: string; nome: string };
export type DestinationList = { contas: DestinationOption[]; avisos: string[] };
export type DestinationReaders = {
  usuario: () => Promise<string>;
  perfis: (uid: string) => Promise<string[]>;
  instagram: (conta: string) => Promise<boolean>;
  linkedin: () => Promise<{ connected: boolean; message: string }>;
};

/** Read-only existing auth/profile/connection checks; never creates or publishes. */
export async function carregarDestinos(r: DestinationReaders): Promise<DestinationList> {
  const uid = await r.usuario();
  const profiles = await r.perfis(uid);
  const names = [...new Set(profiles.map(s => s.replace(/^@+/, "").trim().toLowerCase()).filter(Boolean))];
  const avisos: string[] = [];
  const contas: DestinationOption[] = [];
  await Promise.all(names.map(async conta => {
    try {
      if (await r.instagram(conta)) contas.push({ id: `instagram:${conta}`, nome: `@${conta}`, canal: "instagram", conta, conectado: true });
    } catch { avisos.push(`Não foi possível verificar @${conta}. Tente carregar novamente.`); }
  }));
  try {
    const li = await r.linkedin();
    if (li.connected) contas.push({ id: "linkedin:membro", nome: "Membro da conexão LinkedIn existente", canal: "linkedin", conta: "membro", conectado: true });
    else avisos.push(li.message);
  } catch { avisos.push("Não foi possível verificar a conexão LinkedIn. Tente carregar novamente."); }
  return { contas: contas.sort((a, b) => a.id.localeCompare(b.id)), avisos };
}

export async function comPrazo<T>(acao: () => Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([acao(), new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("O carregamento demorou demais. Tente novamente.")), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}