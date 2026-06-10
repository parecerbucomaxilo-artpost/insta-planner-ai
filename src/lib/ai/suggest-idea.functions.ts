import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NetworkEnum = z.enum(["instagram", "linkedin"]);

const PerfilSchema = z
  .object({
    nome: z.string().max(120).optional(),
    cro_uf: z.string().max(40).optional(),
    subespecialidades: z.array(z.string().max(60)).max(20).optional(),
    tom_voz: z.enum(["Científico", "Humanizado", "Editorial"]).optional(),
  })
  .optional();

const FIXED_NICHE =
  "Odontologia, focado especificamente nas áreas de Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar";

// Biblioteca de formatos para rotação (combate à repetição)
const FORMATOS = [
  "post educativo (explica um conceito clínico de forma acessível)",
  "estudo de caso anonimizado (situação clínica + raciocínio + desfecho)",
  "quebra de mito (afirmação comum vs. evidência atual)",
  "lista de ferramentas/recursos (3-5 itens úteis ao público)",
  "reflexão de bastidores (rotina hospitalar, decisão clínica difícil)",
  "checklist prático (sinais de alerta, cuidados pós-operatórios)",
  "comparativo técnico (técnica A vs B, prós/contras)",
  "responder pergunta frequente do paciente",
];

function pickFormato(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return FORMATOS[Math.abs(h) % FORMATOS.length];
}

function buildSystem(perfil?: z.infer<typeof PerfilSchema>) {
  const ctx = perfil
    ? `\n\nCONTEXTO DO ESPECIALISTA:\n- Nome: ${perfil.nome || "(n/d)"}\n- Registro: ${perfil.cro_uf || "(n/d)"}\n- Subespecialidades: ${(perfil.subespecialidades || []).join(", ") || "(n/d)"}\n- Tom preferido: ${perfil.tom_voz || "Científico"}`
    : "";
  return `Você é estrategista sênior de conteúdo para ${FIXED_NICHE}.

OBJETIVO OCULTO: atrair consultas e agendamentos SEM jamais soar comercial. Gere valor massivo, identifique dores latentes e demonstre autoridade. A conversão acontece como consequência orgânica.

PROIBIDO TERMINANTEMENTE qualquer frase de venda explícita: "Agende sua consulta", "Marque sua avaliação", "Agende agora", "Compre", "Contrate", "Entre em contato para orçamento", "Fale conosco", "WhatsApp na bio", "Link na bio", "Clique aqui". NÃO usar essas frases em hipótese alguma.

CTA OBRIGATÓRIA = engajamento ou reflexão. Exemplos válidos: "Como você lida com isso na sua rotina? Comenta aqui", "Envie este post para alguém que precisa ver isso hoje", "Salve para consultar depois", "Conhecia esse detalhe? Conta nos comentários", "Marque um colega que vai se identificar".

ADAPTAÇÃO POR REDE — siga estritamente:
• Instagram → tom visual impactante, linguagem humanizada, storytelling, soluções práticas do dia a dia, frases curtas, emojis sutis.
• LinkedIn → tom corporativo e técnico, thought leadership, análises de mercado, tendências do setor, maturidade profissional. Sem ser frio nem puramente acadêmico.

VARIABILIDADE: alterne formato a cada chamada (nunca repetir a introdução). Use formato sugerido como guia. Varie sinônimos, ganchos e estruturas.

Tom: técnico, ético, humanizado, baseado em evidência. Sem promessas de resultado. Sem conteúdo gráfico. Português brasileiro com acentos corretos.${ctx}`;
}

function buildMock(networks: Array<"instagram" | "linkedin">, comando?: string, estilo: "padrao" | "x" = "padrao") {
  const tema = comando?.trim()
    ? `[SIMULAÇÃO] ${comando.trim().slice(0, 90)}`
    : "[SIMULAÇÃO] Cirurgia ortognática: como o planejamento 3D melhora a respiração e a estética facial";
  const base =
    "⚠️ Conteúdo SIMULADO (modo demonstração — sem chave da Anthropic configurada).\n\n" +
    "Este é um exemplo de legenda gerada para previsualização da interface. " +
    "Configure sua ANTHROPIC_API_KEY em Configurações → Chave Anthropic para ativar o Claude 3.5 Sonnet com tom científico, humanizado e ético da CTBMF.\n\n" +
    "Conteúdo educacional. Consulte um profissional.";
  const mensagem_direct =
    "Olá! Que bom ter você por aqui. Posso te enviar mais detalhes sobre esse procedimento e tirar dúvidas iniciais por mensagem. Se preferir, agendamos uma avaliação presencial — qual é o melhor canal para falar com você?";
  if (estilo === "x") {
    return {
      tema,
      prompt_imagem:
        "ultra-wide horizontal 16:9 composition, a single translucent metallic blue glass anatomical skull floating, glowing cyan neon edges, dark medical abstract background, cinematic dramatic lighting with blue light beams, hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning composition, no humans, no text",
      texto_x:
        "Planejamento 3D na ortognática reduz tempo cirúrgico em até 30%.\n\nMenos anestesia, recuperação mais previsível.\n\nSeu serviço já incorporou? #CTBMF",
      mensagem_direct,
    };
  }
  return {
    tema,
    prompt_imagem:
      "3/4 view portrait of a human face with translucent 3D wireframe mesh overlay highlighting jawline and TMJ, stylized metallic blue glass skull accent, glowing cyan neon light beams, deep navy and graphite background, dark medical abstract scene, cinematic dramatic lighting, hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning composition",
    legenda_instagram: networks.includes("instagram") ? base + "\n\n#CTBMF #BucoMaxiloFacial #OdontologiaHospitalar #CirurgiaOrtognatica #SaudeOral" : undefined,
    legenda_linkedin: networks.includes("linkedin") ? base : undefined,
    mensagem_direct,
  };
}

