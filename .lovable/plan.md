# Instagram persistente — Post Planner Pro

## Ajustes desta solicitação
- Reutilizar token storage de perfil_usuario, com proteção de colunas sensíveis e metadados de validade/fluxo/status.
- Corrigir busca global e reassociação de proprietário; resolver destinos estritamente por usuário + conta.
- Remover exclusão automática de token/ID em erro de publicação; somente erro comprovado de autorização marca requer reconexão.
- Restaurar status do servidor em navegação/recarga/foco; falha de carregamento não equivale a desconexão.
- OAuth salva conta separada sem substituir outra conta; Instagram Login registra expires_in e permite refresh do token longo válido. Facebook Page token não usa refresh Instagram.
- Testes mockados, sem Meta/IA/publicação. Compilação e typecheck pelo ambiente, sem execução manual conforme regras do projeto.
- Causa confirmada: regex ampla apagava token/ID; busca global podia reatribuir user_id; status baseado só em presença de token, UI sem sincronização; expires_in ignorado. SELECT * de perfil era armazenado em localStorage e expunha tokens.
- Validação: 284 testes passaram em 40 arquivos, incluindo 16 testes de ciclo Instagram. Suíte completa também foi executada: o único erro é o arquivo legado vazio planner-clinica-escola.test.tsx; repetição excluindo somente esse arquivo passou.
- Interface real SocialConnections com leituras/cache de conta simulados, 1280 × 1800 e 390 × 844: conta preservada após desmontar/remontar e trocar perfil; autorização revogada mostra botão Reconectar; sem erros de navegador. Recarga/reabertura são cobertas pela restauração de dados duráveis nos testes unitários; conta real não foi exercitada.
- Build automático OK (último registro 15:09:31 UTC). Typecheck separado não executado por regra do ambiente; não alegado como validado independentemente.
- Verificação de privilégios no banco (sem ler tokens): authenticated não pode SELECT/UPDATE token, SELECT lifecycle ou executar save_instagram_connection; campos de perfil continuam legíveis e serviço pode salvar. RLS existente preservada.
- Novos arquivos: src/lib/instagram-connection.ts, instagram-connection.server.ts, instagram-status.functions.ts, instagram-connection.test.ts; src/hooks/use-instagram-status.ts; tests/browser/instagram-connection.py; drizzle/migrations/0002_instagram_connection_lifecycle.sql e metadados gerados.
- Alterados: src/lib/publication-destination.functions.ts, meta-oauth.functions.ts, social/instagram-publish.server.ts, social/instagram-publish.functions.ts; callbacks meta-oauth.callback.ts e instagram-oauth.callback.ts; SocialConnections.tsx, PlannerSimplificado.tsx, ProfileSettings.tsx, routes/_authenticated/index.tsx; roadmap.md, memória e este plano. Tipos do banco regenerados automaticamente. AGENTS.md não alterado: orçamento de tamanho impediu salvar regra nova.
- Limites: renovação Instagram Login apenas com token longo válido, idade >=24h e expires_in conhecido; janela preventiva de 7 dias. Tokens legados sem prazo são verificados, não recebem prazo inventado. Facebook Page não usa endpoint Instagram refresh. Verificação de revogação até 1h de cache; publicação sempre respeita erro real. Refresh ocorre ao carregar/verificar a conta ou publicar; não foi criado cron, portanto longas ausências podem exigir reconexão. Não existe conexão permanente contra revogação/expiração Meta.
- OAuth state agora tem validade de 30 minutos; links antigos precisam ser preparados novamente. Callback salva atomicamente por proprietário/conta sem sobrescrever outra conta. Nonce não tem registro de consumo: não alegar prevenção de replay além da validade e código OAuth de uso único do provedor.
- Fontes oficiais: https://developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token ; https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login ; https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived .
- Custo de chamadas Meta/IA/publicação nos testes: zero. Nenhum segredo alterado, nenhuma publicação/deploy. Custo de trabalho Lovable não foi consultado e não pode ser declarado zero.
- Pendências antigas fora desta solicitação: autorização dos planners/automação aguarda decisão do plano anterior; salvar/ler rascunho/agendamento real aguarda sessão correspondente ao solicitante. Não executar como parte desta alteração.

---
# Contexto único por material — Estúdio (registro anterior)

## Comportamento implementado
- Tema e Objetivo escolhidos e alterados somente no contexto central, com resumo sempre visível.
- Sugestões, texto local, IA Avançada, revisões, legendas e imagens recebem os mesmos valores. Objetivo vazio não ganha um padrão inventado.
- Alterar contexto não limpa texto, resultado, pacote, imagem ou ajustes manuais; apenas próximas gerações recebem a mudança.
- Rascunho local em sessionStorage, isolado por usuário + perfil + ID do material; restaura ao trocar perfil/ferramenta e navegar de volta. Dados não vão para banco automaticamente.
- Novo material começa vazio; guarda rascunho anterior localmente, mas não o reutiliza nem anexa mídia de outro material. Não foi adicionada lista de recuperação de materiais antigos.
- Dashboard: somente dados reais do mesmo usuário/perfil, apenas campos vazios não escolhidos. Cadastro atual não possui tema/objetivo, portanto permanecem vazios.

## Causa
EscolhaTema, TextStudio, GeradorLocal e IAAvancada tinham objetivos independentes. Troca de tema apagava resultados locais/IA; troca de perfil/modo desmontava os editores. Mídia não distinguia materiais.

## Arquivos
- Novos: src/lib/studio-context.ts, src/lib/studio-context.test.ts, src/components/free-studio/StudioMaterial.tsx.
- Alterados: EstudioGratuito.tsx, EscolhaTema.tsx, TextStudio.tsx, GeradorLocal.tsx, ImageStudio.tsx, IAAvancada.tsx, src/lib/studio-media.ts, AGENTS.md e roadmap.md.
- Teste de interface: tests/browser/studio-context.py.

## Validação e limites
- 60 testes relevantes passaram (incluindo 6 novos): prompts compartilham contexto, persistência, novo material, isolamento, edições e Dashboard.
- Componentes reais verificados em 1280 px e 390 px com identidade e leituras simuladas: escolha central, troca de abas/perfis, preservação de legenda/texto de arte e novo material. Nenhum erro de navegador.
- Compilação automática: build OK. Typecheck separado não executado: o ambiente determina validação automática, sem execução manual de build/typecheck.
- Sessão real do solicitante não usada; geração e publicação não executadas nem alegadas.
- Armazenamento limitado à sessão do navegador; se a quota estiver cheia, mantém o rascunho em memória, mas restauração após recarga pode não ser possível. Imagem local do editor fica no rascunho local; anexo para publicação continua exigindo upload real da arte final.
- Sem banco/auth/RLS/dependências/segredos alterados. Sem deploy. Nenhuma chamada de geração de IA/Meta foi feita neste trabalho: custo de geração/publicação dos testes = zero.

## Pendência anterior preservada
- OPENAI_API_KEY depende de configuração pelo usuário para a opção com chave própria; não foi verificada nem alterada neste trabalho.
