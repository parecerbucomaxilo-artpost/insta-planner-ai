import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FIXED_NICHE =
  "Odontologia, focado especificamente nas áreas de Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar";

const PerfilSchema = z
  .object({
    nome: z.string().max(120).optional(),
    cro_uf: z.string().max(40).optional(),
    subespecialidades: z.array(z.string().max(60)).max(20).optional(),
    tom_voz: z.enum(["Científico", "Humanizado", "Editorial"]).optional(),
  })
  .optional();

function buildSystem(perfil?: z.infer<typeof PerfilSchema>) {
  const ctx = perfil
    ? `\n\nCONTEXTO DO ESPECIALISTA (memória da IA — adapte tudo a este perfil):\n- Nome: ${perfil.nome || "(não informado)"}\n- Registro: ${perfil.cro_uf || "(não informado)"}\n- Subespecialidades: ${(perfil.subespecialidades || []).join(", ") || "(não informado)"}\n- Tom de voz preferido: ${perfil.tom_voz || "Científico"}`
    : "";
  return `Você é um estrategista editorial sênior para profissionais e clínicas de ${FIXED_NICHE}.

Tom: técnico, ético, humanizado, baseado em evidências. Português brasileiro. Nunca prometa resultados. Nunca conteúdo gráfico/sangrento.${ctx}`;
}

function buildMock(perfil?: z.infer<typeof PerfilSchema>) {
  const dias = [
    "Cirurgia ortognática: planejamento 3D e respiração",
    "Trauma facial: protocolo de pronto-atendimento",
    "Disfunção de ATM: quando encaminhar ao cirurgião",
    "Dentes inclusos complexos: indicações da exodontia",
    "Paciente sistêmico hospitalar: cuidados peri-operatórios",
  ];
  return {
    dias: dias.map((titulo) => ({
      titulo,
      legenda_instagram: `⚠️ [SIMULAÇÃO] ${titulo}\n\nConteúdo educacional. Configure ANTHROPIC_API_KEY para gerar via Claude.${perfil?.nome ? `\n\n— Dr(a). ${perfil.nome}` : ""}\n\n#CTBMF #BucoMaxiloFacial`,
      mensagem_direct:
        "Olá! Que bom ver seu interesse. Posso te enviar mais informações sobre esse procedimento e tirar dúvidas iniciais por aqui. Como posso te ajudar?",
      prompt_imagem:
        "3/4 view portrait with translucent 3D wireframe mesh over face, metallic blue glass skull accent, glowing cyan neon beams, dark navy background, cinematic dramatic lighting, hyperrealistic 8k, medical sci-fi aesthetic, award-winning composition",
    })),
  };
}

export const weeklyPlan = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      apiKey: z.string().trim().min(10).max(200).optional(),
      perfil: PerfilSchema,
      formato: z.enum(["Feed", "Stories", "Reels"]).optional().default("Feed"),
    }),
  )
  .handler(async ({ data }) => {
    const isStories = data.formato === "Stories";
    const isReels = data.formato === "Reels";
    const anthropicKey = data.apiKey || process.env.ANTHROPIC_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!anthropicKey && !lovableKey) return buildMock(data.perfil);

    const system = buildSystem(data.perfil);
    const userPrompt = `Gere um CRONOGRAMA EDITORIAL de 7 dias (segunda a domingo), com 2 ${data.formato.toUpperCase()} POR DIA (um às 10h e outro às 14h), totalizando 14 conteúdos ESTRITAMENTE DISTINTOS, complementares e relevantes para ${FIXED_NICHE}. 
    
    ${isStories ? "Os conteúdos devem ser interativos, rápidos e pensados para engajamento em stories (enquetes sugeridas, caixas de perguntas, etc)." : ""}
    ${isReels ? "Os conteúdos devem ser pensados para vídeos curtos (Reels), com roteiros dinâmicos, ganchos (hooks) fortes nos primeiros 3 segundos e sugestões de áudios/trends médicos." : ""}
    
    OBRIGATÓRIO VARIAR SUBTEMAS: Explore cada dia uma área diferente (Ex: Dia 1: Traumatologia Facial; Dia 2: Odontologia em UTI; Dia 3: Patologia/Biópsia; Dia 4: DTM/Dor Orofacial; Dia 5: Tecnologia/Planejamento 3D).
    
    Para cada um dos 14 posts, entregue: titulo curto, legenda_instagram (4-8 linhas com hashtags), mensagem_direct (resposta acolhedora curta, ≤ 350 chars), prompt_imagem (em INGLÊS, padrão Premium Medical Sci-Fi) e hora_agendamento (seja "10:00" ou "14:00").`;

    const toolSchema = {
      type: "object",
      properties: {
        posts: {
          type: "array",
          minItems: 14,
          maxItems: 14,
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              legenda_instagram: { type: "string" },
              mensagem_direct: { type: "string" },
              prompt_imagem: { type: "string" },
              hora_agendamento: { type: "string" },
            },
            required: ["titulo", "legenda_instagram", "mensagem_direct", "prompt_imagem", "hora_agendamento"],
          },
        },
      },
      required: ["posts"],
    };

    let parsedArgs: string | undefined;

    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // PERF: Haiku é ~3x mais rápido para o cronograma de 5 dias
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: userPrompt }],
          tools: [
            {
              name: "cronograma_semanal",
              description: "Retorna um plano editorial de 7 dias com 2 posts/dia.",
              input_schema: toolSchema,
            },
          ],
          tool_choice: { type: "tool", name: "cronograma_semanal" },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Limite de requisições no Claude. Tente em instantes.");
        if (res.status === 401) throw new Error("ANTHROPIC_API_KEY inválida.");
        throw new Error(`Falha no Claude (${res.status}): ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as { content?: Array<{ type: string; input?: unknown }> };
      const tool = json.content?.find((b) => b.type === "tool_use");
      if (!tool?.input) throw new Error("Resposta do Claude sem cronograma.");
      parsedArgs = JSON.stringify(tool.input);
    } else {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "cronograma_semanal",
                description: "Plano editorial de 7 dias com 2 posts/dia.",
                parameters: { ...toolSchema, additionalProperties: false },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "cronograma_semanal" } },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("Limite de requisições. Tente em instantes.");
        if (res.status === 402) throw new Error("Créditos esgotados.");
        throw new Error(`Falha na IA (${res.status}): ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
      };
      parsedArgs = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    }

    if (!parsedArgs) throw new Error("Resposta sem cronograma.");
    return JSON.parse(parsedArgs) as {
      posts: Array<{
        titulo: string;
        legenda_instagram: string;
        mensagem_direct: string;
        prompt_imagem: string;
        hora_agendamento: string;
      }>;
    };
  });
