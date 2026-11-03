# Roadmap
- [ ] Remover somente a logo do perfil Clínica Escola em todos os fluxos e validar isolamento, prévias e exportações sem publicação.
- [x] LinkedIn opcional: removido botão de OAuth/login do perfil, status assíncrono e bloqueios de envio/agendamento; painel/navegação sem OAuth verificados em desktop/mobile, 17 testes passaram, build OK; administração autenticada não verificável porque não há conta correspondente ao solicitante; conexões e dados intactos, sem deploy.
- [x] Auditar e atualizar modelos verificados; defaults econômicos, validação compartilhada, Claude rotulado não conectado, sem chave no navegador nem simulação silenciosa. Catálogo autenticado confirmado; 151 testes passaram, suíte vazia antiga falhou; build OK; lint com 81 erros legados. Sem geração real, publicação ou deploy.
- [x] Limpar registros e histórico do Chico no app — 38 posts removidos, zero restantes; outras contas e configurações verificadas intactas. Cache do navegador do usuário não acessível.
- [x] Validar semana real de 56 slots no Chico e entregar auditoria por slot, sem publicação externa — execução reprovou: 7 completos e 49 falhas.
- [x] Preview real com erros claros
- [x] Dedup semântico (assunto-raiz) + reescrita limitada
- [x] Trocar "ambas as redes" por "todas as redes"
