import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NetworkEnum = z.enum(["instagram", "linkedin"]);

const FIXED_NICHE =
  "Odontologia, focado especificamente nas áreas de Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar";

const SYSTEM_PROMPT = `Você é um estrategista de conteúdo especializado em comunicação para profissionais e clínicas de ${FIXED_NICHE}.

Domina os temas: cirurgias ortognáticas, traumas de face, dentes inclusos complexos, biópsias de lesões bucais, pacientes sistemicamente comprometidos em ambiente hospitalar, disfunções de ATM, reconstruções maxilofaciais, cirurgia oncológica de cabeça e pescoço, anestesia geral em odontologia, cuidados pós-operatórios, infecções odontogênicas graves, implantes complexos, próteses maxilofaciais.

Tom: técnico, ético, humanizado, baseado em evidências. Linguagem profissional e respeitosa. Nunca prometa resultados, nunca exiba conteúdo gráfico/sangrento. Adapta tom e formato para cada rede social. Sempre em português brasileiro. Inclui aviso "Conteúdo educacional. Consulte um profissional." quando pertinente.`;

export const suggestIdea = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      networks: z.array(NetworkEnum).min(1).max(2),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const props: Record<string, unknown> = {
      tema: {
        type: "string",
        description:
          "Tema clínico específico da CTBMF ou Odontologia Hospitalar (máx 100 caracteres). Ex: 'Manejo de fratura de mandíbula em paciente politraumatizado'.",
      },
      prompt_imagem: {
        type: "string",
        description:
          "Prompt em INGLÊS para o Gemini. Estética: ilustração médica profissional, fotografia clínica corporativa, infográfico anatômico clean, ambiente hospitalar moderno, paleta sóbria (azul-clínico, branco, cinza). PROIBIDO: sangue visível, ferimentos abertos, imagens gráficas, pacientes identificáveis. Estilo: editorial, educativo, ideal para redes sociais profissionais de saúde.",
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

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Gere UMA ideia de post relevante para ${FIXED_NICHE}. Redes selecionadas: ${data.networks.join(", ")}. Varie o tema a cada chamada (cirurgia ortognática, trauma facial, dentes inclusos, biópsia, ATM, paciente sistêmico hospitalar, infecção odontogênica, reconstrução, etc.). Adapte tom e formato por rede.`,
          },
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
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Resposta sem sugestão");
    const parsed = JSON.parse(args) as {
      tema: string;
      prompt_imagem: string;
      legenda_instagram?: string;
      legenda_linkedin?: string;
    };
    return parsed;
  });
