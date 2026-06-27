// Server-only helper.
// Texto: Groq por padrão; Gemini só quando explicitamente selecionado.
// Imagens: Hugging Face Router (FLUX.1-dev).
// Auth: GROQ_API_KEY / GEMINI_API_KEY / HF_TOKEN.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return key;
}

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");
  return key;
}

// Mapeia ids do catálogo para modelos reais do Gemini.
function mapModelToGemini(model: string): string {
  const m = (model || "").toLowerCase();
  if (m.startsWith("google/")) return model.slice("google/".length);
  if (m.includes("lite") || m.includes("nano") || m.includes("8b") || m.includes("flash-lite")) {
    return "gemini-2.5-flash-lite";
  }
  // Padrão pedido pelo usuário: gemini-2.5-flash para legendas.
  return "gemini-2.5-flash";
}

export function createLovableAiGatewayProvider(_ignoredKey: string) {
  const groqKey = process.env.GROQ_API_KEY;
  const groq = groqKey
    ? createOpenAICompatible({
        name: "groq",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: groqKey,
        supportsStructuredOutputs: false,
      })
    : null;

  return (modelId: string) => {
    const normalized = (modelId || "").toLowerCase();

    if (normalized.startsWith("google/")) {
      const google = createGoogleGenerativeAI({ apiKey: getGeminiKey() });
      return google(mapModelToGemini(modelId));
    }

    if (!groq) {
      const google = createGoogleGenerativeAI({ apiKey: getGeminiKey() });
      return google(mapModelToGemini(modelId));
    }

    if (normalized.includes("8b") || normalized.includes("instant")) {
      return groq("llama-3.1-8b-instant");
    }

    return groq("llama-3.3-70b-versatile");
  };
}

export const MODELOS_IMAGEM = [
  { id: "google/imagen-3", label: "Imagen 3 (Google AI Studio)" },
  { id: "pollinations/flux", label: "Imagen 3 (Google AI Studio)" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Imagen 3 (Google AI Studio)" },
  { id: "google/gemini-2.5-flash-image", label: "Imagen 3 (Google AI Studio)" },
  { id: "openai/gpt-image-1-mini", label: "Imagen 3 (Google AI Studio)" },
  { id: "openai/gpt-image-2", label: "Imagen 3 (Google AI Studio)" },
  { id: "google/gemini-3-pro-image-preview", label: "Imagen 3 (Google AI Studio)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

function sizeToAspect(size?: string): "1:1" | "16:9" | "9:16" {
  if (size === "1536x1024") return "16:9";
  if (size === "1024x1536") return "9:16";
  return "1:1";
}

// Imagens gratuitas via Pollinations (Flux). Sem chave, sem billing.
// Endpoint: https://image.pollinations.ai/prompt/<prompt>?model=flux&enhance=true&seed=<n>&width=&height=
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

// Imagens via Hugging Face Inference API (FLUX.1-dev). Requer HF_TOKEN.
const HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-dev";

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem;
  referenceImageUrls?: string[];
}): Promise<string> {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) throw new Error("Missing HF_TOKEN");

  const cleaned = sanitizeVisualPrompt(opts.prompt) + REALISM_SUFFIX;
  const { width, height } = sizeToWH(opts.size);
  const seed = Math.floor(Math.random() * 1_000_000_000);

  // Endpoint OpenAI-compatível do HF Router: roteia automaticamente para um
  // provider que ainda serve o modelo (fal-ai / replicate / together / nebius).
  const url = "https://router.huggingface.co/v1/images/generations";

  let res: Response | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HF_IMAGE_MODEL,
          prompt: cleaned,
          response_format: "b64_json",
          size: `${width}x${height}`,
          n: 1,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) break;
      if (res.status < 500 && res.status !== 429 && res.status !== 503) break;
      lastErr = new Error(`HF ${res.status}`);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!res) throw new Error(`HuggingFace fetch falhou: ${String((lastErr as any)?.message || lastErr)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HuggingFace ${res.status}: ${txt.slice(0, 400)}`);
  }

  const json: any = await res.json();
  const item = json?.data?.[0];
  if (item?.b64_json) return item.b64_json as string;

  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`HF image url ${imgRes.status}`);
    const buf = await imgRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
  }

  throw new Error(`HuggingFace resposta sem imagem: ${JSON.stringify(json).slice(0, 400)}`);
}



