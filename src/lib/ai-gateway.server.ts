// Server-only helper.
// Texto: Groq via OpenAI-compatible API (GROQ_API_KEY).
// Imagens: Pollinations/Flux gratuito, sem consumir créditos do Lovable AI Gateway.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");
  return key;
}

// Mapeia ids legados/pagos para modelos gratuitos já configurados na Groq.
function mapTextModel(model: string): string {
  const m = (model || "").toLowerCase();
  if (m.includes("8b") || m.includes("instant") || m.includes("nano") || m.includes("lite")) {
    return "llama-3.1-8b-instant";
  }
  return "llama-3.3-70b-versatile";
}

export function createLovableAiGatewayProvider(_ignored?: string) {
  const provider = createOpenAICompatible({
    name: "groq",
    baseURL: GROQ_BASE,
    apiKey: getGroqKey(),
  });
  return (modelId: string) => provider(mapTextModel(modelId));
}

export const MODELOS_IMAGEM = [
  { id: "pollinations/flux", label: "Flux gratuito (padrão)" },
  { id: "google/gemini-3.1-flash-image", label: "Gemini Nano Banana 2 (legado)" },
  { id: "google/gemini-2.5-flash-image", label: "Gemini Nano Banana (legado)" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image (legado)" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image Mini (legado)" },
  { id: "openai/gpt-image-2", label: "GPT Image 2 (legado)" },
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

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem | string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const cleaned = sanitizeVisualPrompt(opts.prompt) + REALISM_SUFFIX;
  const { width, height } = sizeToWH(opts.size);
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url = new URL(`${POLLINATIONS_BASE}/${encodeURIComponent(cleaned)}`);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("model", "flux");
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  url.searchParams.set("enhance", "true");
  url.searchParams.set("safe", "false");
  url.searchParams.set("seed", String(seed));

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "image/*" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
      }
      const txt = await res.text().catch(() => "");
      lastErr = new Error(`Pollinations ${res.status}: ${txt.slice(0, 300)}`);
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
