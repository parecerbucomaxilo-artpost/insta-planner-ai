# CTBMF e logos da Liga

## Exclusão das listas de sete dias
- Posts7Dias.tsx oferece “Apagar todas as semanas”, com confirmação. Lê somente planos posts7dias, seleciona IDs por slot e exclui pelo cliente autenticado/RLS, verifica a exclusão antes de limpar planos. IDs já ausentes permitem limpar prévias antigas; erros preservam lista para retry. Não remove mídias nem publicações nas redes.
- Novos week-delete.ts e week-delete.test.ts. 11 testes passaram; botão e limpeza de plano local sem IDs reais verificados no navegador; compilação automática OK. O navegador do solicitante contém a lista do print e exige seu clique; nenhum dos três posts reais foi removido aqui.

- Botão “Gerar tema — CTBMF” acima de Hospitalar, reutilizando a geração existente e sua confirmação de créditos.
- Logos manualmente selecionados na Liga: tamanho de referência 18% em vez do limite anterior de 7%, opacidade plena em vez de 42%. Múltiplos logos mantêm proporções e limite de largura; demais planners e arquivos originais preservados. Não ativa logos automaticamente.
- Arquivos: PlannerSimplificado.tsx, post-logo.ts, post-logo.test.ts, logo-overlay.server.ts, ai-post.functions.ts; memória e roadmap.
- Verificado em sessão real: botão habilitado acima de Hospitalar em 1280 e 390 px; 12 testes passaram; compilação automática OK. Sem gerar IA, publicar posts ou publicar app. Custo de geração/envio zero; custo do trabalho Lovable não consultado.

# Publicação após aprovação

- Aprovar continua sendo revisão interna. Publicar agora envia aprovados; Agendado só envia quando chega a data/hora escolhida.
- Guardas em publication-policy.ts no publicador Instagram; approvePost exige aprovação antes de publicar/agendar. LinkedIn preservado para não interromper envios multicanal existentes. 29 testes passaram, sem envio real nesta alteração.
- Programação existente verificada: trabalho publicar-posts-agendados ativo a cada cinco minutos; não foi criada nova rotina. Esse intervalo pode atrasar o envio em até cinco minutos, além do processamento da plataforma.
- Não publicar o aplicativo nesta alteração; alterações de código precisam de publicação do app para chegar ao site publicado. Nenhuma credencial ou conexão modificada.

# Linha editorial CTBMF — Planner Chico

- Criadas 36 pautas originais em 12 eixos com conteúdo educativo e direção visual; quatro modelos por pauta: carrossel, post único, roteiro de reel (texto, não vídeo) e stories. Biblioteca exclusiva do Chico com filtros, prévia, copiar e usar como tema, sem gerar/salvar posts.
- Catálogo do Estúdio, seleção de tema individual, planejamento semanal e reposição passam a reconhecer o catálogo exclusivo Chico. Outros planners, modo hospitalar e temas diversos preservados; nenhuma execução da programação foi feita.
- Assinatura: Francisco Menezes — CROSP 53318. Diretrizes exclusivas do Chico/IA Avançada atualizadas, removidas instruções comerciais conflitantes; logos seguem opt-in. Modelos locais são conteúdo editorial revisável, não simulam resposta de IA.
- Novos: src/lib/chico-editorial.ts, chico-editorial.test.ts, src/components/ChicoEditorial.tsx. Alterados: PlannerSimplificado.tsx, Posts7Dias.tsx, free-studio/TextStudio.tsx, free-studio/GeradorLocal.tsx, lib/free-studio.ts, studio-profiles.ts, ai-post.functions.ts, advanced-ai.functions.ts; memória, plano e roadmap.
- Verificado: 44 testes passaram (cobertura dos eixos, quatro formatos, assinatura única/exata, paleta e outros catálogos preservados; regressões de temas/semana). Biblioteca desktop 1280 e mobile 390 px: filtro, seleção, quatro formatos, uso do tema e assinatura; sem erros de navegador. Compilação automática OK.
- Sem IA/imagem/Meta real, alterações de banco, posts salvos, agendamento, publicação ou deploy. Custo de geração/envio: zero; custo do trabalho Lovable não consultado. Conteúdo exige revisão profissional antes de publicação; não foram inventadas fontes ou estatísticas.

# Logos somente mediante escolha manual — Post Planner Pro

- Novos posts sem seleção explícita não recebem logo em nenhum planner; seleção vazia não herda logo legado. Seletores iniciam em “nenhuma”.
- Estúdio de Imagem, gerador local e IA Avançada iniciam desativados; opções manuais preservadas. Novas chaves de consentimento não herdam o antigo padrão automático do editor.
- Arquivos alterados: src/components/PlannerSimplificado.tsx, PlannerAgendamentoTratamento.tsx, free-studio/ImageStudio.tsx, free-studio/GeradorLocal.tsx, advanced-ai/IAAvancada.tsx; src/lib/ai-post.functions.ts, contextual-image.ts, strategy-prompt.ts, brand-book.ts. Novos: post-logo.ts e post-logo.test.ts.
- Prompts não exigem logo, espaço reservado ou texto literal “LOGO”. Paletas, assinaturas, catálogo, assets e publicações existentes preservados. Prévia explicitamente intitulada “com logo” permanece ação manual, sem gravar alteração em posts.
- 35 testes mockados passaram. Editor real com identidade simulada: logo começa desativado, habilitar altera canvas, desabilitar restaura pixels; quatro perfis em 1280 e 390 px, sem erros. Compilação automática OK. Hashes de todos os assets de logo idênticos antes/depois.
- Sem chamadas de geração de IA, banco, publicação, agendamento ou deploy. Custo de geração/envio: zero; custo do trabalho Lovable não consultado. Pendências anteriores abaixo não fazem parte desta solicitação.

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
