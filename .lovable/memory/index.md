# Project Memory

## Core
Toda geração de imagem segue o estilo Mayo/Cleveland/Lancet do Prof. Francisco Menezes (CTBMF + Odontologia Hospitalar): paleta azul petróleo #0c2340 / azul ciano #2dd4ff / branco puro / preto. Vermelho só para dor. Tipografia bold sans-serif, autoridade hospitalar premium, copy em PT-BR Brasil impecável (sem palavras duplicadas, sem inglês, sem caracteres estranhos).
Assinatura oficial: "Prof. Francisco Menezes | CROSP 53318" + subtítulo "Cirurgia e Traumatologia Bucomaxilofacial · Odontologia Hospitalar". Em carrossel: só 1ª e última imagens.
3 níveis de conteúdo: IG Conversão (dor/identificação, stories e feed 9h), IG Autoridade (caso/ciência traduzida, feed 15h e 19h), LinkedIn Científico (Lancet/IJOMS/JOMS + DOI). Cron `gerar-proximo` alterna automaticamente.
Modelo de imagem padrão: google/gemini-3.1-flash-image-preview. Carrosséis padrão = 6 cards; Estilo X = 3 cards 16:9. Todas em paralelo.
LOGO oficial = src/assets/logo-planner.png. IA NUNCA desenha — apenas reserva canto superior direito limpo. Overlay real aplicado pelo sistema.
CTAs IG/X: "Link na Bio" / "Saiba mais pelo link da bio". CTA LinkedIn: WhatsApp https://wa.me/5511947684004. PROIBIDO: "agende consulta/avaliação", "promoção", "oferta", "desconto", "últimas vagas".

## Memories
- [Estilo visual Dr. Francisco Menezes](mem://design/visual-style-francisco-menezes) — Padrão completo de direção de arte, paleta, composição, formatos, regras de copy
- [Acesso público post-images](mem://constraints/post-images-security.md) — O bucket post-images deve ser público para que APIs externas funcionem.
- [X é estilo, não rede](mem://constraints/x-twitter-style) — Botão X = formato tweet publicado em IG/LinkedIn.
- [Tom de voz e bibliografia](mem://features/tone-and-bibliography) — IG/X linguagem leiga e empática; LinkedIn formal/científico com DOI. Fontes: Lancet, IJOMS, JOMS, OSOMOPOR, BJOMS.
- [Cronograma de postagens](mem://features/schedule-cadence) — Seg-Sáb: IG feed 9/15/19, stories 8/13/17, LinkedIn 9 e 17:30. Domingo: posts especiais automáticos.
- [Nunca inventar logo](mem://constraints/no-fake-logo) — IA reserva canto superior direito limpo; logo real é overlay do sistema. Carrossel padrão = 6 cards.
- [Estilo e dimensões das imagens](mem://design/image-style-and-dimensions) — Dimensões por rede (IG 4:5, Stories 9:16, LinkedIn/Google/X 16:9/4:3), 5 estilos alternados (foto, ilustração, quadrinhos, infográfico, colagem), pouco texto, representação literal do tema, temas de alta busca.
