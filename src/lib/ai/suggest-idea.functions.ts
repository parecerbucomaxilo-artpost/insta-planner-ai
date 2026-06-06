import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const suggestIdea = createServerFn({ method: "POST" })
  .inputValidator(z.object({ niche: z.string().min(2).max(200) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

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
              "Você é um estrategista de conteúdo para Instagram. Gere ideias criativas, profissionais e envolventes em português brasileiro.",
          },
          {
            role: "user",
            content: `Nicho/assunto: "${data.niche}". Sugira UMA ideia de post.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_post",
              description: "Retorna uma ideia de post para Instagram.",
              parameters: {
                type: "object",
                properties: {
                  tema: { type: "string", description: "Tema curto do post (máx 80 caracteres)" },
                  legenda: {
                    type: "string",
                    description: "Legenda profissional pronta para publicar, com emojis e 5-8 hashtags relevantes ao final.",
                  },
                  prompt_imagem: {
                    type: "string",
                    description: "Prompt em inglês detalhado para o Gemini gerar a imagem do post (estilo, composição, cores, iluminação).",
                  },
                },
                required: ["tema", "legenda", "prompt_imagem"],
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
    const parsed = JSON.parse(args) as { tema: string; legenda: string; prompt_imagem: string };
    return parsed;
  });
