# Chico: auditoria da geração contextual

## Causa confirmada

- `src/lib/ai-gateway.server.ts` desviava falhas de crédito, limite, recusa e resposta vazia para outros provedores e, finalmente, um desenho procedural. Esse desenho produzia somente fundo/gradiente; o assunto do prompt não era representado.
- `src/lib/ai-post.functions.ts` misturava o texto do slide com cenas pré-definidas por tema, sugestões aleatórias de exames e instruções contraditórias do Chico. Também truncava textos individuais e repetia solicitações em duas camadas.
- O corpo HTTP do Gemini já usava o campo correto (`messages[0].content`); o OpenAI usava `prompt`. A correção mantém esses campos, endpoints e modelos, elimina substituições e testa o corpo HTTP.
- A exibição usava cache assinado baseado somente na validade temporal. Agora também compara o objeto original de cada post/slide, descartando cache de outro arquivo.

## Arquivos de implementação

- `src/lib/contextual-image.ts`: extração completa de slides finalizados, brief exclusivo com tema/título/texto/objetivo/público/contexto, proibições explícitas e validação dos vínculos.
- `src/lib/ai-post.functions.ts`: Chico não usa mais cenas genéricas nem o antigo prompt contraditório; gera o texto primeiro, cria o ID antes das imagens, passa o brief integral, registra hash/resumo não sensível, aplica logo original e valida URLs/ordem antes de inserir o post.
- `src/lib/ai-gateway.server.ts`: nenhuma troca silenciosa de modelo/provedor ou imagem procedural; resposta vazia/recusa vira erro; registra apenas a origem da resposta, nunca a URL assinada ou chaves.
- `src/lib/storage-url.ts`: cache só é aceito quando aponta para o mesmo objeto original e a mesma posição no carrossel.
- `src/components/PlannerSimplificado.tsx`: erro visível, nova tentativa explícita e remoção de prévia anterior quando uma nova geração começa. A nova tentativa usa a seleção atual, não uma seleção antiga capturada.
- `AGENTS.md`, `roadmap.md`: regras estruturais e acompanhamento.
- Metadados das páginas existentes completados conforme as regras obrigatórias do projeto; não alteram geração/publicação.

## Testes executados

`bunx vitest run src/lib/contextual-image.test.ts src/lib/ai-gateway-image.test.ts src/lib/storage-url.test.ts src/lib/post-review.test.ts src/lib/week-plan.test.ts`

**Resultado: 22 testes aprovados em 5 arquivos.**

- Brief integral e diferente por slide chega ao gerador.
- Texto longo não é truncado; slide ausente não é preenchido com narrativa substituta.
- Corpo HTTP preserva modelo e campo de prompt Gemini/OpenAI.
- HTTP 400/402/403/404/429/503 e resposta vazia não acionam outro provedor nem imagem procedural.
- Falha/vazio não alcança salvamento.
- URL repetida e vínculo de outro post/slide são bloqueados.
- Cache de outro post/slide é rejeitado.
- Testes anteriores de revisão interna e semana preservados.

Lint dos quatro arquivos novos de lógica/testes: **aprovado**.
Lint dos quatro arquivos existentes alterados: **651 erros**, principalmente formatação existente e `any`; não foi feito refactor amplo fora do pedido. O lint completo desses arquivos não está aprovado.
Compilação automática: **build OK**, último registro conferido `2026-10-25T16:23:00Z`. Não executei build/typecheck manual: a plataforma executa a verificação automaticamente.

## Verificação real

- Navegador abriu o Planner Simplificado Chico e tentou gerar um post com o modelo local: mostrou erro explícito e botão de tentar novamente; nenhum gradiente foi apresentado como sucesso.
- Selecionado o Gemini Nano Banana 2 original, a nova tentativa retornou uma imagem que representava ATM/disco articular/mandíbula, exibida na prévia com a logo aplicada. Os logs confirmaram envio, resposta inline, upload fresco e inserção do mesmo ID.
- Gerado um carrossel real com cinco slides sobre deslocamento do disco articular da ATM: cinco hashes de brief diferentes, cinco respostas do mesmo modelo, cinco objetos únicos associados aos índices 0–4 e um único post salvo. O navegador encontrou as cinco imagens na prévia.
- Nenhum post foi publicado/agendado por esses testes; os exemplos foram salvos como pendentes.

## Limites explícitos

- **Não foi feita verificação semântica automática por visão.** Nenhuma chamada de visão foi adicionada; logs indicam `semanticVerification: not-performed`. Não há garantia automática de precisão anatômica/ortográfica do conteúdo produzido pelo modelo.
- A leitura autenticada posterior pela listagem não pôde ser validada: a prévia retornou zero posts e não há conta de autenticação correspondente ao solicitante para obter sessão de teste. A geração/inserção e a prévia imediata foram verificadas, não a leitura autenticada após recarregar.
- A tentativa de baixar diretamente um arquivo público retornou HTTP 400; a leitura pública desses exemplos não foi confirmada nem a configuração do armazenamento alterada. A prévia usou a URL assinada do mesmo arquivo recém-gerado.
- O modelo Gemini existente está disponível no catálogo consultado, embora marcado como deprecated; foi preservado conforme solicitado.
- **Sem deploy.**