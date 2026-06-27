// Server-only helper.
// Texto: ChatGPT (OpenAI) via Lovable AI Gateway — gratuito com LOVABLE_API_KEY.
// Imagens: Gemini Nano Banana (google/gemini-3.1-flash-image) via Lovable AI Gateway.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GATEWAY_BASE = "https://ai.gateway.lovable.dev/v1";

function getLovableKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

// Mapeia ids legados para modelos suportados no Lovable AI Gateway.
function mapTextModel(model: string): string {
  const m = (model || "").toLowerCase();
  if (m.startsWith("openai/")) return model;
  if (m.startsWith("google/")) return model;
  if (m.includes("8b") || m.includes("nano") || m.includes("instant") || m.includes("lite")) {
    return "openai/gpt-5-nano";
  }
  if (m.includes("mini") || m.includes("flash")) {
    return "openai/gpt-5-mini";
  }
  // padrão: ChatGPT
  return "openai/gpt-5-mini";
}

export function createLovableAiGatewayProvider(_ignored?: string) {
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_BASE,
    headers: {
      "Lovable-API-Key": getLovableKey(),
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  return (modelId: string) => provider(mapTextModel(modelId));
}

export const MODELOS_IMAGEM = [
  { id: "google/gemini-3.1-flash-image", label: "Gemini Nano Banana 2 (padrão)" },
  { id: "google/gemini-2.5-flash-image", label: "Gemini Nano Banana" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image Mini" },
  { id: "openai/gpt-image-2", label: "GPT Image 2" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

const REALISM_SUFFIX =
  ", raw candid photograph, realistic skin texture, visible pores, cinematic natural lighting, shot on 35mm lens, f/1.8, masterwork, 8k resolution, authentic editorial photo, depth of field, sharp focus, no airbrushing, no digital art look, no 3d render look, realistic human anatomy";

function sanitizeVisualPrompt(p: string): string {
  return p
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/["'`\n\r\t]/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

function sizeToWH(size?: string): { width: number; height: number } {
  if (size === "1536x1024") return { width: 1536, height: 1024 };
  if (size === "1024x1536") return { width: 1024, height: 1536 };
  return { width: 1024, height: 1024 };
}

function mapImageModel(model?: string): string {
  if (!model) return "google/gemini-3.1-flash-image";
  const m = model.toLowerCase();
  if (m.includes("pollinations") || m.includes("flux") || m.includes("imagen")) {
    return "google/gemini-3.1-flash-image";
  }
  if (m.endsWith("-preview")) return model.replace(/-preview$/, "");
  return model;
}

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem | string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const apiKey = getLovableKey();
  const model = mapImageModel(opts.model);
  const cleaned = sanitizeVisualPrompt(opts.prompt) + REALISM_SUFFIX;
  const { width, height } = sizeToWH(opts.size);

  const body = {
    model,
    prompt: cleaned,
    size: `${width}x${height}`,
    n: 1,
    response_format: "b64_json",
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const res = await fetch(`${GATEWAY_BASE}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "lovable-image",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json: any = await res.json();
        const b64 =
          json?.data?.[0]?.b64_json ||
          json?.images?.[0]?.b64_json ||
          json?.data?.[0]?.image ||
          json?.b64_json;
        if (b64) return b64;
        const url = json?.data?.[0]?.url;
        if (url) {
          const imgRes = await fetch(url);
          const bytes = new Uint8Array(await imgRes.arrayBuffer());
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          return btoa(binary);
        }
        throw new Error(`Lovable AI sem imagem: ${JSON.stringify(json).slice(0, 300)}`);
      }
      const txt = await res.text().catch(() => "");
      lastErr = new Error(`Lovable AI ${res.status}: ${txt.slice(0, 300)}`);
      // 4xx (exceto 429) não adianta retry
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw lastErr;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`Imagem falhou: ${String((lastErr as any)?.message || lastErr)}`);
}
