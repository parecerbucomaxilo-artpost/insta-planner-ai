// Lovable AI Gateway: GPT-5-mini (texto) + Gemini 3.1 Flash Image / Nano Banana (imagem).
// A geração preserva o provedor selecionado e nunca retorna uma imagem substituta.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export const MODELOS_IA = [
  { id: "openai/gpt-5-mini", label: "GPT-5 mini (texto)" },
  { id: "openai/gpt-5-nano", label: "GPT-5 nano (texto)" },
  { id: "openai/gpt-5", label: "GPT-5 (texto)" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini (texto)" },
  { id: "openai/gpt-5.4", label: "GPT-5.4 (texto)" },
  { id: "openai/gpt-5.5", label: "GPT-5.5 (texto)" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (texto)" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (texto)" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash (texto)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (texto)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (texto)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (texto)" },
] as const;
export type ModeloTexto = (typeof MODELOS_IA)[number]["id"];

export const MODELOS_IMAGEM = [
  { id: "google/gemini-3.1-flash-image", label: "Gemini Nano Banana 2 (imagem)" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image (imagem)" },
  { id: "google/gemini-2.5-flash-image", label: "Gemini Nano Banana (imagem)" },
  { id: "openai/gpt-image-2", label: "GPT Image 2 (imagem)" },
  { id: "openai/gpt-image-1-mini", label: "GPT image 1 mini (imagem)" },
  { id: "pollinations/flux", label: "Pollinations Flux (grátis, sem custo)" },
  { id: "pollinations/flux-realism", label: "Pollinations Flux Realism (grátis)" },
  { id: "pollinations/turbo", label: "Pollinations Turbo (grátis, rápido)" },
] as const;
export type ModeloImagem = (typeof MODELOS_IMAGEM)[number]["id"];

const DEFAULT_TEXT_MODEL: ModeloTexto = "openai/gpt-5-mini";
const DEFAULT_IMAGE_MODEL: ModeloImagem = "google/gemini-3.1-flash-image";

function sizeToWH(size?: string): { width: number; height: number } {
  if (size === "1536x1024") return { width: 1536, height: 1024 };
  if (size === "1024x1536") return { width: 1024, height: 1536 };
  return { width: 1024, height: 1024 };
}

// ---------------- Texto: GPT-5 mini via Lovable Gateway ----------------

export async function generateTextAI(opts: {
  apiKey?: string;
  system?: string;
  prompt: string;
  model?: ModeloTexto | string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = opts.apiKey || process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const model = (opts.model as string) || DEFAULT_TEXT_MODEL;

  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
      ...(opts.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lovable AI texto ${res.status}: ${body.slice(0, 240)}`);
  }
  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content?.toString().trim() || "";
}

// ---------------- Imagem: Gemini Nano Banana via Lovable Gateway ----------------

async function generateImageGateway(opts: {
  apiKey: string;
  prompt: string;
  model: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  referenceImageUrls?: string[];
}): Promise<string> {
  const isOpenAIImage = opts.model.startsWith("openai/gpt-image");

  const fetchUrlAsB64 = async (url: string) => {
    const r2 = await fetch(url);
    if (!r2.ok) throw new Error(`Lovable AI imagem: falha ao baixar URL ${r2.status}`);
    const buf = Buffer.from(await r2.arrayBuffer());
    return buf.toString("base64");
  };

  const extractImageB64 = async (json: any): Promise<string> => {
    if (json?.error || json?.choices?.[0]?.finish_reason === "content_filter" || json?.choices?.[0]?.message?.refusal) {
      throw new Error("O provedor recusou a geração da imagem. A solicitação foi encerrada.");
    }
    const first = json?.data?.[0];
    const direct = first?.b64_json || first?.image?.b64_json || first?.image?.base64;
    if (typeof direct === "string" && direct.trim()) {
      console.info("[image-response]", { model: opts.model, origin: "provider-inline" });
      return direct.startsWith("data:") ? direct.split(",")[1] || "" : direct;
    }
    const url = first?.url || first?.image_url?.url || first?.image_url;
    if (typeof url === "string" && url.trim()) {
      if (!url.startsWith("data:") && !url.startsWith("https://")) throw new Error("Origem da imagem inválida.");
      console.info("[image-response]", { model: opts.model, origin: url.startsWith("data:") ? "provider-inline" : new URL(url).origin });
      return url.startsWith("data:") ? url.split(",")[1] || "" : fetchUrlAsB64(url);
    }
    throw new Error("Lovable AI imagem: resposta sem b64/url");
  };

  if (isOpenAIImage) {
    const res = await fetch(`${GATEWAY_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        "Lovable-API-Key": opts.apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        size: opts.size,
        n: 1,
        quality: "low",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Lovable AI imagem ${res.status}: ${body.slice(0, 240)}`);
    }
    const json: any = await res.json();
    return extractImageB64(json);
  }

  // Gemini image via endpoint oficial de imagens do Gateway. O shape é diferente
  // do OpenAI: usa messages + modalities; o retorno é normalizado em data[0].b64_json.
  const userContent: any[] = [{ type: "text", text: opts.prompt }];
  for (const url of opts.referenceImageUrls ?? []) {
    userContent.push({ type: "image_url", image_url: { url } });
  }
  const res = await fetch(`${GATEWAY_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "user", content: userContent.length === 1 ? opts.prompt : userContent }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lovable AI imagem ${res.status}: ${body.slice(0, 240)}`);
  }
  const json: any = await res.json();
  return extractImageB64(json);
}

// Pollinations.ai — geração de imagens 100% gratuita, sem chave, sem custo.
// Boa qualidade (Flux) e ótimo fallback quando o Lovable Gateway retorna 402/429.
async function generateImagePollinations(opts: {
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  model?: string; // "flux" | "flux-realism" | "turbo"
}): Promise<string> {
  const { width, height } = sizeToWH(opts.size);
  const model = (opts.model || "flux").replace(/^pollinations\//, "");
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(opts.prompt)}` +
    `?width=${width}&height=${height}&model=${encodeURIComponent(model)}` +
    `&nologo=true&enhance=true&seed=${Math.floor(Math.random() * 1_000_000)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

export async function generateImageBase64(opts: {
  apiKey?: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: ModeloImagem | string;
  referenceImageUrls?: string[];
}): Promise<string> {
  const apiKey = opts.apiKey || process.env.LOVABLE_API_KEY;
  const size = opts.size ?? "1024x1024";
  const model = (opts.model as string) || DEFAULT_IMAGE_MODEL;

  if (!opts.prompt.trim()) throw new Error("Brief visual vazio; geração bloqueada.");
  if (model === "local/sem-custo") {
    throw new Error("O modelo local não gera imagens contextuais. Selecione um dos geradores de imagem existentes para continuar; nenhuma imagem genérica foi criada.");
  }
  if (model.startsWith("pollinations/")) return generateImagePollinations({ prompt: opts.prompt, size, model });
  if (!apiKey) throw new Error("Gerador de imagem não configurado; nenhuma imagem substituta foi criada.");
  return generateImageGateway({ apiKey, prompt: opts.prompt, model, size, referenceImageUrls: opts.referenceImageUrls });
}