export const suggestIdea = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      networks: z.array(NetworkEnum).max(2).default([]),
      comando: z.string().trim().max(800).optional(),
      apiKey: z.string().trim().min(10).max(200).optional(),
      estilo: z.enum(["padrao", "x"]).optional().default("padrao"),
      perfil: PerfilSchema,
    }),
  )
  .handler(async ({ data }) => {
    const anthropicKey = data.apiKey || process.env.ANTHROPIC_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const system = buildSystem(data.perfil);

    // Sem nenhuma chave: retorna mock para destravar a UI
    if (!anthropicKey && !lovableKey) {
      return buildMock(data.networks, data.comando, data.estilo);
    }


    // ===== ESTILO X (Twitter): texto curto + imagem 16:9 conceitual =====
    const isX = data.estilo === "x";

    const props: Record<string, unknown> = {
      tema: {
        type: "string",
        description:
          "Tema clínico específico da CTBMF ou Odontologia Hospitalar (máx 100 caracteres). Ex: 'Manejo de fratura de mandíbula em paciente politraumatizado'.",
      },
      prompt_imagem: {
        type: "string",
        description: isX
          ? "Detailed prompt in ENGLISH for a 16:9 CONCEPTUAL image. Masterpiece medical editorial style: focus on a single premium element like a high-end 3D anatomical skull or digital facial planning wireframe, floating on a dark, professional medical background. Cinematic lighting, hyper-realistic, photorealistic 8k. NO TEXT, NO PEOPLE."
          : "Detailed prompt in ENGLISH for a REALISTIC medical scene (NO TEXT - it's added later). Describe high-end medical photography: a surgeon in scrubs, advanced clinical technology, or a luxury clinic interior. Use keywords: 'masterpiece', 'cinematic lighting', '85mm lens', 'bokeh', 'sharp detail', 'hyper-realistic'. Position the subject to the RIGHT to leave space for text on the LEFT. NO BLOOD, NO GORE.",
      },
    };
    const required: string[] = ["tema", "prompt_imagem"];

    if (isX) {
      props.texto_x = {
        type: "string",
        description:
          "Texto em pt-BR para a rede X (Twitter), ESTILO 'Autoridade Científica Rápida'. ESTRITAMENTE até 280 caracteres TOTAIS (contando hashtags, quebras e espaços). Estrutura obrigatória em 3 blocos separados por LINHA EM BRANCO: (1) gancho — uma afirmação forte e direta na 1ª linha; (2) um dado técnico, número ou benefício clínico no meio; (3) uma pergunta curta provocativa no fim. Use NO MÁXIMO 1 ou 2 hashtags ultra-específicas (ex: #CTBMF, #CirurgiaOrtognatica). Tom técnico-humanizado, sem emojis em excesso (no máx 1). Nada de thread, é um único tweet de alto engajamento.",
      };
      required.push("texto_x");
    } else {
      if (data.networks.includes("instagram")) {
        props.legenda_instagram = {
          type: "string",
          description:
            "Legenda Instagram pt-BR: tom HUMANIZADO, storytelling, visual impactante, soluções práticas do dia a dia. Gancho forte na 1ª linha, parágrafos curtos, emojis sutis (🦷 ⚕️ 🏥). Termine com CTA de ENGAJAMENTO (comentário/salvar/compartilhar). PROIBIDO 'Agende sua consulta' ou variações comerciais. Encerre com bloco de 8-12 hashtags ultra-específicas após linha em branco.",
        };
        required.push("legenda_instagram");
      }
      if (data.networks.includes("linkedin")) {
        props.legenda_linkedin = {
          type: "string",
          description:
            "Post LinkedIn pt-BR: tom CORPORATIVO e TÉCNICO, thought leadership, análise de mercado/tendências do setor, maturidade profissional (sem ser frio nem puramente acadêmico). Gancho profissional, parágrafos de 1-2 linhas, insight de evidência, CTA de DEBATE entre colegas (nunca comercial). PROIBIDO 'Agende' / 'Contrate' / 'Link na bio'. 4-6 hashtags corporativas.",
        };
        required.push("legenda_linkedin");
      }
    }

    // Mensagem de Direct (sempre acompanha)
    props.mensagem_direct = {
      type: "string",
      description:
        "Mensagem curta em pt-BR (até 400 caracteres) acolhedora e profissional para a secretária/médico responderem quem comentar/chamar no Direct. SEM frases de venda explícita (nada de 'Agende sua consulta'). Acolha, ofereça informação útil, convide para conversa.",
    };
    required.push("mensagem_direct");

    const formatoSugerido = pickFormato((data.comando || "") + Date.now().toString());
    const ctaRule = "CTA DE FECHAMENTO obrigatória do tipo engajamento/reflexão (ex.: 'Como você lida com isso? Comenta', 'Envie para quem precisa ver', 'Salve para depois'). NUNCA escreva 'Agende sua consulta', 'Marque sua avaliação', 'Compre', 'Contrate', 'Link na bio' ou variações comerciais. O campo prompt_imagem deve ser extremamente detalhado, focando em realismo fotográfico de alto nível (estilo National Geographic ou editorial médico premium).";
    const audienceLabel = isX
      ? "rede X (Twitter), tweet curto"
      : `Redes: ${data.networks.join(", ") || "nenhuma"} — adapte: Instagram = humanizado/storytelling/prático; LinkedIn = corporativo/thought leadership/análise.`;
    const userPrompt = data.comando && data.comando.length > 0
      ? `COMANDO do usuário: "${data.comando}". Crie UMA ideia fiel ao comando, dentro de ${FIXED_NICHE}. Formato sugerido: ${formatoSugerido}. ${audienceLabel}. ${ctaRule} ${isX ? "Tweet até 280 chars, gancho+dado+pergunta, máx 2 hashtags." : "Adapte tom por rede."} Inclua mensagem_direct.`
      : `Gere UMA ideia inédita para ${FIXED_NICHE}. Formato sugerido: ${formatoSugerido}. Varie tema e introdução (nunca repetir abertura). ${audienceLabel}. ${ctaRule} ${isX ? "Tweet até 280 chars, gancho+dado+pergunta, máx 2 hashtags." : "Adapte tom por rede."} Inclua mensagem_direct.`;

    let parsedArgs: string | undefined;

    // === Preferência: Anthropic Claude 3.5 Sonnet ===
    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // PERF: Haiku é ~3x mais rápido que Sonnet para texto curto estruturado
          model: "claude-3-5-haiku-20241022",
          max_tokens: 700,
          system: system,
          messages: [{ role: "user", content: userPrompt }],
          tools: [
            {
              name: "sugerir_post",
              description:
                "Retorna uma ideia de post de CTBMF / Odontologia Hospitalar adaptada para múltiplas redes.",
              input_schema: {
                type: "object",
                properties: props,
                required,
              },
            },
          ],
          tool_choice: { type: "tool", name: "sugerir_post" },
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Limite de requisições atingido no Claude. Tente em instantes.");
        if (res.status === 401) throw new Error("ANTHROPIC_API_KEY inválida.");
        throw new Error(`Falha no Claude (${res.status}): ${t.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        content?: Array<{ type: string; name?: string; input?: unknown }>;
      };
      const toolBlock = json.content?.find((b) => b.type === "tool_use");
      if (!toolBlock?.input) throw new Error("Resposta do Claude sem sugestão.");
      parsedArgs = JSON.stringify(toolBlock.input);
    } else {
      // === Fallback: Lovable AI Gateway ===
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "sugerir_post",
                description:
                  "Retorna uma ideia de post de CTBMF / Odontologia Hospitalar adaptada para múltiplas redes.",
                parameters: {
                  type: "object",
                  properties: props,
                  required,
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "sugerir_post" } },
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Limite de requisições atingido. Tente em instantes.");
        if (res.status === 402) throw new Error("Créditos esgotados na workspace.");
        throw new Error(`Falha na IA (${res.status}): ${t.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
      };
      parsedArgs = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    }

    if (!parsedArgs) throw new Error("Resposta sem sugestão");
    return JSON.parse(parsedArgs) as {
      tema: string;
      prompt_imagem: string;
      legenda_instagram?: string;
      legenda_linkedin?: string;
      texto_x?: string;
      mensagem_direct?: string;
    };
  });
