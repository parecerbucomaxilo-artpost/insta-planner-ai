# Auditoria inicial e plano de migração — Insta Planner AI 2.0

Data: 2026-11-05
Escopo: leitura estática do branch `main` e preparação da migração. Nenhum serviço externo foi conectado, nenhum dado de produção foi alterado e nenhum deploy foi realizado.

## 1. Arquitetura identificada

- Frontend e servidor: React 19, TypeScript, TanStack Start, Vite 7 e Tailwind 4.
- Backend de dados: Supabase JS; cliente administrativo usa `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor.
- Autenticação: integração Lovable Cloud Auth/Supabase; middleware em `src/integrations/supabase/auth-middleware.ts`.
- Banco: dezenas de migrations Supabase e migrations Drizzle.
- Publicação: integração Meta/Instagram, LinkedIn via Connector Gateway Lovable e Google Business por webhook Make.
- Rotinas: rotas cron públicas com segredo, geração de slots e publicação agendada.
- Dependências Lovable: configuração de build `@lovable.dev/vite-tanstack-config`, gateway Lovable AI e Connector Gateway LinkedIn.

## 2. IA já existente e lacunas

### Texto
Já existe integração direta com Gemini Developer API em `src/lib/gemini-free.server.ts`, com `GEMINI_API_KEY` lida no servidor e tratamento de HTTP 429/401/403 e resposta vazia. O catálogo contém `gemini-3.1-flash-lite` como opção de geração direta. A chamada direta não usa o gateway Lovable para esse modelo.

Ainda não foi comprovado, nesta auditoria estática, o limite efetivo da conta Google AI Studio, a existência de controles globais de consumo, deduplicação/cache de requisições Gemini ou bloqueio de faturamento pago. Isso depende de configuração e teste com a conta do proprietário.

### Imagens
A geração principal continua em `src/lib/ai-gateway.server.ts`, que envia imagens ao Lovable AI Gateway. Não foi encontrada integração Cloudflare Workers AI no inventário de arquivos analisado. A substituição por FLUX precisa preservar o pipeline contextual, associação post/slide, upload privado, cache e overlay de logotipo.

O projeto já tem proteção importante: falha/recusa não deve ser convertida em imagem procedural ou em imagem de outro provedor; preservar essa regra.

## 3. Achados de segurança prioritários

### CRÍTICO — fallback de autenticação para usuário temporário
`src/integrations/supabase/auth-middleware.ts` aceita requisição sem Bearer token e atribui o usuário fixo `00000000-0000-0000-0000-000000000000`. Também converte token inválido em identidade temporária, em vez de negar acesso.

`src/lib/ai-post.functions.ts` contém `generateSinglePost` sem middleware de autenticação visível na declaração analisada e define o mesmo `TEMP_USER_ID`. Isso pode misturar dados de diferentes sessões e permitir chamadas sem identidade validada. É bloqueador para uma migração segura e deve ser corrigido primeiro, com testes de isolamento por usuário.

### ALTO — arquivo .env versionado
O arquivo `.env` está presente no Git. Na versão atual, foram encontrados somente nomes de variáveis Supabase de projeto/URL e publishable key; os valores não foram reproduzidos neste relatório. Não foi identificado nome de variável tipicamente secreta no arquivo atual analisado. Ainda assim, o arquivo não deve permanecer versionado. É necessário remover o arquivo do controle de versão em branch de migração, adicionar padrões adequados ao `.gitignore` e verificar histórico completo antes de concluir que nunca houve segredo exposto. Rotação só é indicada se a inspeção do histórico/contas identificar credencial sensível.

### ALTO — uso de cliente service role
`src/integrations/supabase/client.server.ts` usa service role, que ignora RLS. Cada operação administrativa deve validar autenticação, propriedade do registro e autorização antes de consultar ou alterar dados. A revisão completa de todas as políticas RLS e de todas as chamadas administrativas ainda está pendente.

### MÉDIO — CORS amplo em endpoints de cron
Rotas em `src/routes/api/public/` incluem CORS com origem `*`. Algumas rotas validam `CRON_SECRET`; isso não substitui a revisão de CORS, métodos, autenticação, rate limiting e idempotência. Manter cron fechado por segredo forte e restringir origens quando aplicável.

### Outros pontos
- `src/lib/meta-oauth.functions.ts` fixa a origem OAuth em `https://insta-planner-ai.lovable.app`; precisa de configuração por ambiente e atualização dos redirect URIs no Meta Developer.
- LinkedIn usa Connector Gateway Lovable; migrar de workspace pode exigir reconexão/credenciais novas.
- Google Business depende de `MAKE_GBP_WEBHOOK_URL`; validar endpoint e credenciais Make no novo ambiente.
- Não há integração Cloudflare Workers AI identificada na árvore analisada.

