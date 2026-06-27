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
  ", professional editorial studio photography, highly detailed, photorealistic, 8k resolution, cinematic lighting, shot on 35mm lens, realistic anatomy, no text, no words";

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
  model?: ModeloImagem;
  referenceImageUrls?: string[];
}): Promise<string> {
  const cleaned = sanitizeVisualPrompt(opts.prompt) + REALISM_SUFFIX;
  const { width, height } = sizeToWH(opts.size);
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleaned)}?model=flux&enhance=true&nologo=true&seed=${seed}&width=${width}&height=${height}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pollinations ${res.status}: ${txt.slice(0, 400)}`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1024) {
    throw new Error(`Pollinations devolveu imagem muito pequena (${buf.byteLength} bytes)`);
  }
  // ArrayBuffer -> base64
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}



