import { createServerFn } from "@tanstack/react-start";

const WHATSAPP = "https://wa.me/5511947684004";
const ASSINATURA = "PROF. FRANCISCO MENEZES | CROSP:53318";

function imageSystemPrompt(tema: string, rede: string, slide?: { n: number; total: number; papel: string }) {
  const slideInfo = slide
    ? `\n- ESTE É O SLIDE ${slide.n}/${slide.total} de um CARROSSEL. Papel deste slide: ${slide.papel}.`
    : "";
  const assinaturaInfo = `\n- Rodapé OBRIGATÓRIO: "${ASSINATURA}".`;
  return `Cartaz médico premium em estilo Dr. Francisco Menezes:
- Paleta: azul profundo (#0c2340), branco, azul elétrico (#2dd4ff). Vermelho APENAS para indicar dor.
- Tipografia bold, alto contraste, layout limpo e autoridade médica premium.
- Texto curto em PT-BR (com acentos corretos) sobre: "${tema}".${assinaturaInfo}
- Rede de destino: ${rede}. ${rede === "estilo-x" ? "Estilo TWEET visual, 16:9." : "Formato quadrado 1:1."}${slideInfo}
- Sem texto inglês. Sem watermark de IA. CTA quando aplicável: "Link na Bio" ou ${WHATSAPP}.`;
}

export const backfillMissingImages = createServerFn({ method: "POST" })
  .handler(async () => {
    const key = process.env.GROQ_API_KEY ?? "";

    const { generateImageBase64 } = await import("@/lib/ai-gateway.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("id, tipo_post, estilo_layout, legenda, prompt_ia, url_imagem, imagens_carrossel")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const semImagem = (posts ?? []).filter((p: any) => {
      const noSingle = !p.url_imagem;
      const carr = Array.isArray(p.imagens_carrossel) ? p.imagens_carrossel : [];
      return noSingle && carr.length === 0;
    });

    const uploadOne = async (b64: string) => {
      const buf = Buffer.from(b64, "base64");
      const fileName = `backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("post-images")
        .upload(fileName, buf, { contentType: "image/jpeg", upsert: false, cacheControl: "604800" });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);
      const publicUrl = supabaseAdmin.storage.from("post-images").getPublicUrl(fileName).data.publicUrl;
      const { data: signed } = await supabaseAdmin.storage.from("post-images").createSignedUrl(fileName, 60 * 60 * 24 * 7);
      return { publicUrl, signedUrl: signed?.signedUrl ?? publicUrl };
    };

    const results: Array<{ id: string; ok: boolean; err?: string; slides?: number }> = [];

    for (const p of semImagem) {
      try {
        const tema = (p.prompt_ia || p.legenda || "Saúde bucomaxilofacial").toString().slice(0, 200);
        const rede = p.estilo_layout === "Estilo X" ? "estilo-x" : "instagram";
        const size: "1024x1024" | "1536x1024" = rede === "estilo-x" ? "1536x1024" : "1024x1024";
        const expires = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString();

        if (p.tipo_post === "Carrossel") {
          const slides = [
            { n: 1, total: 6, papel: "CAPA: gancho forte + rodapé textual" },
            { n: 2, total: 6, papel: "PROBLEMA: dor/sintoma + rodapé textual" },
            { n: 3, total: 6, papel: "CAUSA: explicação didática + rodapé textual" },
            { n: 4, total: 6, papel: "EVIDÊNCIA: dado clínico + rodapé textual" },
            { n: 5, total: 6, papel: "SOLUÇÃO: conduta/tratamento + rodapé textual" },
            { n: 6, total: 6, papel: "CTA final Link na Bio/WhatsApp + rodapé textual" },
          ];
          const b64s = await Promise.all(
            slides.map((s) => generateImageBase64({ apiKey: key, prompt: imageSystemPrompt(tema, rede, s), size })),
          );
          const ups = await Promise.all(b64s.map(uploadOne));
          await supabaseAdmin.from("posts").update({
            url_imagem: ups[0].publicUrl,
            url_imagem_cache: ups[0].signedUrl,
            url_imagem_cache_expires_at: expires,
            imagens_carrossel: ups.map((u) => u.publicUrl),
            imagens_carrossel_cache: ups.map((u) => u.signedUrl),
            imagens_carrossel_cache_expires_at: expires,
          } as any).eq("id", p.id);
          results.push({ id: p.id, ok: true, slides: 6 });
        } else {
          const b64 = await generateImageBase64({ apiKey: key, prompt: imageSystemPrompt(tema, rede), size });
          const up = await uploadOne(b64);
          await supabaseAdmin.from("posts").update({
            url_imagem: up.publicUrl,
            url_imagem_cache: up.signedUrl,
            url_imagem_cache_expires_at: expires,
          } as any).eq("id", p.id);
          results.push({ id: p.id, ok: true, slides: 1 });
        }
      } catch (e: any) {
        results.push({ id: p.id, ok: false, err: String(e?.message || e) });
      }
    }

    return { total: semImagem.length, results };
  });
