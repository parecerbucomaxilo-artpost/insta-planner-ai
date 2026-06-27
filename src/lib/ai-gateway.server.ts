// Server-only helper.
// Texto e imagem 100% via Lovable AI Gateway (LOVABLE_API_KEY).
// Sem Groq, sem Pollinations/Flux, sem provedores externos sugeridos.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GATEWAY_BASE = "https://ai.gateway.lovable.dev/v1";

const DEFAULT_TEXT_MODEL = "openai/gpt-5-mini";
const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

function getKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

export function createLovableAiGatewayProvider(_ignored?: string) {
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_BASE,
    apiKey: getKey(),
  });
  return (modelId: string) => provider(modelId || DEFAULT_TEXT_MODEL);
}

export const MODELOS_IMAGEM = [
  { id: "google/gemini-3.1-flash-image", label: "Gemini Nano Banana 2 (grátis)" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image Mini (grátis)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

function sizeToWH(size?: string): { width: number; height: number } {
  if (size === "1536x1024") return { width: 1536, height: 1024 };
  if (size === "1024x1536") return { width: 1024, height: 1536 };
  return { width: 1024, height: 1024 };
}

async function generateViaImagesApi(model: string, prompt: string, size: string): Promise<string> {
  const res = await fetch(`${GATEWAY_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({ model, prompt, size, quality: "low", n: 1 }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Lovable AI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Lovable AI: resposta sem imagem");
  return b64;
}

async function generateViaChatModalities(model: string, prompt: string, size: string, refs: string[]): Promise<string> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const url of refs) content.push({ type: "image_url", image_url: { url } });
  const res = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"], size }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Lovable AI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) throw new Error("Lovable AI: resposta sem imagem");
  const b64 = url.split(",")[1] ?? "";
  if (!b64) throw new Error("Lovable AI: base64 vazio");
  return b64;
}

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem | string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const { width, height } = sizeToWH(opts.size);
  const size = `${width}x${height}`;
  const model = opts.model || "google/gemini-3.1-flash-image";
  if (model.startsWith("openai/gpt-image")) {
    return generateViaImagesApi(model, opts.prompt, size);
  }
  return generateViaChatModalities(model, opts.prompt, size, opts.referenceImageUrls ?? []);
}

