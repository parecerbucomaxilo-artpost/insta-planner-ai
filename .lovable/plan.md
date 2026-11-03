# OpenAI / ChatGPT com chave própria — IA Avançada

## Feito
- Três provedores no seletor de texto e de imagem: OpenAI (chave própria), OpenAI via créditos Lovable (atual) e Google Gemini.
- Chave própria: segredo OPENAI_API_KEY lido só no servidor; status informa apenas se existe.
- Endpoints oficiais: GET /v1/models (confirma modelo liberado), POST /v1/chat/completions, POST /v1/images/generations.
- Modelos: mesmos nomes oficiais já verificados no catálogo (gpt-6-luna, gpt-6.1-sol, gpt-image-2.5-flare, gpt-image-2.5-sunburst); bloqueados se a chave não os listar.
- CRIAR COM OPENAI gera conceito, texto da arte, legenda, CTA e hashtags; imagem só com clique e confirmação.
- Sem chave: aviso com instrução; demais provedores seguem funcionando.

## Pendente
- Adicionar o segredo OPENAI_API_KEY (usuário).
- Planners/composer mantêm seus seletores atuais; a chave própria está só na IA Avançada.
