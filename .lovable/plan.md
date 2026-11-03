# Corrigir a autorização dos posts dos planners

## Problema confirmado
A consulta real, com sessão autenticada, encontrou um post compartilhado pendente, mas a consulta de propriedade usada por `approvePost` não encontrou esse mesmo post. A geração salva sob o identificador compartilhado, enquanto a publicação exige o identificador do usuário.

O ajuste não pode simplesmente liberar posts compartilhados para qualquer usuário: isso permitiria modificar/publicar conteúdo de outras contas. Além disso, a automação atual chama o mesmo gerador sem sessão de usuário e o middleware gerado aceita ausência de token usando a identidade temporária.

## Mudanças propostas
1. Separar a geração feita pelo usuário da geração feita pela automação, mantendo uma única implementação interna e os modelos, prompts, deduplicação e imagens atuais.
2. Nas ações do usuário, validar a sessão e atribuir os novos posts exclusivamente ao usuário autenticado. Rejeitar tokens ausentes/inválidos, sem editar arquivos de autenticação gerados automaticamente.
3. Manter a checagem de propriedade para posts individuais. Para posts antigos compartilhados, permitir operações somente a administradores comprovados pelas permissões existentes; nunca transferir propriedade automaticamente.
4. Para destinos Instagram compartilhados, autorizar acesso somente após essa verificação administrativa, exigir correspondência exata de conta e impedir busca em perfis de outros usuários. Preservar conexões e credenciais.
5. Manter a automação protegida pelo segredo já existente, com identidade interna explícita e escopo de conta definido, sem aceitar identificador de proprietário fornecido pelo navegador.
6. Conferir os leitores, revisão, agendamento e histórico dos planners para que posts novos continuem visíveis ao proprietário, sem perder acesso administrativo aos antigos. Aprovação interna continuará sem publicar.

## Validação
- Testar com mocks: propriedade autenticada, rejeição de token inválido/ausente, rejeição de outro proprietário, administrador de posts compartilhados, destino incorreto, separação da automação e payloads existentes.
- Reproduzir na sessão autorizada o salvamento e a leitura de um rascunho de teste, sem geração paga, agendamento ativo ou envio externo; conferir proprietário persistido.
- Executar testes relacionados e verificar a compilação automática. Não publicar nem fazer deploy.

## Limites
Não migrar posts compartilhados para um usuário presumido, não ampliar políticas do banco e não modificar credenciais ou conexões. Se a identidade da automação não puder ser estabelecida com segurança, manter essa parte bloqueada e indicar o dado necessário.

## Detalhes técnicos
Reutilizar `posts`, `perfil_usuario`, `has_role` e os publicadores existentes. Introduzir validação estrita de sessão em módulo próprio, pois `src/integrations/supabase/auth-middleware.ts` é gerado e atualmente contém fallback temporário. Separar o executor interno do RPC usado pelo navegador e do caminho protegido de `gerar-proximo`. Cobrir `generateSinglePost`, `approvePost` e seus leitores/chamadores; não usar o cliente privilegiado para decidir permissões.

## Correção já realizada nesta revisão
A descrição visual opcional foi removida: as imagens recebem a legenda e os textos finais reais dos slides, evitando falhas de JSON e chamadas auxiliares, sem simulação nem troca de provedor. Os erros obrigatórios de geração permanecem explícitos.
## Correção: publicação do Estúdio sem imagem (03/11/2026)
- Causa: o Estúdio de Texto enviava sempre `imagens: []`; a arte escolhida no Estúdio de Imagens ficava só naquela aba. O diálogo abria "pronto" com 0 imagens e o Instagram bloqueava no fim.
- Correção: `src/lib/studio-media.ts` guarda em memória a arte selecionada (por perfil, sem cruzar perfis) e o Estúdio de Texto a anexa; `bloqueioAntesDeAbrir` impede abrir Publicar/Agendar sem mídia exigida e orienta; `origemMidia` reaproveita URLs já salvas no armazenamento do app e envia uma vez data/blob; retry reusa o post salvo.
- Testes: `src/lib/studio-media.test.ts` (sem geração nem publicação real).
