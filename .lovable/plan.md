# Auditoria técnica e plano — Post Planner Pro (05)

Somente análise. Nenhum arquivo do app foi alterado e nenhum segredo foi lido. Abaixo aparecem apenas os nomes dos segredos.

## 1. Arquitetura atual

- Framework web full-stack TanStack Start (React 19 + Vite), rodando em Cloudflare Workers. Não usa Edge Functions do Supabase.
- Backend Lovable Cloud: banco Postgres com RLS, autenticação e armazenamento privado de imagens.
- Lógica interna do servidor (`createServerFn`): `src/lib/ai-post.functions.ts` (geração, aprovação, temas da semana), `perfil.functions.ts`, `google-business.functions.ts`, `meta-oauth.functions.ts`, `publication-destination.functions.ts`, `preview-overlay.functions.ts`, `backfill-images.functions.ts`.
- Rotas públicas (`src/routes/api/public/`): `gerar-proximo` (cron), `publicar-agendados`, `posts-agendados`, `dispatch-gbp`, `dispatch-liga`, `confirmar-publicado`, `backfill-images`, `storage-media`, callbacks OAuth da Meta e do Instagram. As rotas de cron são protegidas com `CRON_SECRET` (`src/lib/cron-auth.server.ts`).
- Integrações sociais: Meta/Instagram (OAuth e tokens de página), LinkedIn (`src/lib/social/linkedin-publish.server.ts`), Google Business via webhook do Make e Stripe.
- Regras de domínio: dedup (`dedup.ts`), proteção de posts (`post-guard.ts`), semana de 7 dias (`week-run.ts`, `week-plan.ts`), horários (`post-slots.ts`), slides (`carousel-slides.ts`), sobreposição da logo (`logo-overlay.server.ts`).

## 2. IAs e provedores

Todos os modelos estão centralizados em `src/lib/ai-models.ts` e passam pelo Lovable AI Gateway (`src/lib/ai-gateway.server.ts`), usando o segredo `LOVABLE_API_KEY`.

| Uso | Modelos oferecidos | Padrão |
|---|---|---|
| Texto | `openai/gpt-6-luna`, `openai/gpt-6.1-sol`, `google/gemini-3.1-flash-lite`, `google/gemini-3.8-flash`, `google/gemini-4-argon` | `openai/gpt-6-luna` |
| Imagem | `google/gemini-3.1-flash-lite-image`, `google/gemini-3-pro-image`, `openai/gpt-image-2.5-flare`, `openai/gpt-image-2.5-sunburst` | `google/gemini-3.1-flash-lite-image` |

- **OpenAI e Gemini:** já conectados pelo gateway. Texto vai para `/chat/completions`; imagem vai para `/images/generations` ou para o formato nativo do Gemini.
- **Anthropic/Claude:** não conectado. `AnthropicKeySettings.tsx` apenas avisa e apaga a chave antiga do navegador.
- **Modelos legados:** continuam aceitos se tiverem sido escolhidos explicitamente antes. Não existe troca silenciosa de provedor nem texto simulado.

### Quais funções dependem de cada IA

- **IA de texto:** `generateSinglePost`, `generateCaptionOnly`, `generateWeekThemes`/`getWeekTopics`, `reformularTema` (dedup) e o cron `gerar-proximo`.
- **IA de imagem:** slides e cards (`contextual-image.ts`) e `backfill-images`.
- **Telas que acionam a IA:** `PostComposer`, `PlannerSimplificado`, `PlannerAgendamentoTratamento`, `Posts7Dias`, `planner-clinica-escola`, `WeeklyCalendar`.

## 3. Chaves e segredos

Todos ficam no servidor (`process.env`, lido dentro dos handlers):
- IA: `LOVABLE_API_KEY`
- Backend: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- Redes sociais: `META_APP_ID/SECRET`, `META_INSTAGRAM_APP_ID/SECRET`, `META_FRANCISCO_ACCESS_TOKEN`, `META_LIGA_ACCESS_TOKEN`, `LINKEDIN_API_KEY`, `MAKE_GBP_WEBHOOK_URL`
- Pagamentos: `STRIPE_SECRET_KEY`
- Cron: `CRON_SECRET`

O navegador recebe somente a URL e a chave pública do backend. Nenhuma chave de IA fica no navegador.

## 4. Riscos e falhas aparentes

