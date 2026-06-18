---
name: Planner Simplificado — Estudantes de Graduação
description: Aba "Planner Simplificado" gera posts didáticos de cirurgia bucal básica para alunos de graduação, com 2 logos da faculdade no overlay
type: feature
---
- Aba "Planner Simplificado" SEMPRE envia `audiencia: "estudantes-graduacao"` em `generateSinglePost`.
- Público: alunos de graduação em Odontologia. Conteúdo: cirurgia bucal básica (exodontia, anestesia, sutura, frenectomia, biópsia, alveoloplastia). Formatos: ENQUETES, CURIOSIDADES, DICAS DE TÉCNICA, MITO x VERDADE, CAIU NA PROVA.
- Tom: didático/monitoria, simples e instrutivo. Hashtags acadêmicas (#OdontologiaAcadêmica #EstudanteDeOdonto #Graduação #MonitoriaOdonto). SEM CTA comercial, SEM WhatsApp do consultório, SEM bibliografia Lancet/JOMS.
- Visual: paleta das logos da faculdade — fundo NAVY ESCURO #0a1a3a com gradiente para TEAL #2080a0, detalhes brancos/prata. NUNCA fundo branco.
- Logos: 2 logos REAIS (`logo-aluno-1.png` + `logo-aluno-2.png`) aplicadas como overlay nos cantos inferiores (esq. + dir.) via `overlayAlunoLogos` em `src/lib/logo-overlay.server.ts`. IA reserva os cantos limpos; NÃO desenha logos.
- Assinatura "Prof. Francisco Menezes" NÃO entra neste modo (é conta separada da faculdade).
