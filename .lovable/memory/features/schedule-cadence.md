---
name: Cronograma de postagens
description: Slots automáticos por rede e nível editorial usados pelo cron gerar-proximo
type: feature
---
Seg-Sáb:
- IG feed: 9h, 15h, 19h (Carrossel 5 cards)
- IG stories: 8h, 13h, 17h (Story — teaser do feed do mesmo dia)
- LinkedIn feed: 9h e 17h30 (Post Único científico com DOI)
- Google Business Profile feed: 10h30 e 16h30 (Post Único, SEO local, imagem 1536x1024 4:3)

Domingo: IG feed 10h + IG story 9h + LinkedIn 11h + Google 11h30 (tom leve/inspiracional; Google mantém estrutura SEO).

Níveis editoriais resolvidos automaticamente em gerar-proximo:
- rede=google → google-business
- rede=linkedin → linkedin-cientifico
- IG stories → ig-conversao
- IG feed 9h → ig-conversao; 15h/19h → ig-autoridade

Posts Google ficam salvos como status=Agendado mas NÃO são auto-publicados (publicar-agendados só processa postar_linkedin=true). Usuário copia o texto do app e cola no Google Meu Negócio.
