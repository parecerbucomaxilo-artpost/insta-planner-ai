# Contexto único por material — Estúdio

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
