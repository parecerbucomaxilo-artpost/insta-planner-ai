import type { LogoKey } from "./logos-catalog";

/** Only an explicit selection enables logos; an empty array overrides legacy selection. */
export function logosEscolhidos(keys?: LogoKey[], legacy?: LogoKey): LogoKey[] {
  const selected = keys ?? (legacy ? [legacy] : []);
  return selected.includes("nenhuma") ? [] : [...new Set(selected)];
}

export async function carregarLogoManual<T>(enabled: boolean, load: () => Promise<T>): Promise<T | null> {
  return enabled === true ? load() : null;
}