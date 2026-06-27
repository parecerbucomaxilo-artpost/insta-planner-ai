// Server-only helper.
// Texto: Google Gemini (gemini-2.5-flash) via @ai-sdk/google.
// Imagens: Google Imagen 3 via fetch direto à API oficial do Google AI Studio.
// Auth: GEMINI_API_KEY.
import { createGoogleGenerativeAI } from "@ai-sdk/google";

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
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
  const apiKey = getGeminiKey();
  const google = createGoogleGenerativeAI({ apiKey });
  // Wrapper que aceita ids do catálogo (groq/*, google/*, llama-*) e roteia para Gemini.
  return (modelId: string) => google(mapModelToGemini(modelId));
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

  const endpoints = [
    `https://router.huggingface.co/hf-inference/models/${HF_IMAGE_MODEL}`,
    `https://api-inference.huggingface.co/models/${HF_IMAGE_MODEL}`,
  ];

  let res: Response | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = endpoints[attempt % endpoints.length];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
          Accept: "image/png",
          "x-wait-for-model": "true",
        },
        body: JSON.stringify({
          inputs: cleaned,
          parameters: { width, height, num_inference_steps: 4, seed },
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

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const txt = await res.text();
    throw new Error(`HuggingFace JSON error: ${txt.slice(0, 400)}`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1024) {
    throw new Error(`HuggingFace devolveu imagem muito pequena (${buf.byteLength} bytes)`);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}



