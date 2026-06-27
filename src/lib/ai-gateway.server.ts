// Server-only helper.
// Texto: chamadas diretas ao Gemini (OpenAI-compatible) usando GEMINI_API_KEY.
// Imagens: API gratuita do Pollinations.ai (modelo Flux). Sem Lovable AI Gateway → sem 402.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Mapeia ids do catálogo antigo (Lovable Gateway) para modelos reais do Gemini.
function mapModelToGemini(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("pro")) return "gemini-2.5-pro";
  if (m.includes("flash-lite")) return "gemini-2.5-flash-lite";
  // gemini-3-flash-preview, gpt-5, claude, etc. → cai no flash padrão
  return "gemini-2.5-flash";
}

export function createLovableAiGatewayProvider(_ignoredKey: string) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("Missing GEMINI_API_KEY");

  return createOpenAICompatible({
    name: "gemini-direct",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: { Authorization: `Bearer ${geminiKey}` },
    fetch: async (input, init) => {
      // Reescreve o campo `model` no body para um id válido do Gemini.
      if (init?.body && typeof init.body === "string") {
        try {
          const parsed = JSON.parse(init.body);
          if (parsed?.model) {
            parsed.model = mapModelToGemini(String(parsed.model));
            init = { ...init, body: JSON.stringify(parsed) };
          }
        } catch {
          /* body não-JSON: deixa passar */
        }
      }
      return fetch(input, init);
    },
  });
}

export const MODELOS_IMAGEM = [
  { id: "google/gemini-3.1-flash-image-preview", label: "Flux (Pollinations, grátis)" },
  { id: "google/gemini-2.5-flash-image", label: "Flux (Pollinations, grátis)" },
  { id: "openai/gpt-image-1-mini", label: "Flux (Pollinations, grátis)" },
  { id: "openai/gpt-image-2", label: "Flux (Pollinations, grátis)" },
  { id: "google/gemini-3-pro-image-preview", label: "Flux (Pollinations, grátis)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

// Imagens via Pollinations.ai (modelo Flux, gratuito, sem auth).
// Mantém a assinatura antiga (apiKey, prompt, size, model, referenceImageUrls) para
// compatibilidade — só `prompt` e `size` são usados.
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
