import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Identidade visual fixa "Premium Medical Sci-Fi" — aplicada a TODAS as imagens.
const STYLE_PREFIX =
  "Premium editorial medical photography fused with translucent clinical technology and high-precision 3D diagnostic renders. ";
const STYLE_SUFFIX =
  ". Color palette: dominant deep navy blue, glowing cyan neon tech accents, dark graphite gray and pristine surgical white — strictly no warm tones (no yellow, red or orange beyond subtle skin). Dark minimalist medical abstract background. Cinematic dramatic directional lighting with glowing blue neon light beams crossing the frame for depth and technical dynamism. Integrate translucent technological overlays: 3D wireframe mesh over human faces, stylized anatomical skulls in metallic blue glass, digital medical line graphics, HUD-like data accents. Clean centered composition, profile or 3/4 view portrait focusing on facial structure, jawline, TMJ and cranium. Hyperrealistic 8k, photorealistic, medical sci-fi aesthetic, professional studio photography, award-winning. Absolutely no light or colorful backgrounds, no cheap stock photography look, no blood, no scary surgical gore.";

const NEGATIVE =
  "amateur stock photo, bright background, white background, warm color palette, yellow/red/orange dominant, blood, gore, scary hospital, low resolution, cartoon, illustration";

export const generateImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ prompt: z.string().min(2).max(2000) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const finalPrompt = `${STYLE_PREFIX}${data.prompt}${STYLE_SUFFIX} Negative: ${NEGATIVE}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: finalPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Falha ao gerar imagem (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Resposta sem imagem");
    return { dataUrl: `data:image/png;base64,${b64}` };
  });
