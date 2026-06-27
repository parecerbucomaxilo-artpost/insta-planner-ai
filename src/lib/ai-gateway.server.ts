// Lovable AI Gateway: GPT-5-mini (texto) + Gemini 3.1 Flash Image / Nano Banana (imagem).
// Mantém um gerador local de fallback caso o gateway retorne 402 (créditos) ou 429 (rate-limit).

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

  if (isOpenAIImage) {
    const res = await fetch(`${GATEWAY_URL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    const b64 = json?.data?.[0]?.b64_json;
    if (b64) return b64;
    const url = json?.data?.[0]?.url;
    if (url) {
      const r2 = await fetch(url);
      const buf = Buffer.from(await r2.arrayBuffer());
      return buf.toString("base64");
    }
    throw new Error("Lovable AI imagem: resposta sem b64/url");
  }

  // Gemini image via chat/completions
  const userContent: any[] = [{ type: "text", text: opts.prompt }];
  for (const url of opts.referenceImageUrls ?? []) {
    userContent.push({ type: "image_url", image_url: { url } });
  }
  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "user", content: userContent }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lovable AI imagem ${res.status}: ${body.slice(0, 240)}`);
  }
  const json: any = await res.json();
  const msg = json?.choices?.[0]?.message ?? {};
  // Vários shapes possíveis: message.images[].image_url.url, ou content[].image_url
  const candidates: any[] = [];
  if (Array.isArray(msg.images)) candidates.push(...msg.images);
  if (Array.isArray(msg.content)) candidates.push(...msg.content);
  for (const c of candidates) {
    const url: string | undefined =
      c?.image_url?.url || (typeof c?.image_url === "string" ? c.image_url : undefined) || c?.url;
    if (!url) continue;
    if (url.startsWith("data:")) return url.split(",")[1] || "";
    const r2 = await fetch(url);
    const buf = Buffer.from(await r2.arrayBuffer());
    return buf.toString("base64");
  }
  throw new Error("Lovable AI imagem: resposta sem imagem");
}

// ---------------- Fallback local (gerador procedural anatômico) ----------------

function hashText(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function blend(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}
function setPixel(px: Uint8Array, w: number, h: number, x: number, y: number, color: [number, number, number], alpha = 1) {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
  const p = (iy * w + ix) * 4;
  const a = Math.max(0, Math.min(1, alpha));
  px[p] = Math.round(px[p] * (1 - a) + color[0] * a);
  px[p + 1] = Math.round(px[p + 1] * (1 - a) + color[1] * a);
  px[p + 2] = Math.round(px[p + 2] * (1 - a) + color[2] * a);
  px[p + 3] = 255;
}
function fillEllipse(px: Uint8Array, w: number, h: number, cx: number, cy: number, rx: number, ry: number, color: [number, number, number], alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const d = dx * dx + dy * dy;
    if (d <= 1) setPixel(px, w, h, x, y, color, alpha * Math.min(1, (1 - d) * 2.5));
  }
}
function fillRect(px: Uint8Array, w: number, h: number, x: number, y: number, rw: number, rh: number, color: [number, number, number], alpha = 1) {
  const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(w, Math.ceil(x + rw));
  const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(h, Math.ceil(y + rh));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) setPixel(px, w, h, xx, yy, color, alpha);
}

async function generateImageLocal(opts: { prompt: string; size?: "1024x1024" | "1024x1536" | "1536x1024" }): Promise<string> {
  const photon: any = await import("@cf-wasm/photon");
  const { PhotonImage } = photon;
  const { width, height } = sizeToWH(opts.size);
  const px = new Uint8Array(width * height * 4);
  const seed = hashText(`${opts.prompt}|${Date.now()}|${Math.random()}`);
  const isLiga = /Liga Acadêmica|graduação|lactbmf|anhanguera/i.test(opts.prompt);
  const navy = hexToRgb(isLiga ? "#2D2C32" : "#0c2340");
  const navy2 = hexToRgb(isLiga ? "#111114" : "#14366b");
  const cyan = hexToRgb(isLiga ? "#DD8E3C" : "#2dd4ff");
  const white = hexToRgb("#ffffff");
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const radial = Math.hypot((x - width * 0.58) / width, (y - height * 0.38) / height);
    const t = Math.min(1, y / height * 0.7 + radial * 0.8);
    const c = blend(navy2, navy, t);
    const p = (y * width + x) * 4;
    px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2]; px[p + 3] = 255;
  }
  fillEllipse(px, width, height, width * 0.72, height * 0.25, width * 0.28, height * 0.16, cyan, 0.10);
  fillEllipse(px, width, height, width * 0.18, height * 0.78, width * 0.22, height * 0.13, white, 0.06);
  const bandH = Math.round(height * 0.16);
  fillRect(px, width, height, 0, height - bandH, width, bandH, hexToRgb("#06182c"), 0.62);
  const img = new PhotonImage(px, width, height);
  const out = img.get_bytes_jpeg(90);
  img.free();
  void seed;
  return Buffer.from(out).toString("base64");
}

// ---------------- API pública: tenta gateway, faz fallback local ----------------

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

  if (apiKey && model !== "local/sem-custo") {
    try {
      return await generateImageGateway({ apiKey, prompt: opts.prompt, model, size, referenceImageUrls: opts.referenceImageUrls });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 402 (sem créditos) ou 429 (rate-limit) → cai pro local sem quebrar a UI
      if (!/402|429|payment|credit|rate|insufficient/i.test(msg)) throw err;
      console.warn("[ai-gateway] imagem caiu para gerador local:", msg);
    }
  }
  return generateImageLocal({ prompt: opts.prompt, size });
}
