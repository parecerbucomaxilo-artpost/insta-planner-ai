// Server-only helper to talk to Lovable AI Gateway.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export const MODELOS_IMAGEM = [
  { id: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2 (mais rápido)" },
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana (rápido)" },
  { id: "openai/gpt-image-1-mini", label: "GPT-image-1 Mini (rápido)" },
  { id: "openai/gpt-image-2", label: "GPT-image-2 (premium, mais lento)" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image (alta qualidade)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

// Lovable AI Gateway image generation (OpenAI-compatible /v1/images/generations).
export async function generateImageBase64(opts: {
  apiKey: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem;
  // URLs (https) de imagens de referência para o modelo amostrar (paleta de cores, estilo).
  // Apenas modelos Gemini suportam — outros ignoram.
  referenceImageUrls?: string[];
}): Promise<string> {
  const model = opts.model ?? "google/gemini-3.1-flash-image-preview";
  const isGemini = model.startsWith("google/");
  const content = isGemini && opts.referenceImageUrls?.length
    ? [
        { type: "text" as const, text: opts.prompt },
        ...opts.referenceImageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ]
    : opts.prompt;
  const body = isGemini
    ? {
        model,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }
    : {
        model,
        prompt: opts.prompt,
        size: opts.size ?? "1024x1024",
        quality: model === "openai/gpt-image-2" ? "high" : "medium",
        output_format: "jpeg",
        output_compression: 80,
        n: 1,
      };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": opts.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Image gen ${res.status}: ${txt}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> | null };
    const item = json.data?.[0];
    if (item?.b64_json) return item.b64_json;
    if (item?.url) {
      const r = await fetch(item.url);
      const buf = Buffer.from(await r.arrayBuffer());
      return buf.toString("base64");
    }
    // Gemini às vezes devolve `data: null` (moderação silenciosa ou prompt bloqueado).
    // Tenta automaticamente com o modelo OpenAI antes de cair no fallback Flux.
    if (isGemini) {
      const altModel: ModeloImagem = "openai/gpt-image-1-mini";
      const altRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": opts.apiKey },
        body: JSON.stringify({
          model: altModel,
          prompt: opts.prompt,
          size: opts.size ?? "1024x1024",
          quality: "medium",
          output_format: "jpeg",
          output_compression: 80,
          n: 1,
        }),
      });
      if (altRes.ok) {
        const altJson = (await altRes.json()) as { data?: Array<{ b64_json?: string; url?: string }> | null };
        const altItem = altJson.data?.[0];
        if (altItem?.b64_json) return altItem.b64_json;
        if (altItem?.url) {
          const r = await fetch(altItem.url);
          return Buffer.from(await r.arrayBuffer()).toString("base64");
        }
      }
    }
    throw new Error(`Image gen: resposta sem b64_json nem url (${model}): ${JSON.stringify(json).slice(0, 300)}`);
  } catch (primaryErr) {
    // Fallback Cloudflare Workers AI · Flux Schnell — apenas plano de fundo / emergência.
    // Mantemos o modelo principal (Gemini/GPT) como padrão para preservar a identidade visual hospitalar.
    const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!cfAccount || !cfToken) throw primaryErr;
    try {
      return await generateImageFluxSchnellFallback({
        accountId: cfAccount,
        apiToken: cfToken,
        prompt: opts.prompt,
      });
    } catch (fallbackErr) {
      const primMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`Falha modelo principal (${primMsg}) e fallback Flux Schnell (${fbMsg})`);
    }
  }
}

// Fallback: Cloudflare Workers AI · @cf/black-forest-labs/flux-1-schnell
// Usado SOMENTE como plano de fundo quando o gateway principal falha.
async function generateImageFluxSchnellFallback(opts: {
  accountId: string;
  apiToken: string;
  prompt: string;
}): Promise<string> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiToken}`,
    },
    body: JSON.stringify({ prompt: opts.prompt, steps: 4 }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Flux Schnell ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as { result?: { image?: string }; success?: boolean; errors?: unknown };
  const b64 = json.result?.image;
  if (!b64) throw new Error(`Flux Schnell: resposta sem image (${JSON.stringify(json).slice(0, 300)})`);
  return b64;
}
