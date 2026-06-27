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

// Imagens via Google Imagen 3 (API oficial Google AI Studio).
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict
export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem;
  referenceImageUrls?: string[];
}): Promise<string> {
  const apiKey = getGeminiKey();
  const aspectRatio = sizeToAspect(opts.size);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

  const body = {
    instances: [{ prompt: opts.prompt.slice(0, 4000) }],
    parameters: {
      sampleCount: 1,
      aspectRatio,
      personGeneration: "allow_adult",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Imagen 3 ${res.status}: ${txt.slice(0, 500)}`);
  }

  const data: any = await res.json().catch(() => ({}));
  const raw: string | undefined =
    data?.predictions?.[0]?.bytesBase64Encoded ??
    data?.predictions?.[0]?.base64EncodedData ??
    data?.predictions?.[0]?.image?.bytesBase64Encoded;

  if (!raw) {
    throw new Error(`Imagen 3 retornou payload sem imagem: ${JSON.stringify(data).slice(0, 400)}`);
  }

  // Sanitização: remove prefixo data URI, quebras de linha e espaços.
  let cleaned = raw.trim();
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1];
  }
  cleaned = cleaned.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    throw new Error("Imagen 3 retornou base64 inválido após limpeza");
  }

  // Valida tamanho mínimo (evita imagens corrompidas/vazias).
  const approxBytes = Math.floor((cleaned.length * 3) / 4);
  if (approxBytes < 1024) {
    throw new Error(`Imagen 3 devolveu imagem muito pequena (${approxBytes} bytes)`);
  }
  return cleaned;
}
