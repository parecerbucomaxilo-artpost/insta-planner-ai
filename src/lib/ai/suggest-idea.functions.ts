import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NetworkEnum = z.enum(["instagram", "linkedin", "x"]);

export const suggestIdea = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      niche: z.string().min(2).max(200),
      networks: z.array(NetworkEnum).min(1).max(3),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const props: Record<string, unknown> = {
      tema: { type: "string", description: "Tema curto do post (máx 80 caracteres)" },
      prompt_imagem: {
        type: "string",
        description:
          "Prompt em inglês detalhado para o Gemini gerar a imagem do post (estilo, composição, cores, iluminação).",
      },
    };
    const required: string[] = ["tema", "prompt_imagem"];

    if (data.networks.includes("instagram")) {
      props.legenda_instagram = {
        type: "string",
        description:
          "Legenda para Instagram em pt-BR: parágrafos curtos com espaçamento limpo, emojis sutis, e um BLOCO de 6-10 hashtags relevantes no final separado por uma linha em branco.",
      };
      required.push("legenda_instagram");
    }
    if (data.networks.includes("linkedin")) {
      props.legenda_linkedin = {
        type: "string",
        description:
          "Post para LinkedIn em pt-BR: tom profissional e consultivo, gancho na primeira linha, parágrafos curtos (1-2 linhas), insight de valor, CTA ao final e 3-5 hashtags corporativas. Sem emojis em excesso.",
      };
      required.push("legenda_linkedin");
    }
    if (data.networks.includes("x")) {
      props.legenda_x = {
        type: "string",
        description:
          "Tweet em pt-BR ESTRITAMENTE com no máximo 280 caracteres (conte cada caractere). Direto, impactante, podendo incluir 1-2 hashtags.",
      };
      required.push("legenda_x");
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é um estrategista de conteúdo multi-rede (Instagram, LinkedIn, X). Adapte tom, tamanho e formato para cada plataforma. Sempre em português brasileiro.",
          },
          {
            role: "user",
            content: `Nicho/assunto: "${data.niche}". Redes selecionadas: ${data.networks.join(", ")}. Gere UMA ideia de post com versões otimizadas para cada rede.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_post",
              description: "Retorna uma ideia de post adaptada para múltiplas redes sociais.",
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
      legenda_x?: string;
    };
    // Garantia hard-cap 280 para X
    if (parsed.legenda_x && parsed.legenda_x.length > 280) {
      parsed.legenda_x = parsed.legenda_x.slice(0, 277) + "...";
    }
    return parsed;
  });
