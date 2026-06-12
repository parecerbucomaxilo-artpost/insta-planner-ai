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

// Lovable AI Gateway image generation (OpenAI-compatible /v1/images/generations).
export async function generateImageBase64(opts: {
  apiKey: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: opts.prompt,
      size: opts.size ?? "1024x1024",
      quality: "low",
      n: 1,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Image gen ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as { data: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const r = await fetch(item.url);
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.toString("base64");
  }
  throw new Error("Image gen: resposta sem b64_json nem url");
}
