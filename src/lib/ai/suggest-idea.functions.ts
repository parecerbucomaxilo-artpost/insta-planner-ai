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

function buildSystem(perfil?: z.infer<typeof PerfilSchema>) {
  const ctx = perfil
    ? `\n\nCONTEXTO DO ESPECIALISTA (memória da IA — adapte tudo a este perfil, cite-o quando natural):\n- Nome: ${perfil.nome || "(não informado)"}\n- Registro: ${perfil.cro_uf || "(não informado)"}\n- Subespecialidades: ${(perfil.subespecialidades || []).join(", ") || "(não informado)"}\n- Tom de voz preferido: ${perfil.tom_voz || "Científico"}`
    : "";
  return `Você é um estrategista de conteúdo especializado em comunicação para profissionais e clínicas de ${FIXED_NICHE}.

Domina os temas: cirurgias ortognáticas, traumas de face, dentes inclusos complexos, biópsias de lesões bucais, pacientes sistemicamente comprometidos em ambiente hospitalar, disfunções de ATM, reconstruções maxilofaciais, cirurgia oncológica de cabeça e pescoço, anestesia geral em odontologia, cuidados pós-operatórios, infecções odontogênicas graves, implantes complexos, próteses maxilofaciais.

Tom: técnico, ético, humanizado, baseado em evidências. Linguagem profissional e respeitosa. Nunca prometa resultados, nunca exiba conteúdo gráfico/sangrento. Adapta tom e formato para cada rede social. Sempre em português brasileiro. Inclui aviso "Conteúdo educacional. Consulte um profissional." quando pertinente.${ctx}`;
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
  if (estilo === "x") {
    return {
      tema,
      prompt_imagem:
        "ultra-wide horizontal 16:9 composition, a single translucent metallic blue glass anatomical skull floating, glowing cyan neon edges, dark medical abstract background, cinematic dramatic lighting with blue light beams, hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning composition, no humans, no text",
      texto_x:
        "Planejamento 3D na ortognática reduz tempo cirúrgico em até 30%.\n\nMenos anestesia, recuperação mais previsível.\n\nSeu serviço já incorporou? #CTBMF",
    };
  }
  return {
    tema,
    prompt_imagem:
      "3/4 view portrait of a human face with translucent 3D wireframe mesh overlay highlighting jawline and TMJ, stylized metallic blue glass skull accent, glowing cyan neon light beams, deep navy and graphite background, dark medical abstract scene, cinematic dramatic lighting, hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning composition",
    legenda_instagram: networks.includes("instagram") ? base + "\n\n#CTBMF #BucoMaxiloFacial #OdontologiaHospitalar #CirurgiaOrtognatica #SaudeOral" : undefined,
    legenda_linkedin: networks.includes("linkedin") ? base : undefined,
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
          ? "Prompt EM INGLÊS para gerar uma imagem HORIZONTAL 16:9 PURAMENTE CONCEITUAL no padrão 'Premium Medical Sci-Fi'. OBRIGATÓRIO: composição ultra-wide horizontal 16:9, foco em UM ÚNICO elemento conceitual — APENAS um crânio anatômico 3D translúcido em vidro azul metálico flutuando OU APENAS uma malha digital wireframe de planejamento facial flutuando, sobre dark medical abstract background. PALETA: deep navy blue, glowing cyan neon, dark graphite. Cinematic dramatic lighting com feixes neon azulados. Hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning composition, clean surgical visual. PROIBIDO: rostos humanos, pessoas, texto na imagem, HUD com tipografia, fundos claros, cores quentes, sangue."
          : "Prompt EM INGLÊS para gerar uma imagem no padrão 'Premium Medical Sci-Fi'. Estilo: premium editorial medical photography fundida com clinical technology translúcida e renderizações 3D diagnósticas de alta precisão. PALETA OBRIGATÓRIA: deep navy blue dominante, glowing cyan neon (tech accents), dark graphite gray e pristine surgical white. FUNDO: sempre dark medical abstract background minimalista — NUNCA fundo claro nem colorido. ILUMINAÇÃO: cinematic dramatic directional lighting com glowing blue neon light beams cruzando a cena. ELEMENTOS: overlays tecnológicos translúcidos, 3D wireframe mesh sobre rostos humanos, crânios anatômicos estilizados em metallic blue glass, digital medical line graphics, HUD data accents. COMPOSIÇÃO: enquadramento limpo e centralizado, retrato em perfil ou 3/4 view focando estrutura facial, mandíbula, ATM, crânio. Sempre incluir literalmente: 'hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning composition'. PROIBIDO: fundos claros/coloridos, banco de imagens amador, cores quentes (amarelo, vermelho, laranja) em excesso, sangue, gore, hospital assustador, watermarks, texto na imagem, pacientes identificáveis.",
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
            "Conteúdo educativo e humanizado em pt-BR para Instagram. Explique o procedimento, cuidados pós-operatórios ou rotina hospitalar em linguagem acessível ao paciente. Parágrafos curtos, emojis sutis (🦷 ⚕️ 🏥), gancho na 1ª linha, e BLOCO de 8-12 hashtags ao final separado por linha em branco (incluir #CTBMF #BucoMaxiloFacial #OdontologiaHospitalar e variações relevantes).",
        };
        required.push("legenda_instagram");
      }
      if (data.networks.includes("linkedin")) {
        props.legenda_linkedin = {
          type: "string",
          description:
            "Post técnico em pt-BR para LinkedIn voltado a profissionais da saúde. Apresente caso clínico, discussão de artigo, gestão hospitalar ou reflexão para networking. Gancho profissional na 1ª linha, parágrafos curtos (1-2 linhas), referência/insight de evidência, CTA para debate entre colegas, 4-6 hashtags corporativas (#CirurgiaBucoMaxiloFacial #OdontologiaHospitalar #CTBMF etc.). Sem emojis excessivos.",
        };
        required.push("legenda_linkedin");
      }
    }

    const audienceLabel = isX ? "rede X (Twitter), formato tweet curto" : `Redes selecionadas: ${data.networks.join(", ") || "nenhuma"}`;
    const userPrompt = data.comando && data.comando.length > 0
      ? `O usuário escreveu o seguinte COMANDO para o post: "${data.comando}". Crie UMA ideia de post fiel a esse comando, sempre dentro do nicho ${FIXED_NICHE}. Enriqueça com profundidade clínica e tom adequado. ${audienceLabel}. ${isX ? "Texto OBRIGATORIAMENTE até 280 caracteres totais, formato 'Autoridade Científica Rápida' (gancho + dado + pergunta) com no máx 2 hashtags." : "Adapte tom e formato por rede."}`
      : `Gere UMA ideia de post relevante para ${FIXED_NICHE}. ${audienceLabel}. Varie o tema a cada chamada (cirurgia ortognática, trauma facial, dentes inclusos, biópsia, ATM, paciente sistêmico hospitalar, infecção odontogênica, reconstrução, etc.). ${isX ? "Texto OBRIGATORIAMENTE até 280 caracteres totais, formato 'Autoridade Científica Rápida' (gancho + dado + pergunta) com no máx 2 hashtags." : "Adapte tom e formato por rede."}`;

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
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
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
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
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
    };
  });
