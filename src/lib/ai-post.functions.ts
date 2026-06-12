import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SingleInput = z.object({
  tema: z.string().min(1),
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("CTBMF"),
  rede: z.enum(["instagram", "linkedin", "estilo-x"]).default("instagram"),
  tipo: z.enum(["feed", "stories"]).optional(),
  quando: z.string().datetime().optional(), // ISO; se vier, agenda
});

const WeekInput = z.object({
  especialidade: z.enum(["CTBMF", "Odontologia Hospitalar", "Ambas"]).default("Ambas"),
});

const WHATSAPP = "https://wa.me/5511947684004";
const ASSINATURA = "Prof. Francisco Menezes — CROSP 53318";

function tonePrompt(rede: "instagram" | "linkedin" | "estilo-x") {
  if (rede === "linkedin") {
    return "TOM: formal, científico, dirigido a colegas dentistas/médicos. Pode usar terminologia técnica e dados epidemiológicos. Cite evidência quando possível.";
  }
  return "TOM: linguagem ACESSÍVEL ao público leigo, empática, que faz o paciente se identificar com a DOR/QUEIXA (ex.: 'Você sente...', 'Já acordou com...'). Sem jargão; quando inevitável, traduzir entre parênteses.";
}

function captionSystem(rede: "instagram" | "linkedin" | "estilo-x", especialidade: string) {
  return `Você é o copywriter do ${ASSINATURA}, cirurgião bucomaxilofacial e odontologista hospitalar.
Tema da especialidade neste post: ${especialidade}.
${tonePrompt(rede)}
REGRAS DE CTA:
- NUNCA use "agende sua consulta", "agende sua avaliação" ou similares.
- Use SEMPRE como CTA: "Link na Bio" (IG/X) ou o link do WhatsApp: ${WHATSAPP} (LinkedIn).
FORMATO: legenda pronta para postar, com gancho forte na 1ª linha, 3-6 emojis estratégicos, 5-8 hashtags ao final relevantes ao tema.
NÃO inclua a assinatura "${ASSINATURA}" no texto (ela vai como overlay na imagem).`;
}

function imageSystemPrompt(tema: string, rede: string) {
  return `Cartaz médico premium em estilo Dr. Francisco Menezes:
- Paleta: azul profundo (#0c2340), branco, azul elétrico (#2dd4ff). Vermelho APENAS para indicar dor.
- Tipografia bold, alto contraste, layout limpo e autoridade médica premium.
- Texto curto em PT-BR (com acentos corretos) sobre: "${tema}".
- Rodapé discreto: "${ASSINATURA}".
- Rede de destino: ${rede}. ${rede === "estilo-x" ? "Estilo TWEET visual, 16:9." : "Formato quadrado 1:1."}
- Sem texto inglês. Sem watermark de IA.`;
}

export const generateSinglePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SingleInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider, generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    // 1. Gera legenda
    const { text: legenda } = await generateText({
      model,
      system: captionSystem(data.rede, data.especialidade),
      prompt: `Crie a legenda completa para o post sobre: "${data.tema}".`,
    });

    // 2. Gera imagem
    const b64 = await generateImageBase64({
      apiKey: key,
      prompt: imageSystemPrompt(data.tema, data.rede),
      size: data.rede === "estilo-x" ? "1536x1024" : "1024x1024",
    });

    // 3. Upload no bucket post-images
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buf = Buffer.from(b64, "base64");
    const fileName = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("post-images")
      .upload(fileName, buf, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    const { data: pub } = supabaseAdmin.storage.from("post-images").getPublicUrl(fileName);

    // 4. Insere post como Rascunho (o usuário aprova/publica depois)
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: context.userId,
        tipo_post: data.rede === "estilo-x" ? "Carrossel" : "Post Único",
        estilo_layout: data.rede === "estilo-x" ? "Estilo X" : "Padrão",
        formato_midia: data.tipo === "stories" ? "Story" : "Imagem",
        legenda,
        url_imagem: pub.publicUrl,
        postar_instagram: data.rede !== "linkedin",
        postar_linkedin: data.rede === "linkedin",
        status: data.quando ? "Agendado" : "Rascunho",
        data_agendamento: data.quando ?? null,
        prompt_ia: data.tema,
      } as any)
      .select()
      .single();
    if (insErr) throw new Error(`DB: ${insErr.message}`);

    return { id: (inserted as any).id, url: pub.publicUrl, legenda };
  });

export const generateWeekThemes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WeekInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText, Output } = await import("ai");
    const { buildScheduleSlots } = await import("@/lib/schedule-config");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    // Slots reais dos próximos 7 dias
    const slots = buildScheduleSlots(new Date(), 7);
    const slotsResumo = slots.map((s, i) => {
      const dow = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"][s.diaSemana];
      const hhmm = `${String(s.hora).padStart(2,"0")}:${String(s.minuto).padStart(2,"0")}`;
      const dominical = s.diaSemana === 0 ? " [MENSAGEM DE DOMINGO — tom leve/inspiracional]" : "";
      return `${i + 1}. ${dow} ${hhmm} · ${s.rede} ${s.tipo}${dominical}`;
    }).join("\n");

    const schema = z.object({
      temas: z.array(z.object({
        slotIndex: z.number(),
        tema: z.string(),
        gancho: z.string(),
      })).length(slots.length),
    });

    const { experimental_output: out } = await generateText({
      model,
      experimental_output: Output.object({ schema }),
      system: `Você é estrategista de conteúdo de ${ASSINATURA}, cirurgião bucomaxilofacial e odontologista hospitalar.
Crie 1 tema por slot do cronograma abaixo (${slots.length} slots), sobre: ${data.especialidade}.
Mistura obrigatória: IG feed (linguagem leiga/empática + ganchos de dor), IG stories (curto, direto, enquete/pergunta), LinkedIn (formal/científico, dados/evidência).
Domingos = tom leve, motivacional, agradecimento, reflexão sobre cuidado e bem-estar — SEM gancho agressivo de dor.
Cada tema deve atacar uma DOR REAL (siso, ATM, trauma facial, infecção odontogênica, apneia, etc.) salvo nos domingos.
NUNCA CTA "agende consulta" — sempre WhatsApp/Link na Bio.

Slots:
${slotsResumo}`,
      prompt: "Gere os temas agora, um por slot, na ordem.",
    });

    // Anexa metadados do slot a cada tema
    const temas = out.temas
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((t) => {
        const s = slots[t.slotIndex - 1] ?? slots[0];
        return {
          dia: t.slotIndex,
          rede: s.rede,
          tipo: s.tipo,
          quando: s.quando.toISOString(),
          tema: t.tema,
          gancho: t.gancho,
        };
      });

    return { temas };
  });
