// Server-only helper.
// Texto: Groq por padrão; Gemini só quando explicitamente selecionado.
// Imagens: Pollinations por padrão; Gemini só quando explicitamente selecionado.
// Auth: GROQ_API_KEY / GEMINI_API_KEY.
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
  { id: "pollinations/flux", label: "Flux gratuito (padrão, sem cota Gemini)" },
  { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (Google AI Studio)" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image" },
  { id: "google/imagen-3", label: "Imagen 3 (legado)" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image Mini (legado)" },
  { id: "openai/gpt-image-2", label: "GPT Image 2 (legado)" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image (legado)" },
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

function isGeminiImageModel(model?: string): boolean {
  return !!model && model.startsWith("google/") && model.includes("image");
}

async function responseToBase64(res: Response): Promise<string> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function generatePollinationsImageBase64(prompt: string, size?: "1024x1024" | "1024x1536" | "1536x1024"): Promise<string> {
  const { width, height } = sizeToWH(size);
  const cleaned = sanitizeVisualPrompt(prompt) + REALISM_SUFFIX;
  const seed = Math.floor(Date.now() % 1_000_000_000);
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(cleaned)}`);
  url.searchParams.set("model", "flux");
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("enhance", "true");
  url.searchParams.set("nologo", "true");

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastErr = new Error(`Pollinations ${res.status}: ${txt.slice(0, 240)}`);
      } else {
        const type = res.headers.get("content-type") || "";
        if (!type.includes("image")) {
          const txt = await res.text().catch(() => "");
          lastErr = new Error(`Pollinations sem imagem: ${txt.slice(0, 240)}`);
        } else {
          return responseToBase64(res);
        }
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`Pollinations falhou: ${String((lastErr as any)?.message || lastErr)}`);
}

async function generateGeminiImageBase64(prompt: string, size?: "1024x1024" | "1024x1536" | "1536x1024"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const cleaned = sanitizeVisualPrompt(prompt) + REALISM_SUFFIX;
  const aspect = sizeToAspect(size);
  const promptWithAspect = `${cleaned}\n\n[Aspect ratio: ${aspect}]`;

  const model = "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: promptWithAspect }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };

  let res: Response | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) break;
      if (res.status < 500 && res.status !== 429) break;
      lastErr = new Error(`Gemini ${res.status}`);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!res) throw new Error(`Gemini fetch falhou: ${String((lastErr as any)?.message || lastErr)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 400)}`);
  }

  const json: any = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const data = p?.inlineData?.data || p?.inline_data?.data;
    if (data) return data as string;
  }
  throw new Error(`Gemini resposta sem imagem: ${JSON.stringify(json).slice(0, 400)}`);
}

// Respeita o modelo escolhido: Pollinations é o padrão sem cota Gemini.
// Se Gemini for escolhido e estourar quota/429, cai automaticamente para Pollinations.
export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem;
  referenceImageUrls?: string[];
}): Promise<string> {
  if (!isGeminiImageModel(opts.model)) {
    return generatePollinationsImageBase64(opts.prompt, opts.size);
  }

  try {
    return await generateGeminiImageBase64(opts.prompt, opts.size);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const quotaOrProviderFailure = /429|quota|rate|limit|403|404|not found|billing/i.test(message);
    if (!quotaOrProviderFailure) throw error;
    console.warn(`[generateImageBase64] Gemini indisponível (${message.slice(0, 180)}). Usando Pollinations.`);
    return generatePollinationsImageBase64(opts.prompt, opts.size);
  }
}



