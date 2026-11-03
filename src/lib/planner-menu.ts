// Lógica pura do menu deslizante do Planner: selecionar um item troca a seção,
// executa a ação extra do item e sempre fecha o menu.
export type ItemMenu = { v: string; onSel?: () => void };

export function selecionarItemMenu(
  item: ItemMenu,
  setTab: (v: string) => void,
  setMenuAberto: (aberto: boolean) => void,
): void {
  setTab(item.v);
  try {
    item.onSel?.();
  } finally {
    setMenuAberto(false);
  }
}

export function itemAtual<T extends { v: string }>(itens: T[], tab: string): T {
  return itens.find((i) => i.v === tab) ?? itens[0];
}
