import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TextoInput, ImagemInput, MARCAS, montarPromptTexto, lerResultado, montarPromptImagem, FORMATOS_IA } from "@/lib/advanced-ai";

/** Modo IA Avançada — chamadas reais ao gateway existente. Nunca devolve texto ou imagem simulados. */
export const gerarTextoAvancado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TextoInput.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.LOVABLE_API_KEY) throw new Error("IA não configurada. Nenhum texto foi gerado.");
    const { generateTextAI } = await import("@/lib/ai-gateway.server");
    const { brandBookPrompt } = await import("@/lib/brand-book");
    const { plainLanguageRule } = await import("@/lib/plain-language");
    const p = await import("@/lib/ai-post.functions");
    const b = data.briefing;
    const audiencia = MARCAS[b.marca].audiencia;
    const isDrfm = b.marca === "drfm";
    const ctas = b.rede === "linkedin" ? p.CTAS_PERMITIDOS_LI : p.CTAS_PERMITIDOS_IG;
    const regrasMarca = isDrfm
      ? `Perfil @drfranciscomenezes: tom humanizado, premium e acessível para pacientes. ${p.LOCALIZACAO_OBRIGATORIA} Encerre com "${p.ASSINATURA}" — "${p.ASSINATURA_SUBTITULO}".`
      : "Perfil @lactbmf.anhanguerasbo: tom acadêmico, científico e institucional para estudantes e profissionais. Não use assinatura, cidades ou CTA do perfil @drfranciscomenezes.";
    const system = [
      "Você é editor-chefe de conteúdo em Cirurgia e Traumatologia Bucomaxilofacial e Odontologia Hospitalar. Escreva em português brasileiro impecável.",
      brandBookPrompt(audiencia),
      regrasMarca,
      p.CTAS_PROIBIDOS,
      ctas,
      plainLanguageRule({ audiencia, nivel: b.nivel === "tecnico" ? "técnico" : undefined }),
    ].join("\n\n");
    const prompt = `${p.clinicalContract(b.tema, audiencia)}\n\n${montarPromptTexto(b, data.variantes, data.ajuste, data.anterior)}`;
    const bruto = await generateTextAI({ system, prompt, model: data.modelo });
    return lerResultado(bruto);
  });

export const gerarImagemAvancada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImagemInput.parse(d))
  .handler(async ({ data }) => {
    if (!process.env.LOVABLE_API_KEY) throw new Error("Gerador de imagem não configurado. Nenhuma imagem foi criada.");
    const { generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { brandBookPrompt } = await import("@/lib/brand-book");
    const prompt = `${montarPromptImagem(data.briefing, data.formato, data.tipo, data.slide, data.textoSlide)}\n\n${brandBookPrompt(MARCAS[data.briefing.marca].audiencia)}`;
    const b64 = await generateImageBase64({ prompt, model: data.modelo, size: FORMATOS_IA[data.formato].size });
    return { imagem: b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}` };
  });
