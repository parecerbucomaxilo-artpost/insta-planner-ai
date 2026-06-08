## O que será construído

### 1. Calendário Editorial Semanal (nova aba "Semana")
- Nova aba na navegação principal: **Semana**.
- Grid Seg–Sex (5 colunas) da semana corrente, com setas ‹ › para navegar semanas.
- Botão proeminente **"Gerar Cronograma da Semana"** que chama o Claude uma única vez pedindo 5 temas distintos de CTBMF e gera, em paralelo, legenda + imagem 1:1 Premium para cada dia.
- Cada card do dia mostra miniatura + tema + status. Clicar abre um Dialog com edição inline do texto/imagem e botão **"Postar Agora"** ou **"Agendar para este dia"**.
- Persistência: cada card vira um registro em `posts` com `data_agendamento` = data do dia 09:00 e `status = "Rascunho"`. Regerar substitui o registro daquele dia.

### 2. Painel "Perfil do Especialista" (Memória da IA)
- Substitui a aba **Perfil** atual por uma versão expandida (mantém o que existe e adiciona campos novos):
  - Nome do Profissional (já existe)
  - **CRO/UF** (novo)
  - **Subespecialidades** (novo, chips multi: Ortognática, DTM, Implantes Zigomáticos, Trauma Facial, Patologia Bucal, Oncologia CP, Reconstrução, Implantes Convencionais — com "+ adicionar")
  - **Tom de voz** (novo, radio: Científico · Humanizado · Editorial)
- Migração: adiciona colunas `cro_uf TEXT`, `subespecialidades TEXT[]`, `tom_voz TEXT` em `perfil_usuario`.
- A IA (Claude) recebe um bloco **CONTEXTO DO ESPECIALISTA** com esses dados em todo `suggestIdea` e `weeklyPlan`.
- A geração de imagem injeta um overlay textual sutil **"Dr(a). Nome · CRO/UF"** no canto inferior da imagem (canvas client-side, mesma técnica do watermark já existente).

### 3. Mockup de Feed real (ao lado do resultado)
- Novo componente `FeedMockup` exibido no painel direito do compositor, dentro de uma moldura de smartphone (frame arredondado, notch sutil).
- Modo **Instagram**: grid 3×3 — a imagem gerada ocupa a célula superior-esquerda, as 8 restantes vêm dos últimos posts publicados/agendados do usuário (busca em `posts`). Falhando isso, placeholders elegantes.
- Modo **X (Twitter)**: timeline corrida com 3 tweets — o tweet atual no topo (avatar, @, texto, imagem 16:9), e 2 tweets-fantasma abaixo para dar contexto de feed.
- O mockup substitui o `PostPreview` atual no compositor (mantemos `PostPreview` para listagens/calendário).

### 4. Card "Mensagem de Resposta Rápida (Direct)"
- Adicionado ao `suggestIdea` (Claude) um novo campo opcional `mensagem_direct` (≤ 400 chars): texto acolhedor e profissional para responder DMs/comentários.
- Renderizado como Card logo abaixo da legenda gerada, com botão **Copiar** (clipboard) e tooltip de uso.
- No modo X, também é gerado (resposta curta para responder menções).

## Detalhes técnicos

### Migração SQL
```sql
ALTER TABLE public.perfil_usuario
  ADD COLUMN IF NOT EXISTS cro_uf TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subespecialidades TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tom_voz TEXT NOT NULL DEFAULT 'Científico';
```
(Sem novas tabelas → sem novos GRANT/RLS; `perfil_usuario` já está acessível.)

### Backend
- `src/lib/ai/suggest-idea.functions.ts`: aceita `perfil?: { nome, cro_uf, subespecialidades[], tom_voz }`, injeta bloco "CONTEXTO DO ESPECIALISTA" no system prompt e adiciona `mensagem_direct` ao schema da tool.
- Novo `src/lib/ai/weekly-plan.functions.ts` (`createServerFn`) que devolve `{ dias: [{ titulo, prompt_imagem, legenda_instagram, mensagem_direct }] x5 }` em uma única chamada Claude (economiza tokens).
- `src/lib/ai/generate-image.functions.ts`: já está parametrizado por aspect/conceptual — sem mudança.
- Watermark estendido em `src/lib/watermark.ts`: nova função `applyDoctorBadge(src, { nome, cro })` que escreve barra inferior sutil "Dr(a). X · CRO 12345/SP" em tipografia serif clara sobre faixa navy translúcida.

### Frontend
- `src/components/ProfileSettings.tsx`: adiciona os 3 novos campos com componentes shadcn (Input, multi-chip, RadioGroup) e persistência em `perfil_usuario`.
- `src/components/WeeklyCalendar.tsx` (novo): grid 5 colunas, navegação semanal, botão de geração, Dialog de edição.
- `src/components/FeedMockup.tsx` (novo): frame de smartphone + tabs internas Instagram/X.
- `src/components/DirectReplyCard.tsx` (novo): card "Mensagem de Resposta Rápida (Direct)" com botão copiar.
- `src/components/PostComposer.tsx`: substitui `PostPreview` por `FeedMockup`, monta `DirectReplyCard` abaixo da legenda em ambos os modos (padrão e X), e injeta `perfil` em todas as chamadas `genIdea`.
- `src/routes/index.tsx`: adiciona aba **Semana** ao lado de **Criar**.

### Estética
- Mantém paleta navy/slate/branco já definida em `src/styles.css`.
- Bordas `rounded-2xl`, sombras `shadow-elegant`/`shadow-elevated`, transições suaves já globais via `:root`.

## Fora de escopo desta entrega
- Publicação real no X (continua sem integração — o estilo X é só de composição/preview).
- Drag-and-drop entre dias do calendário (apenas clique-editar nesta primeira versão).
- Tradução automática para outros idiomas além de pt-BR.