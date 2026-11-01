# Ferramentas de IA — auditoria e proposta de expansão (Post Planner Pro 05)

Somente auditoria e plano. Nenhum código foi alterado. Nenhuma chave foi lida, pedida ou exibida.

## 1. O que existe hoje

| Item | Situação atual |
|---|---|
| Gateway | Lovable AI Gateway, com o segredo de servidor `LOVABLE_API_KEY` (lido em `src/lib/ai-gateway.server.ts`) |
| Catálogo e validação | `src/lib/ai-models.ts` concentra as listas de modelos, os padrões, a validação de IDs antigos e o roteamento por provedor |
| Texto | `generateTextAI` (`/v1/chat/completions`), usado por `generateSinglePost`, `generateCaptionOnly`, `generateWeekThemes`/`getWeekTopics`, `reformularTema` e o cron `gerar-proximo` |
| Imagem | `generateImageBase64` (`/v1/images/generations`; formato nativo para o Gemini Flash Lite Image), usado por `contextual-image.ts`, `ai-post.functions.ts` e `backfill-images.functions.ts` |
| Modelos de texto | `openai/gpt-6-luna` (padrão), `openai/gpt-6.1-sol`, `google/gemini-3.1-flash-lite`, `google/gemini-3.8-flash`, `google/gemini-4-argon` |
| Modelos de imagem | `google/gemini-3.1-flash-lite-image` (padrão), `google/gemini-3-pro-image`, `openai/gpt-image-2.5-flare`, `openai/gpt-image-2.5-sunburst` |
| Claude | Não conectado. `AnthropicKeySettings.tsx` só informa isso |
| Edição de imagem | Não existe. Só há geração do zero mais a sobreposição da logo (`logo-overlay.server.ts`) |
| Seleção na tela | Escolha de texto e imagem em `PostComposer`, `PlannerSimplificado`, `PlannerAgendamentoTratamento` e `Posts7Dias`. Não há escolha por tarefa |
| Falhas | Regra atual: nunca trocar de provedor quando há erro. O erro aparece na tela, e textos ou imagens simulados não são usados |
| Chaves no navegador | Nenhuma chave de IA fica no navegador |

## 2. O que já funciona pelo gateway (sem chave própria)

Estes modelos aparecem no catálogo do gateway deste workspace. Os IDs serão conferidos novamente com `GET /v1/models` antes da implementação.

- **Texto OpenAI:** `openai/gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-6.1-sol` e `gpt-5.6-*`.
- **Texto Gemini:** `google/gemini-4-argon`, `gemini-3.8-flash` e `gemini-3.1-flash-lite`.
- **Texto Claude:** `anthropic/claude-sonnet-5`, `claude-haiku-4-5`, `claude-opus-5` e `claude-opus-5-5`.
  - Exigem o endpoint próprio `/v1/messages`. O código atual só fala `/chat/completions`, por isso o Claude precisa de um adaptador novo.
  - Os modelos Anthropic usam retenção de dados pelo provedor. Pela política deste workspace, são permitidos apenas nesse endpoint.
- **Imagem:**
  - `openai/gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`, que também fazem edição a partir de uma imagem enviada.
  - `google/gemini-3-pro-image` e `gemini-3.1-flash-lite-image`.
  - Os apelidos `lovable/image-fast`, `image-standard`, `image-premium` e `image-edit`.
- **Custo:** sai dos créditos do workspace, pelo preço de tabela do provedor nos planos mensais. Há registro de cada chamada no painel de IA, limites de gasto e nenhuma conta extra para gerenciar.

## 3. O que exige chave ou conta própria

| Ferramenta | Como conectar | Exige do proprietário | Prós | Contras |
|---|---|---|---|---|
| FLUX / modelos do Replicate | Conector Replicate (credencial gerenciada no workspace) | Conta Replicate com saldo e o conector ligado ao projeto | Modelos especializados e ajustados | Links de imagem expiram em cerca de 1 hora (é preciso copiar para o armazenamento); cobrança separada; respostas lentas (polling) |
| Stability AI | Segredo `STABILITY_API_KEY` | Conta e chave da Stability | Controle fino de estilo e edição por máscara | Sem conector pronto; mais um fornecedor e mais uma cobrança |
| Google Imagen direto | Segredo `GOOGLE_API_KEY` (AI Studio/Vertex) | Chave Google com faturamento ativo | Acesso ao Imagen fora do gateway | Duplica o Gemini já disponível no gateway; perde os registros do painel de IA |
| OpenAI direto | Segredo `OPENAI_API_KEY` | Chave OpenAI com faturamento | Sem vantagem técnica | Os mesmos modelos já estão no gateway; perde o painel de custos |

