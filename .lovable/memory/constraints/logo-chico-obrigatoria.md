---
name: Logo Chico obrigatória em todo post do Planner Simplificado Chico
description: Toda publicação do Planner Simplificado Chico (@drfranciscomenezes) DEVE ter a logo oficial "Σ branco + quadrado ciano" aplicada. Arquivo oficial e regra de overlay.
type: constraint
---
Arquivos oficiais para seleção/overlay — NÃO trocar por recortes improvisados:
1. `src/assets/logo-nsp.png.asset.json` — NSP oficial enviado pelo usuário: "Núcleo de Segurança do Paciente — Anhanguera de Santa Bárbara".
2. `src/assets/logo-anhanguera-sbo.png` — Anhanguera Santa Bárbara d'Oeste.
3. `src/assets/logo-dr-francisco.png.asset.json` — Prof. Francisco Menezes / Planner Chico (símbolo Σ branco + quadrado ciano #2dd4ff sobre fundo azul petróleo #0c2340). Esta é a logo correta; NÃO usar o selo anatômico circular da Liga como logo do Prof. Francisco.
4. `src/assets/logo-liga-ctbmf.png` — Liga Acadêmica de CTBMF.
5. `src/assets/logo-clinica-escola.png` — Clínica Escola / Odontologia Santa Bárbara.

Ordem obrigatória no dashboard e nos planners: NSP → Anhanguera Santa Bárbara d'Oeste → Prof. Francisco Menezes → Liga → Clínica Escola → Sem logo.
O dashboard deve permitir selecionar uma ou mais logos ao mesmo tempo; quando houver múltiplas, o sistema aplica todas juntas em faixa no rodapé.

Aplicação (não-negociável):
- Sistema aplica overlay real via `overlayLogo()` em `src/lib/logo-overlay.server.ts` (canto inferior direito, ~10% da largura, com a(s) logo(s) escolhida(s) no dashboard).
- Chamado em 100% das gerações Chico em `src/lib/ai-post.functions.ts` (feed único, carrossel 1º + último card, story, estilo X). Sem exceção.
- Preview do post também aplica via `previewPostWithLogo` para a conta `drfranciscomenezes`.

Regra para a IA de imagem: **NUNCA desenhar/imitar a logo**. Apenas reservar o canto inferior direito limpo (área ~15% x 15%, sem texto, sem elementos gráficos, sem gradiente forte) para o overlay real do sistema. Se a IA desenhar logo falsa, a arte é rejeitada.

Paleta da arte segue a logo: azul petróleo #0c2340 (fundo dominante), branco puro #ffffff, ciano #2dd4ff (acento). Nenhuma outra cor.

**Why:** O usuário exigiu explicitamente que esta logo esteja em todas as publicações e que a IA use — não é opcional, não é estilístico.
