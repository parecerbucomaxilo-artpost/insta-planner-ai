import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SugerirTemasInput, sugerirTemasComIA } from "@/lib/theme-suggest";
import { diretrizEditorialChico } from "@/lib/chico-editorial";
import { TextoInput, ImagemInput, MARCAS, montarPromptTexto, lerResultado, montarPromptImagem, FORMATOS_IA } from "@/lib/advanced-ai";

/** Modo IA Avançada — chamadas reais ao gateway existente. Nunca devolve texto ou imagem simulados. */
export const gerarTextoAvancado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextoInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.modelo?.startsWith("openai-direct/") && !process.env.LOVABLE_API_KEY) throw new Error("IA não configurada. Nenhum texto foi gerado.");
    const { generateTextAI } = await import("@/lib/ai-gateway.server");
    const { brandBookPrompt } = await import("@/lib/brand-book");
    const { plainLanguageRule } = await import("@/lib/plain-language");
    const p = await import("@/lib/ai-post.functions");
    const b = data.briefing;
    const perfil = MARCAS[b.marca];
    const audiencia = perfil.audiencia;
    const isChico = b.marca === "chico";
    const ctas = b.rede === "linkedin" ? p.CTAS_PERMITIDOS_LI : p.CTAS_PERMITIDOS_IG;
    const system = [
      "Você é editor-chefe de conteúdo em Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar. Escreva em português brasileiro impecável.",
      ...(b.marca === "liga"
        ? [
            brandBookPrompt(audiencia),
            "Perfil @lactbmf.anhanguerasbo (Liga Acadêmica de CTBMF): tom acadêmico, científico e institucional para estudantes e profissionais. Não use assinatura, CROSP, cidades, WhatsApp ou CTA do perfil @drfranciscomenezes, nem dados da Clínica Escola ou de Cirurgia e Biópsias.",
            `Assinatura do perfil: "${perfil.assinatura}".`,
          ]
        : isChico
        ? [
            brandBookPrompt(audiencia),
            `Perfil @drfranciscomenezes: tom humanizado, premium e acessível para pacientes. ${diretrizEditorialChico()}`,
            p.CTAS_PROIBIDOS,
            ctas,
          ]
        : [
            perfil.regras,
            `Assinatura do perfil: "${perfil.assinatura}".`,
            b.telefone ? `Telefone oficial para agendamento/contato: ${b.telefone}.` : "Sem telefone configurado: não escreva nenhum número de telefone.",
          ]),
      plainLanguageRule({ audiencia, nivel: b.nivel === "tecnico" ? "linkedin-cientifico" : undefined }),
    ].join("\n\n");
    const prompt = `${p.clinicalContract(b.tema, audiencia)}\n\n${montarPromptTexto(b, data.variantes, data.ajuste, data.anterior)}`;
    const bruto = await generateTextAI({ system, prompt, model: data.modelo });
    return lerResultado(bruto);
  });

export const gerarImagemAvancada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImagemInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.modelo?.startsWith("openai-direct/") && !process.env.LOVABLE_API_KEY) throw new Error("Gerador de imagem não configurado. Nenhuma imagem foi criada.");
    const { generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { brandBookPrompt } = await import("@/lib/brand-book");
    const prompt = `${montarPromptImagem(data.briefing, data.formato, data.tipo, data.slide, data.textoSlide)}${data.briefing.marca === "chico" || data.briefing.marca === "liga" ? `\n\n${brandBookPrompt(MARCAS[data.briefing.marca].audiencia)}` : ""}`;
    const b64 = await generateImageBase64({ prompt, model: data.modelo, size: FORMATOS_IA[data.formato].size });
    return { imagem: b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}` };
  });

/** IA escolhe o tema: chama o gateway real com histórico do usuário (antirrepetição). Sem fallback local. */
export const sugerirTemasIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SugerirTemasInput.parse(d))
  .handler(async ({ data, context }) => {
    if (!process.env.LOVABLE_API_KEY) throw new Error("IA não configurada. Nenhuma sugestão foi gerada.");
    const { generateTextAI } = await import("@/lib/ai-gateway.server");
    const desde = new Date(Date.now() - 60 * 864e5).toISOString();
    const { data: rows } = await context.supabase
      .from("posts").select("prompt_ia, legenda").gte("created_at", desde).order("created_at", { ascending: false }).limit(60);
    const historico = (rows ?? [])
      .map((r) => (r.prompt_ia || r.legenda || "").split(/[.\n]/)[0].slice(0, 160).trim())
      .filter(Boolean);
    return sugerirTemasComIA(data, historico, generateTextAI);
  });

/** Só informa se a chave própria da OpenAI existe; nunca devolve o valor. */
export const statusOpenAIDireto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { chaveOpenAIConfigurada } = await import("@/lib/openai-direct.server");
    return { configurada: chaveOpenAIConfigurada() };
  });