## 4. Segurança da automação

As rotas `gerar-proximo` e `publicar-agendados` chamam `requireCronSecret`. O arquivo `posts-agendados` também contém validação de segredo/HMAC. A geração usa chave de idempotência por operação/slot e o projeto documenta execução periódica a cada cinco minutos. Antes de ativar no ambiente novo, confirmar a configuração real do cron, frequência, limites diários, concorrência e que somente uma rotina de publicação esteja ativa.

Conteúdo de saúde deve continuar em aprovação humana. Não ativar cron de publicação ou geração automática no ambiente novo até a confirmação explícita do proprietário.

## 5. Plano de execução recomendado

1. Preservar `main` intacta e manter toda mudança nesta branch de migração.
2. Remover `.env` do versionamento na branch e corrigir `.gitignore`; auditar histórico Git para credenciais.
3. Corrigir autenticação: remover usuário temporário, rejeitar token ausente/inválido, aplicar middleware em todas as funções que leem/escrevem dados e validar ownership antes de usar service role.
4. Fazer inventário e revisão de RLS, tabelas, buckets privados, triggers, cron e secrets.
5. Parametrizar domínio/redirect URI por ambiente e preparar reconexão Meta, LinkedIn e Make.
6. Implementar controle de orçamento/contagem server-side e cache/idempotência do Gemini; consultar cotas reais no AI Studio.
7. Implementar adaptador Cloudflare Workers AI no servidor, registrar consumo real por resposta, limitar geração antes de chamar provedor, armazenar a imagem no bucket existente e validar vínculo post/slide.
8. Importar o código para workspace Lovable autorizado (ou hospedagem independente) como ambiente de teste; reconectar serviços separadamente. Não migrar dados de produção sem backup e autorização.
9. Rodar build, testes, testes de segurança e testes integrados com contas de sandbox; testar post e carrossel sem publicação externa.
10. Só depois de aprovação, planejar cutover, desligamento controlado de cron antigo e rollback.

## 6. Verificação de custos — documentação oficial consultada

- Google lista `gemini-3.1-flash-lite` com faixa gratuita para entrada e saída de tokens, mas cotas variam por projeto/conta e precisam ser conferidas no AI Studio. No nível gratuito, o uso pode estar sujeito aos termos de uso de dados do Google; não enviar dados pessoais/sensíveis de pacientes sem avaliação contratual e de privacidade.
- Cloudflare Workers AI informa franquia de 10.000 neurons/dia no plano Free, com reset às 00:00 UTC. No Workers Paid, excedente é cobrado a US$ 0,011 por 1.000 neurons. Para evitar cobrança, o projeto deve parar antes do limite interno configurado e não habilitar plano pago.
- A documentação pública da Lovable descreve importação de ZIP/código, mas dados, usuários, senhas e sessões não são transferidos automaticamente. Segredos devem ficar fora do ZIP. A elegibilidade de importação gratuita é por conta/workspace e precisa ser conferida na interface; não presumir créditos adicionais.

## 7. Estado real desta auditoria

- Leitura estática de árvore, instruções do projeto, roadmap, arquivos de auditoria, package.json, middleware, geradores de IA, cron, OAuth, publicação e integrações principais: realizada.
- Build/testes nesta execução: não realizados.
- Gemini real, Cloudflare real, Meta, LinkedIn, Make e armazenamento em novo ambiente: não testados.
- Backup de banco/storage: não realizado; exige acesso e autorização ao projeto Supabase.
- Remix/importação Lovable: não realizado; exige ação na conta/workspace do cliente.
- Deploy, alteração em produção ou publicação externa: não realizados.

## 8. Dependências do proprietário

São necessários acesso ao workspace Lovable de destino, projeto Supabase de destino e origem (para backup/migração), Google AI Studio, Cloudflare, Meta Developer, LinkedIn/Connector e Make. Credenciais devem ser cadastradas diretamente nos respectivos painéis de secrets, nunca enviadas no chat ou commit.

**Critério de conclusão:** nenhum recurso será declarado migrado ou testado sem evidência verificável do ambiente de teste. A branch original `main` e a aplicação publicada permanecem sem alterações.
