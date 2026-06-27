// Server-only helper.
// Texto: Groq (OpenAI-compatible, gratuito) usando GROQ_API_KEY.
// Imagens: Pollinations.ai (modelo Flux, gratuito).
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Mapeia ids do catálogo antigo para modelos reais da Groq.
function mapModelToGroq(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("pro") || m.includes("gpt-5") || m.includes("opus")) {
    return "llama-3.3-70b-versatile";
  }
  if (m.includes("lite") || m.includes("nano") || m.includes("mini") || m.includes("8b")) {
    return "llama-3.1-8b-instant";
  }
  return "llama-3.3-70b-versatile";
}

export function createLovableAiGatewayProvider(_ignoredKey: string) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("Missing GROQ_API_KEY");

  return createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    headers: { Authorization: `Bearer ${groqKey}` },
    fetch: async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const parsed = JSON.parse(init.body);
          if (parsed?.model) {
            parsed.model = mapModelToGroq(String(parsed.model));
            init = { ...init, body: JSON.stringify(parsed) };
          }
        } catch {
          /* ignore */
        }
      }
      return fetch(input, init);
    },
  });
}

export const MODELOS_IMAGEM = [
  { id: "pollinations/flux", label: "Flux (Pollinations, grátis)" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Flux (Pollinations, grátis)" },
  { id: "google/gemini-2.5-flash-image", label: "Flux (Pollinations, grátis)" },
  { id: "openai/gpt-image-1-mini", label: "Flux (Pollinations, grátis)" },
  { id: "openai/gpt-image-2", label: "Flux (Pollinations, grátis)" },
  { id: "google/gemini-3-pro-image-preview", label: "Flux (Pollinations, grátis)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

// Imagens via Pollinations.ai (modelo Flux, gratuito, sem auth).
export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem;
  referenceImageUrls?: string[];
}): Promise<string> {
  const [wStr, hStr] = (opts.size ?? "1024x1024").split("x");
  const width = Number(wStr) || 1024;
  const height = Number(hStr) || 1024;
  const seed = Math.floor(Math.random() * 1_000_000);
  const encoded = encodeURIComponent(opts.prompt.slice(0, 1800));
  const url =
    `https://image.pollinations.ai/prompt/${encoded}` +
    `?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true&safe=false`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pollinations ${res.status}: ${txt.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 1024) {
    throw new Error(`Pollinations devolveu imagem vazia/inválida (${buf.byteLength} bytes)`);
  }
  return buf.toString("base64");
}