1. **Segurança:**
   - O bucket `post-images` é público por decisão registrada, o que entra em conflito com a regra de URLs assinadas da pré-visualização. Qualquer pessoa com o link vê as imagens.
   - Os tokens fixos da Meta em segredos expiram, e a publicação falha sem aviso prévio.
   - Rotas `/api/public/*` sem `CRON_SECRET` precisam de revisão uma a uma.
   - O servidor usa a service role; é preciso confirmar que só a carrega depois de verificar quem chamou.
2. **Custos:**
   - Uma semana tem 56 posts, e cada carrossel gera 5 imagens. As imagens são o maior gasto.
   - Novas tentativas e reformulações de dedup multiplicam as chamadas.
   - Os créditos são do workspace; não existe limite de gasto definido no app.
3. **Limites:**
   - Respostas 429/402 do gateway interrompem slots.
   - O Worker tem limite de tempo por requisição, por isso a semana roda em sequência.
4. **Falhas observadas:**
   - Teste real anterior: 49 de 56 slots falharam por dedup excessiva.
   - Imagens saíram com "LOGO" escrito e erros de digitação.
   - O histórico de dedup não filtra por conta (a Liga influencia o Chico).
   - Avisos de API depreciada (`inputValidator`) e ausência de middleware CSRF nas server functions.
   - 81 erros de lint e uma suíte de testes vazia que quebra a execução completa.

## 5. Plano A — ChatGPT/assistente trabalhando no código

O Lovable sincroniza o código com um repositório GitHub novo e privado, nos dois sentidos, sempre pelo branch configurado.

Configuração manual pelo proprietário:
1. Em Configurações do projeto → Git, conectar o GitHub. Isso cria o repositório.
2. No ChatGPT, ativar o conector GitHub (ou Codex) e dar acesso **apenas** a esse repositório.
3. Proteger o branch principal e pedir que o ChatGPT trabalhe em branches separados com Pull Requests. O proprietário revisa e faz o merge, e o Lovable puxa a mudança.

Regras de segurança:
- Nunca enviar segredos ao repositório. Eles continuam em Configurações → Secrets.
- Migrações de banco não são aplicadas pelo Git; devem ser aplicadas pelo chat do Lovable.
- Pushes forçados ou rebase do branch principal podem substituir trabalho feito no Lovable.
- O `AGENTS.md` já documenta as regras de arquitetura para o assistente externo.

## 6. Plano B — OpenAI API como opção no Planner

Os modelos OpenAI já estão disponíveis pelo gateway. A nova opção será uma rota "OpenAI direta (chave própria)", sem remover nenhum provedor.

Configuração manual: o proprietário adiciona `OPENAI_API_KEY` em Configurações → Secrets. Ela só será pedida depois da aprovação deste plano.

Etapas:
1. `src/lib/ai-models.ts`: adicionar o provedor `openai-direct` com IDs confirmados em `GET https://api.openai.com/v1/models`, usando a chave apenas no servidor. Rótulo: "OpenAI (sua chave)".
2. `src/lib/ai-gateway.server.ts`: criar um roteador por provedor. `openai-direct` chama `https://api.openai.com/v1/chat/completions` e `/v1/images/generations`. Se `OPENAI_API_KEY` não existir, mostrar um erro claro, sem cair para outro provedor.
3. Seletores de texto e imagem (`PostComposer`, planners, `Posts7Dias`): incluir as novas opções e manter a escolha atual do usuário.
4. Validação: a chave é lida somente dentro dos handlers e nunca é registrada em log nem devolvida ao navegador. Tratar 401/429/402 com mensagens em português.
5. Testes: IDs permitidos, roteamento para api.openai.com, erro quando a chave falta, ausência de fallback e um modelo de gateway preservado. Nenhuma geração real.
6. Atualizar `AGENTS.md` com a regra de roteamento.

Observação de custo: a rota direta cobra na conta OpenAI do proprietário e perde os logs e limites do painel de IA do Lovable. Os mesmos modelos já existem no gateway pelo preço de tabela do provedor.

## Exige ação do proprietário

- Conectar o GitHub e autorizar o ChatGPT a acessar só esse repositório.
- Proteger o branch principal.
- Adicionar `OPENAI_API_KEY`, apenas se quiser usar a rota direta.
- Decidir sobre o bucket público e a renovação dos tokens da Meta.
