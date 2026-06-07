import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NetworkEnum = z.enum(["instagram", "linkedin"]);

const FIXED_NICHE =
  "Odontologia, focado especificamente nas áreas de Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar";

const SYSTEM_PROMPT = `Você é um estrategista de conteúdo especializado em comunicação para profissionais e clínicas de ${FIXED_NICHE}.

Domina os temas: cirurgias ortognáticas, traumas de face, dentes inclusos complexos, biópsias de lesões bucais, pacientes sistemicamente comprometidos em ambiente hospitalar, disfunções de ATM, reconstruções maxilofaciais, cirurgia oncológica de cabeça e pescoço, anestesia geral em odontologia, cuidados pós-operatórios, infecções odontogênicas graves, implantes complexos, próteses maxilofaciais.

Tom: técnico, ético, humanizado, baseado em evidências. Linguagem profissional e respeitosa. Nunca prometa resultados, nunca exiba conteúdo gráfico/sangrento. Adapta tom e formato para cada rede social. Sempre em português brasileiro. Inclui aviso "Conteúdo educacional. Consulte um profissional." quando pertinente.`;

function buildMock(networks: Array<"instagram" | "linkedin">, comando?: string) {
  const tema = comando?.trim()
    ? `[SIMULAÇÃO] ${comando.trim().slice(0, 90)}`
    : "[SIMULAÇÃO] Cirurgia ortognática: como o planejamento 3D melhora a respiração e a estética facial";
  const base =
    "⚠️ Conteúdo SIMULADO (modo demonstração — sem chave da Anthropic configurada).\n\n" +
    "Este é um exemplo de legenda gerada para previsualização da interface. " +
    "Configure sua ANTHROPIC_API_KEY em Configurações → Chave Anthropic para ativar o Claude 3.5 Sonnet com tom científico, humanizado e ético da CTBMF.\n\n" +
    "Conteúdo educacional. Consulte um profissional.";
  return {
    tema,
    prompt_imagem:
      "professional medical editorial photography, luxury clinic interior, oral and maxillofacial surgeon in modern boutique consultório, deep navy and pristine white palette, matte gold accents, 85mm f/1.4 cinematic lens, shallow depth of field, elegant bokeh, warm cinematic lighting, photorealistic 8k, award-winning composition",
    legenda_instagram: networks.includes("instagram") ? base + "\n\n#CTBMF #BucoMaxiloFacial #OdontologiaHospitalar #CirurgiaOrtognatica #SaudeOral" : undefined,
    legenda_linkedin: networks.includes("linkedin") ? base : undefined,
  };
}

export const suggestIdea = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      networks: z.array(NetworkEnum).min(1).max(2),
      comando: z.string().trim().max(800).optional(),
      apiKey: z.string().trim().min(10).max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const anthropicKey = data.apiKey || process.env.ANTHROPIC_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    // Sem nenhuma chave: retorna mock para destravar a UI
    if (!anthropicKey && !lovableKey) {
      return buildMock(data.networks, data.comando);
    }


    const props: Record<string, unknown> = {
      tema: {
        type: "string",
        description:
          "Tema clínico específico da CTBMF ou Odontologia Hospitalar (máx 100 caracteres). Ex: 'Manejo de fratura de mandíbula em paciente politraumatizado'.",
      },
      prompt_imagem: {
        type: "string",
        description:
          "Prompt EM INGLÊS para o Gemini gerar uma imagem no padrão 'Premium Medical'. OBRIGATÓRIO seguir estritamente esta estética: sofisticação, confiança, alta tecnologia, inovação e acolhimento humano. PALETA: deep navy, surgical pristine white, matte gold, champagne e platinum gray — nunca neon berrante nem cores oversaturadas. ILUMINAÇÃO: limpa, suave, difusa, simulando estúdio profissional ou luz natural de consultório de luxo, warm cinematic mood. FOTOGRAFIA: 85mm f/1.4 cinematic lens, shallow depth of field, elegant bokeh, rule-of-thirds com espaço negativo intencional para overlay de texto. PESSOAS: médicos e pacientes com expressões naturais, acolhedoras, profissionais, felizes e bem-cuidados. CENÁRIO: consultório boutique de alto padrão, design minimalista, mármore discreto, equipamentos médicos de última geração com luzes sutis. SEMPRE incluir literalmente as palavras-chave: 'professional medical editorial photography, luxury clinic interior, clean elegant composition, warm cinematic lighting, photorealistic 8k, award-winning composition'. PROIBIDO: aspecto de banco de imagens barato, frio ou genérico; azul neon berrante; cores saturadas demais; corredores de hospital escuros ou assustadores; sangue, ferimentos, gore; pacientes identificáveis; texto na imagem; watermarks.",
      },
    };
    const required: string[] = ["tema", "prompt_imagem"];

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

    const userPrompt = data.comando && data.comando.length > 0
      ? `O usuário escreveu o seguinte COMANDO para o post: "${data.comando}". Crie UMA ideia de post fiel a esse comando, sempre dentro do nicho ${FIXED_NICHE}. Enriqueça com profundidade clínica e tom adequado. Redes selecionadas: ${data.networks.join(", ")}. Adapte tom e formato por rede.`
      : `Gere UMA ideia de post relevante para ${FIXED_NICHE}. Redes selecionadas: ${data.networks.join(", ")}. Varie o tema a cada chamada (cirurgia ortognática, trauma facial, dentes inclusos, biópsia, ATM, paciente sistêmico hospitalar, infecção odontogênica, reconstrução, etc.). Adapte tom e formato por rede.`;

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
    };
  });
