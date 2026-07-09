---
name: Logo Chico obrigatória em todo post do Planner Simplificado Chico
description: Toda publicação do Planner Simplificado Chico (@drfranciscomenezes) DEVE ter a logo "F + Σ + quadrado ciano" aplicada. Arquivo oficial e regra de overlay.
type: constraint
---
Arquivo oficial para seleção/overlay do Prof. Francisco: `src/assets/logo-dr-francisco.png` (símbolo Σ branco + quadrado ciano #2dd4ff sobre fundo azul petróleo #0c2340), recortado da arte institucional enviada pelo usuário em 08/jul/2026 — NÃO substituir sem novo upload dele.

Aplicação (não-negociável):
- Sistema aplica overlay real via `overlayLogo()` em `src/lib/logo-overlay.server.ts` (canto inferior direito, ~10% da largura, com a logo escolhida no dashboard).
- Chamado em 100% das gerações Chico em `src/lib/ai-post.functions.ts` (feed único, carrossel 1º + último card, story, estilo X). Sem exceção.
- Preview do post também aplica via `previewPostWithLogo` para a conta `drfranciscomenezes`.

Regra para a IA de imagem: **NUNCA desenhar/imitar a logo**. Apenas reservar o canto inferior direito limpo (área ~15% x 15%, sem texto, sem elementos gráficos, sem gradiente forte) para o overlay real do sistema. Se a IA desenhar logo falsa, a arte é rejeitada.

Paleta da arte segue a logo: azul petróleo #0c2340 (fundo dominante), branco puro #ffffff, ciano #2dd4ff (acento). Nenhuma outra cor.

**Why:** O usuário exigiu explicitamente que esta logo esteja em todas as publicações e que a IA use — não é opcional, não é estilístico.