Recomendação: começar só pelo gateway. Adicionar Replicate ou Stability apenas se você quiser um modelo específico que o gateway não oferece.

## 4. Expansão modular proposta

```text
Tela (escolha por tarefa) -> ai-models.ts (catálogo + perfis por tarefa)
        -> ai-router.server.ts (escolhe o adaptador)
             -> adaptador gateway-chat     (OpenAI / Gemini)
             -> adaptador gateway-messages (Claude)
             -> adaptador gateway-images   (geração + edição)
             -> adaptador replicate / stability (opcional, com chave)
```

1. **Tarefas com modelo próprio:** legenda, revisão de texto, temas da semana, reformulação/dedup, cena visual, imagem e edição de imagem. Cada tarefa tem padrão e escolha manual próprios e salvos.
2. **Adaptador Claude:** usar `/v1/messages` com streaming no servidor e tratar recusas sem repetir a chamada.
3. **Edição de imagem:** criar uma ação "Ajustar imagem" na prévia que envia a imagem salva com uma instrução. A logo continua sendo aplicada só pelo sistema.
4. **Fallback opcional (decisão sua, veja o item 6):**
   - Desligado por padrão.
   - Quando ligado, você define uma cadeia ordenada por tarefa (ex.: Gemini Flash Lite Image → GPT Image 2.5 Flare).
   - Só entra para erros temporários (429 e 5xx), nunca para recusas, bloqueios de acesso, falta de crédito (402) ou erros de configuração.
   - O post registra qual modelo realmente gerou o conteúdo, e a prévia mostra isso.
5. **Proteção de custo:** a semana completa continua em sequência, com no máximo uma tentativa a mais por provedor. Erros 402/403 pausam o lote inteiro.

## 5. Arquivos que mudariam

- `src/lib/ai-models.ts`: catálogo, tarefas, cadeias de fallback e validação.
- Novos: `src/lib/ai-router.server.ts` e os adaptadores `src/lib/ai-adapters/gateway-chat.server.ts`, `gateway-messages.server.ts`, `gateway-images.server.ts` e, opcionalmente, `replicate.server.ts` / `stability.server.ts`.
- `src/lib/ai-gateway.server.ts`: passa a delegar ao roteador.
- `src/lib/ai-post.functions.ts`, `contextual-image.ts` e `backfill-images.functions.ts`: passam a informar a tarefa.
- Telas: `PostComposer`, `PlannerSimplificado`, `PlannerAgendamentoTratamento`, `Posts7Dias` e uma nova aba "IA por tarefa" em Configurações. `AnthropicKeySettings.tsx` muda para mostrar o Claude disponível pelo gateway.
- `PostReviewActions.tsx`: ação "Ajustar imagem" e indicação do modelo usado.
- Banco: uma coluna opcional para o modelo usado no post, além das preferências por tarefa no perfil. É uma migração pequena, sem apagar dados.
- Testes: roteamento por tarefa, adaptador Claude, regras de fallback (quando aciona e quando nunca aciona), edição de imagem e preservação de escolhas antigas.
- `AGENTS.md` e a memória sobre a política de modelos.

## 6. Decisões que dependem de você

1. **Fallback:** hoje a regra registrada é "nunca trocar de provedor em erro". Ligar o fallback muda essa regra. Proponho mantê-lo desligado por padrão, como escolha explícita por tarefa.
2. **Claude:** liberar no app pelo gateway, sabendo que esses modelos retêm dados no provedor.
3. **Replicate/Stability:** adicionar agora ou só quando houver um modelo específico desejado.

## 7. Custos e riscos

- **Imagens:** são o maior gasto (uma semana tem 56 posts, e cada carrossel gera 5 imagens). Modelos "pro" e "sunburst" custam bem mais que os econômicos.
- **Fallback:** pode dobrar o gasto em dias de instabilidade, por isso o limite de uma tentativa a mais e a pausa quando falta crédito.
- **Provedores externos:** acrescentam cobrança separada, outra política de dados e links temporários.
- **Claude:** mais caro que os modelos Luna e Flash Lite; recomendado só para revisão de texto.

## 8. O que o proprietário precisa configurar

- **Só gateway:** nada além do que já existe (`LOVABLE_API_KEY` é gerenciada).
- **Replicate:** criar a conexão Replicate no workspace, com saldo, e permitir que eu a ligue ao projeto.
- **Stability ou Google direto:** adicionar a chave em Configurações do projeto → Secrets. Eu peço pelo formulário seguro; nunca no chat.
- **Limite de gasto de IA:** ajustar nas configurações do workspace, se desejar.
