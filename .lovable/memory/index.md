# Project Memory

## Core
Toda geração de imagem segue o estilo Mayo/Cleveland/Lancet do Prof. Francisco Menezes (CTBMF + Odontologia Hospitalar) com FUNDO AZUL NAVY LUMINOSO #14366b (com leve gradiente para ciano #2dd4ff) dominando a imagem — criativos CLAROS e arejados, NUNCA escuros/low-key/preto, NUNCA branco. Paleta restrita às cores da logo: navy luminoso #14366b / ciano #2dd4ff / branco. Vermelho só para dor. Headline curto 3-6 palavras tipo manchete ("DOR NO SISO?"), bold sans-serif, branco ou ciano. Texto longo só na legenda. PT-BR Brasil impecável.
Assinatura oficial: "Prof. Francisco Menezes | CROSP 53318" + subtítulo "Cirurgia e Traumatologia Bucomaxilofacial · Odontologia Hospitalar". Em carrossel: só 1ª e última imagens.
3 níveis de conteúdo: IG Conversão (dor/identificação, stories e feed 09:00), IG Autoridade (caso/ciência traduzida, feed 14:00/18:00/21:00), LinkedIn Científico (Lancet/IJOMS/JOMS + DOI). Cron `gerar-proximo` alterna automaticamente.
Modelo de imagem padrão: google/gemini-3.1-flash-image-preview. Carrosséis padrão = 6 cards; Estilo X = 3 cards 16:9. Todas em paralelo.
Logos oficiais no dashboard, nesta ordem: NSP, Anhanguera Santa Bárbara d'Oeste, Prof. Francisco Menezes/Planner Chico (Σ branco + quadrado ciano), Liga, Clínica Escola. IA nunca desenha logo; sistema aplica overlay real.
CTAs IG/X: "Link na Bio" / "Saiba mais pelo link da bio". CTA LinkedIn: WhatsApp https://wa.me/5511947684004. PROIBIDO: "agende consulta/avaliação", "promoção", "oferta", "desconto", "últimas vagas".

## Memories
- [Estilo visual Dr. Francisco Menezes](mem://design/visual-style-francisco-menezes) — Padrão completo de direção de arte, paleta, composição, formatos, regras de copy
- [Acesso público post-images](mem://constraints/post-images-security.md) — O bucket post-images deve ser público para que APIs externas funcionem.
- [X é estilo, não rede](mem://constraints/x-twitter-style) — Botão X = formato tweet publicado em IG/LinkedIn.
- [Tom de voz e bibliografia](mem://features/tone-and-bibliography) — IG/X linguagem leiga e empática; LinkedIn formal/científico com DOI. Fontes: Lancet, IJOMS, JOMS, OSOMOPOR, BJOMS.
- [Cronograma de postagens](mem://features/schedule-cadence) — Seg-Sáb: IG feed 09:00/14:00/18:00/21:00 (fuso local), stories 8/13/17, LinkedIn 9 e 17:30. Domingo: posts especiais automáticos.
- [Nunca inventar logo](mem://constraints/no-fake-logo) — IA nunca desenha logo e nunca reserva espaço/placeholder; sistema aplica só overlay real sem fundo.
- [Logo Chico obrigatória](mem://constraints/logo-chico-obrigatoria) — Logo oficial do Planner Chico (Σ branco + quadrado ciano sobre navy) obrigatória em 100% dos posts do Planner Simplificado Chico. Nunca usar selo anatômico circular como logo do Prof. Francisco.
- [Estilo e dimensões das imagens](mem://design/image-style-and-dimensions) — Dimensões por rede (IG 4:5, Stories 9:16, LinkedIn/Google/X 16:9/4:3), 5 estilos alternados (foto, ilustração, quadrinhos, infográfico, colagem), pouco texto, representação literal do tema, temas de alta busca.
- [Estilo navy com headline de impacto](mem://design/navy-background-style) — Fundo navy luminoso, headline curto, paleta da logo.
- [Ilustrações com realismo anatômico](mem://design/anatomical-illustration-style) — Estilo Netter / Gray's Anatomy / render 3D médico. Proibido cartoon, flat, infantil.
- [Planner Simplificado — Estudantes](mem://features/planner-simplificado-estudantes) — Aba para alunos de graduação/Liga: cirurgia bucal básica, eventos e temas sugeridos; logo escolhida no dashboard.
- [Marca Premium Cirurgia](mem://design/marca-premium-cirurgia) — Diretrizes oficiais: paleta 60/30/10 azul petróleo/branco/ciano, estética documental realista, tom cirúrgico anti-objeção "vou pensar".
- [Sem valores monetários](mem://constraints/no-prices) — Nunca exibir preços/valores em copy pública.
- [Paleta LACTBMF Liga](mem://design/paleta-lactbmf) — Posts da Liga (@lactbmf.anhanguerasbo): #FBFBFB / #DD8E3C / #000000 / #2D2C32 / #D6403A. Fundo grafite/preto, destaque âmbar, vermelho só alerta.
