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
  { id: DEFAULT_IMAGE_MODEL, label: "Gemini Nano Banana 2 (padrão)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

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
  const { width, height } = sizeToWH(opts.size);
  const model = opts.model || DEFAULT_IMAGE_MODEL;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: opts.prompt }];
  for (const url of opts.referenceImageUrls ?? []) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
      size: `${width}x${height}`,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Lovable AI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const images = data?.choices?.[0]?.message?.images;
  const url: string | undefined = images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) {
    throw new Error("Lovable AI: resposta sem imagem");
  }
  const b64 = url.split(",")[1] ?? "";
  if (!b64) throw new Error("Lovable AI: base64 vazio");
  return b64;
}
